-- ============================================================
-- MIGRACIÓN: Cola SUNAT + Estados CDR descriptivos
-- Fecha: 2026-05-23
-- ============================================================

BEGIN;

-- 1. Ampliar estado_sunat de CHAR(2) a VARCHAR(15) para estados descriptivos
ALTER TABLE "Comprobante"
  ALTER COLUMN estado_sunat TYPE VARCHAR(15);

-- 2. Agregar nuevos campos de cola y CDR
ALTER TABLE "Comprobante"
  ADD COLUMN IF NOT EXISTS cdr_xml   TEXT,
  ADD COLUMN IF NOT EXISTS cdr_code  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS xml_path  TEXT,
  ADD COLUMN IF NOT EXISTS hash      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS enviado_at TIMESTAMPTZ;

-- 3. Migrar estados existentes al nuevo vocabulario
UPDATE "Comprobante" SET estado_sunat = CASE estado_sunat
  WHEN 'PE' THEN 'GENERADO'
  WHEN 'EN' THEN 'ENVIANDO'
  WHEN 'AC' THEN 'ACEPTADO'
  WHEN 'RR' THEN 'RECHAZADO'
  WHEN 'AN' THEN 'RECHAZADO'
  ELSE 'GENERADO'
END
WHERE estado_sunat IN ('PE','EN','AC','RR','AN');

-- 4. Actualizar el default al nuevo vocabulario
ALTER TABLE "Comprobante"
  ALTER COLUMN estado_sunat SET DEFAULT 'GENERADO';

-- 5. Copiar datos existentes hacia los nuevos campos canónicos
UPDATE "Comprobante"
  SET cdr_code   = codigo_sunat,
      hash       = hash_cpe,
      enviado_at = fecha_envio_sunat,
      xml_path   = nombre_xml
WHERE codigo_sunat IS NOT NULL
   OR hash_cpe IS NOT NULL;

-- 6. Índice para queries de reintento (estados pendientes)
CREATE INDEX IF NOT EXISTS idx_comprobante_estado_sunat
  ON "Comprobante" (estado_sunat)
  WHERE estado_sunat IN ('GENERADO','FIRMADO','ENVIANDO','ERROR_RED','SIN_CDR');

COMMIT;
