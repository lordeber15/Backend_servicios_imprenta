# Migraciones legacy — NO EJECUTAR

Son los scripts y SQL sueltos que se usaban antes del migrador versionado
(Umzug). Su efecto ya está incluido en el **baseline**
(`src/infrastructure/database/migrations/0000-baseline.sql`).

Se conservan solo como historial. Algunos scripts `.js` tienen rutas
relativas que ya no son válidas desde esta carpeta, y ejecutarlos de nuevo
sobre una BD migrada puede fallar o duplicar cambios.

Cualquier cambio de esquema nuevo va en una migración en
`src/infrastructure/database/migrations/NNNN-descripcion.js`. Ver `MIGRATIONS.md`.
