-- Migración: Corregir FK de DetalleAlmanaques hacia la tabla activa "almanaque"
-- Fecha: 2026-09-14
-- Descripción:
--   El modelo Sequelize `Almanaque` usa `freezeTableName: true` y por lo tanto
--   lee/escribe en la tabla "almanaque" (singular). Sin embargo la llave foránea
--   de "DetalleAlmanaques" quedó apuntando a la tabla vieja "almanaques" (plural),
--   creada antes de fijar el nombre de tabla.
--
--   Efecto del bug: al crear una cotización con detalle, Sequelize inserta el
--   encabezado en "almanaque" y el detalle en "DetalleAlmanaques" dentro de la
--   misma transacción. Como el id nuevo existe en "almanaque" pero NO en
--   "almanaques", la FK rechaza el insert del detalle y Postgres revierte TODA
--   la transacción (encabezado incluido). Resultado: ninguna cotización con
--   detalle queda guardada y el número (id) nunca avanza para el usuario, aunque
--   la secuencia sí se consume en cada intento fallido.
--
-- Autor: Claude Code
-- Base de Datos: PostgreSQL
-- Idempotente: sí, se puede ejecutar múltiples veces sin causar errores.

-- ===================================================================
-- PASO 0: Verificación previa
-- ===================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'almanaque'
  ) THEN
    RAISE EXCEPTION 'No existe la tabla "almanaque" (singular) en el esquema %. Verificar que el backend ya corrió el sync de Sequelize.', current_schema();
  END IF;
END $$;

-- ===================================================================
-- PASO 1: Migrar a "almanaque" los registros que solo existen en la tabla
-- vieja "almanaques" (si esa tabla existe y tiene datos huérfanos)
-- ===================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'almanaques'
  ) THEN
    INSERT INTO almanaque (id, cliente, "tipoDocumento", "numeroDocumento", direccion, telefono, "fechaEmision", "aCuenta", "precioTotal", tipo, impreso, "createdAt", "updatedAt")
    SELECT a.id, a.cliente, a."tipoDocumento", a."numeroDocumento", a.direccion, NULL, a."fechaEmision", a."aCuenta", a."precioTotal", 'cotizacion', false, a."createdAt", a."updatedAt"
    FROM almanaques a
    WHERE NOT EXISTS (SELECT 1 FROM almanaque b WHERE b.id = a.id)
    ON CONFLICT (id) DO NOTHING;

    -- Evitar colisiones de autoincrement si se insertaron ids explícitos por encima del valor actual
    PERFORM setval('almanaque_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM almanaque), (SELECT last_value FROM almanaque_id_seq)));

    RAISE NOTICE 'Registros huérfanos de "almanaques" migrados a "almanaque" (si había alguno)';
  ELSE
    RAISE NOTICE 'La tabla "almanaques" (plural) no existe; no hay nada que migrar';
  END IF;
END $$;

-- ===================================================================
-- PASO 2: Corregir la FK de DetalleAlmanaques para que apunte a "almanaque"
-- (busca el nombre real de la constraint por si difiere entre entornos)
-- ===================================================================
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = current_schema()
    AND tc.table_name = 'DetalleAlmanaques'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'AlmanaqueId'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "DetalleAlmanaques" DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE "DetalleAlmanaques"
    ADD CONSTRAINT "DetalleAlmanaques_AlmanaqueId_fkey"
    FOREIGN KEY ("AlmanaqueId") REFERENCES almanaque(id) ON UPDATE CASCADE ON DELETE SET NULL;

  RAISE NOTICE 'FK de DetalleAlmanaques ahora apunta a "almanaque" (singular)';
END $$;

-- ===================================================================
-- PASO 3: Verificación de la migración
-- ===================================================================
SELECT conname AS constraint_name, confrelid::regclass AS tabla_referenciada
FROM pg_constraint
WHERE conname = 'DetalleAlmanaques_AlmanaqueId_fkey';

-- ===================================================================
-- ROLLBACK (si es necesario revertir)
-- ===================================================================
-- ALTER TABLE "DetalleAlmanaques" DROP CONSTRAINT "DetalleAlmanaques_AlmanaqueId_fkey";
-- ALTER TABLE "DetalleAlmanaques" ADD CONSTRAINT "DetalleAlmanaques_AlmanaqueId_fkey"
--   FOREIGN KEY ("AlmanaqueId") REFERENCES almanaques(id) ON UPDATE CASCADE ON DELETE SET NULL;
-- ADVERTENCIA: revertir la FK reintroduce el bug original (las cotizaciones con
-- detalle volverían a fallar). No elimina los registros ya migrados a "almanaque".
