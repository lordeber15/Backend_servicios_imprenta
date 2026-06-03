-- Migración: Agregar campo impreso a tabla almanaque
-- Fecha: 2026-06-02
-- Descripción: Permite bloquear la edición de una cotización una vez que se ha impreso
-- Autor: Claude Code
-- Base de Datos: PostgreSQL

-- ===================================================================
-- PASO 1: Agregar columna impreso con valor por defecto false
-- ===================================================================
ALTER TABLE almanaque
ADD COLUMN IF NOT EXISTS impreso BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN almanaque.impreso IS 'Indica si la cotización ya fue impresa. Una vez impresa no puede modificarse.';

-- ===================================================================
-- PASO 2: Marcar registros existentes como no impresos
-- ===================================================================
UPDATE almanaque
SET impreso = false
WHERE impreso IS NULL;

-- ===================================================================
-- PASO 3: Verificación de la migración
-- ===================================================================
SELECT COUNT(*) AS total,
       SUM(CASE WHEN impreso = true THEN 1 ELSE 0 END) AS impresas,
       SUM(CASE WHEN impreso = false THEN 1 ELSE 0 END) AS no_impresas
FROM almanaque;

-- ===================================================================
-- ROLLBACK (si es necesario revertir los cambios)
-- ===================================================================
-- ALTER TABLE almanaque DROP COLUMN impreso;
