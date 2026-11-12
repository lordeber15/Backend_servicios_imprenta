/**
 * 0007 — Pagos Yape/Plin recibidos desde el teléfono (Pagos Notifier).
 *
 * Un teléfono Android captura las notificaciones de pago de Yape y Plin y las
 * envía con su clave de dispositivo (X-Device-Key). El backend las parsea y
 * las guarda aquí; el panel de pagos (solo Administrador) las muestra en vivo.
 *
 * 1. notifier_devices: teléfonos enlazados. Solo se guarda el SHA-256 de la
 *    clave; la clave en claro se entrega una única vez al enlazar.
 * 2. notifier_enroll_tokens: códigos QR de un solo uso para enlazar (hash).
 * 3. notifier_raw_notifications: toda notificación recibida, parseada o no.
 *    fingerprint UNIQUE hace la ingesta idempotente (reenviar no duplica).
 * 4. notifier_payments: pagos reconocidos. Monto en NUMERIC(12,2).
 */
async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql) => sequelize.query(sql, { transaction });

    await q(`DO $$ BEGIN
      CREATE TYPE notifier_provider AS ENUM ('YAPE', 'PLIN');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q(`DO $$ BEGIN
      CREATE TYPE notifier_status AS ENUM ('PARSED', 'UNPARSED', 'IGNORED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    // ── 1. Dispositivos ───────────────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS notifier_devices (
      id           UUID PRIMARY KEY,
      name         VARCHAR(80) NOT NULL,
      api_key_hash CHAR(64) NOT NULL UNIQUE,
      revoked_at   TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ,
      app_version  VARCHAR(32),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    // ── 2. Códigos de enlace ──────────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS notifier_enroll_tokens (
      id         UUID PRIMARY KEY,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      device_id  UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    // ── 3. Notificaciones recibidas ───────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS notifier_raw_notifications (
      id            UUID PRIMARY KEY,
      device_id     UUID NOT NULL REFERENCES notifier_devices(id) ON UPDATE CASCADE,
      package_name  VARCHAR(128) NOT NULL,
      provider      notifier_provider NOT NULL,
      notif_key     VARCHAR(256) NOT NULL,
      title         VARCHAR(256),
      text          VARCHAR(2000) NOT NULL,
      big_text      VARCHAR(4000),
      posted_at     TIMESTAMPTZ NOT NULL,
      received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      fingerprint   CHAR(64) NOT NULL UNIQUE,
      status        notifier_status NOT NULL,
      ignore_reason VARCHAR(64)
    )`);
    await q(`CREATE INDEX IF NOT EXISTS notifier_raw_device_posted ON notifier_raw_notifications (device_id, posted_at)`);
    await q(`CREATE INDEX IF NOT EXISTS notifier_raw_status_received ON notifier_raw_notifications (status, received_at)`);

    // ── 4. Pagos reconocidos ──────────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS notifier_payments (
      id                       UUID PRIMARY KEY,
      raw_notification_id      UUID NOT NULL UNIQUE REFERENCES notifier_raw_notifications(id) ON UPDATE CASCADE ON DELETE CASCADE,
      provider                 notifier_provider NOT NULL,
      sender_name              VARCHAR(160) NOT NULL,
      name_masked              BOOLEAN NOT NULL DEFAULT false,
      amount                   NUMERIC(12,2) NOT NULL,
      currency                 CHAR(3) NOT NULL DEFAULT 'PEN',
      security_code            VARCHAR(8),
      paid_at                  TIMESTAMPTZ NOT NULL,
      late                     BOOLEAN NOT NULL DEFAULT false,
      possible_duplicate_of_id UUID,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q(`CREATE INDEX IF NOT EXISTS notifier_payments_paid_at ON notifier_payments (paid_at)`);
    await q(`CREATE INDEX IF NOT EXISTS notifier_payments_provider_paid_at ON notifier_payments (provider, paid_at)`);
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql) => sequelize.query(sql, { transaction });
    await q(`DROP TABLE IF EXISTS notifier_payments`);
    await q(`DROP TABLE IF EXISTS notifier_raw_notifications`);
    await q(`DROP TABLE IF EXISTS notifier_enroll_tokens`);
    await q(`DROP TABLE IF EXISTS notifier_devices`);
    await q(`DROP TYPE IF EXISTS notifier_status`);
    await q(`DROP TYPE IF EXISTS notifier_provider`);
  });
}

module.exports = { up, down };
