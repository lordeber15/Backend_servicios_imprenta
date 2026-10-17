-- Migración: Agregar campo telefono a tabla almanaque
-- Fecha: 2026-08-19
-- Descripción: El formulario de cotización ya capturaba el teléfono del cliente
--              pero no existía columna donde persistirlo.
-- Autor: Claude Code
-- Base de Datos: PostgreSQL

-- ===================================================================
-- PASO 1: Agregar la columna telefono
-- ===================================================================
-- El nombre de la tabla se resuelve en tiempo de ejecución: las migraciones
-- previas usan "almanaques" mientras que el modelo Sequelize declara
-- freezeTableName sobre "almanaque". Se aplica sobre la que exista.
DO $$
DECLARE
    tabla text;
BEGIN
    SELECT table_name INTO tabla
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('almanaques', 'almanaque')
    ORDER BY table_name
    LIMIT 1;

    IF tabla IS NULL THEN
        RAISE EXCEPTION 'No se encontró la tabla almanaque/almanaques en el esquema %', current_schema();
    END IF;

    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS telefono VARCHAR(255)', tabla);
    EXECUTE format('COMMENT ON COLUMN %I.telefono IS %L', tabla,
                   'Teléfono de contacto del cliente capturado en la cotización');

    RAISE NOTICE 'Columna telefono agregada sobre la tabla %', tabla;
END $$;

-- ===================================================================
-- PASO 2: Verificación de la migración
-- ===================================================================
-- Ejecutar esta query para verificar que la migración fue exitosa:
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('almanaques', 'almanaque') AND column_name = 'telefono';

-- ===================================================================
-- ROLLBACK (si es necesario revertir los cambios)
-- ===================================================================
-- Para revertir esta migración, ejecutar:
-- ALTER TABLE almanaques DROP COLUMN telefono;   -- o "almanaque", según aplique
-- NOTA: Esto eliminará la columna y los teléfonos registrados permanentemente.
