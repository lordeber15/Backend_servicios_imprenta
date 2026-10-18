-- Migración: Agregar campo tipo a tabla almanaque
-- Fecha: 2026-03-22
-- Descripción: Diferenciar cotizaciones de ventas confirmadas
-- Autor: Claude Code
-- Base de Datos: PostgreSQL

-- ===================================================================
-- PASO 1: Crear tipo ENUM si no existe
-- ===================================================================
DO $$ BEGIN
    CREATE TYPE tipo_almanaque AS ENUM ('cotizacion', 'venta');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- PASO 2: Agregar columna tipo con valor por defecto 'cotizacion'
-- ===================================================================
ALTER TABLE almanaques
ADD COLUMN IF NOT EXISTS tipo tipo_almanaque NOT NULL DEFAULT 'cotizacion';

COMMENT ON COLUMN almanaques.tipo IS 'Tipo de almanaque: cotizacion (no suma a ingresos) o venta (suma a ingresos)';

-- ===================================================================
-- PASO 3: Marcar registros existentes como 'cotizacion'
-- ===================================================================
-- Comportamiento conservador: todos los registros existentes se marcan
-- como cotizaciones para evitar sumar ventas duplicadas.
UPDATE almanaques
SET tipo = 'cotizacion'
WHERE tipo IS NULL;

-- ===================================================================
-- PASO 4: Verificación de la migración
-- ===================================================================
-- Ejecutar esta query para verificar que la migración fue exitosa:
SELECT tipo, COUNT(*) as total FROM almanaques GROUP BY tipo;

-- ===================================================================
-- ROLLBACK (si es necesario revertir los cambios)
-- ===================================================================
-- Para revertir esta migración, ejecutar:
-- ALTER TABLE almanaques DROP COLUMN tipo;
-- DROP TYPE tipo_almanaque;
-- NOTA: Esto eliminará la columna y el tipo ENUM permanentemente.
