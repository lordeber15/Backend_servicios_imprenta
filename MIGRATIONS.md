# Migraciones de esquema

El esquema de la base **solo cambia mediante migraciones versionadas** (Umzug).
`sequelize.sync()` ya no se usa en ningún entorno. La API y el worker **no arrancan**
si hay migraciones sin aplicar; así se evita el error 500 que produce un modelo
desfasado de su tabla.

- Migraciones: `src/infrastructure/database/migrations/NNNN-descripcion.js`
- Registro de aplicadas: tabla `SequelizeMeta`
- Migrador: `src/infrastructure/database/migrator.js`

## Uso diario (Docker)

`docker compose up -d` ejecuta primero el servicio `migrate`. Este aplica lo pendiente
(con un `pg_dump` previo en `storage/backups-migracion/`, se guardan los últimos 10) y
termina. Solo si termina bien arrancan `backend` y `sunat_worker`.

```bash
# Desde Desarrollo/
docker compose run --rm migrate node src/infrastructure/database/migrator.js status
docker compose run --rm migrate node src/infrastructure/database/migrator.js up
docker compose run --rm migrate node src/infrastructure/database/migrator.js down   # revierte la última
docker compose run --rm migrate node src/infrastructure/database/migrator.js diff   # compara esquema real vs baseline
```

## Crear una migración

1. Crear `src/infrastructure/database/migrations/0002-descripcion.js` (número siguiente, 4 dígitos):
   ```js
   async function up({ context: { queryInterface, Sequelize, sequelize } }) {
     await sequelize.transaction(async (transaction) => {
       await queryInterface.addColumn("Comprobante", "ticket_id",
         { type: Sequelize.INTEGER, allowNull: true }, { transaction });
     });
   }
   async function down({ context: { queryInterface, sequelize } }) {
     await sequelize.transaction(async (transaction) => {
       await queryInterface.removeColumn("Comprobante", "ticket_id", { transaction });
     });
   }
   module.exports = { up, down };
   ```
2. Actualizar el modelo Sequelize correspondiente para que coincida.
3. Reconstruir la imagen (`docker compose build backend`) y probar `up`, `down` y otra vez `up`.
4. **Nunca** editar una migración ya aplicada en producción: crear una nueva.

## Baseline (0000)

`0000-baseline.sql` es el esquema completo que esperan los modelos. Se generó con
`scripts/generar-baseline.js` (base temporal + `sync()` + `pg_dump --schema-only`).
`0000-baseline.schema.json` lista tablas y columnas para comparar.

- **BD nueva:** `migrate` ejecuta el baseline y crea todo.
- **BD existente** (producción): la migración 0000 se niega a ejecutarse sobre tablas
  existentes. Se marca como aplicada con `baseline`, que **solo** lo hace si el
  esquema real es compatible:

```bash
docker compose run --rm migrate node src/infrastructure/database/migrator.js diff
docker compose run --rm migrate node src/infrastructure/database/migrator.js baseline
```

Si `diff` muestra columnas o tablas faltantes, no se puede marcar: hay que corregir
esas diferencias primero. Las "sobrantes" (por ejemplo, la tabla vieja `almanaques`)
solo se informan y no bloquean.

## Privilegios: rol de aplicación vs. rol de migraciones

La app no debe conectarse con un superusuario. `scripts/roles-bd.sql` crea un rol de
aplicación que solo lee y escribe datos (sin CREATE, ALTER, DROP, TRUNCATE ni COPY
a archivo):

```bash
docker exec -i postgres_db psql -U <dueño> -d <base> \
  -v app_user=imprenta_app -v app_password='<aleatoria>' -v owner=<dueño> -f - < scripts/roles-bd.sql
```

En el `.env` del backend:

```
DB_USER=imprenta_app          DB_PASSWORD=<aleatoria>
DB_MIGRATOR_USER=<dueño>      DB_MIGRATOR_PASSWORD=<la del dueño>
```

El servicio `migrate` usa `DB_MIGRATOR_*`; la API y el worker usan `DB_USER`.

## Historial

Los scripts y SQL sueltos anteriores están en `migrations/legacy/` solo como
referencia. Su efecto ya está en el baseline: **no ejecutarlos**.
