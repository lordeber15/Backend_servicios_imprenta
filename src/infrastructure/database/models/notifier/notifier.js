const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

/**
 * Pagos Yape/Plin capturados por el teléfono (Pagos Notifier).
 * Tablas creadas por la migración 0007-pagos-notifier.
 *
 * Montos: DECIMAL(12,2). Postgres los devuelve como string ("15.72"):
 * se mantienen así hasta el cliente, nunca se pasan a number.
 */
const PROVEEDORES = ["YAPE", "PLIN"];
const ESTADOS = ["PARSED", "UNPARSED", "IGNORED"];

const NotifierDevice = sequelize.define("NotifierDevice", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(80), allowNull: false },
  api_key_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
  revoked_at: { type: DataTypes.DATE, allowNull: true },
  last_seen_at: { type: DataTypes.DATE, allowNull: true },
  app_version: { type: DataTypes.STRING(32), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "notifier_devices",
  timestamps: false,
});

const NotifierEnrollToken = sequelize.define("NotifierEnrollToken", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE, allowNull: true },
  device_id: { type: DataTypes.UUID, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "notifier_enroll_tokens",
  timestamps: false,
});

const NotifierRawNotification = sequelize.define("NotifierRawNotification", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  device_id: { type: DataTypes.UUID, allowNull: false },
  package_name: { type: DataTypes.STRING(128), allowNull: false },
  provider: { type: DataTypes.ENUM(...PROVEEDORES), allowNull: false },
  notif_key: { type: DataTypes.STRING(256), allowNull: false },
  title: { type: DataTypes.STRING(256), allowNull: true },
  text: { type: DataTypes.STRING(2000), allowNull: false },
  big_text: { type: DataTypes.STRING(4000), allowNull: true },
  posted_at: { type: DataTypes.DATE, allowNull: false },
  received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fingerprint: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
  status: { type: DataTypes.ENUM(...ESTADOS), allowNull: false },
  ignore_reason: { type: DataTypes.STRING(64), allowNull: true },
}, {
  tableName: "notifier_raw_notifications",
  timestamps: false,
});

const NotifierPayment = sequelize.define("NotifierPayment", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  raw_notification_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  provider: { type: DataTypes.ENUM(...PROVEEDORES), allowNull: false },
  sender_name: { type: DataTypes.STRING(160), allowNull: false },
  name_masked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "PEN" },
  security_code: { type: DataTypes.STRING(8), allowNull: true },
  paid_at: { type: DataTypes.DATE, allowNull: false },
  late: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  possible_duplicate_of_id: { type: DataTypes.UUID, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "notifier_payments",
  timestamps: false,
});

NotifierDevice.hasMany(NotifierRawNotification, { foreignKey: "device_id", as: "notifications" });
NotifierRawNotification.belongsTo(NotifierDevice, { foreignKey: "device_id", as: "device" });
NotifierRawNotification.hasOne(NotifierPayment, { foreignKey: "raw_notification_id", as: "payment" });
NotifierPayment.belongsTo(NotifierRawNotification, { foreignKey: "raw_notification_id", as: "raw" });

module.exports = {
  PROVEEDORES,
  ESTADOS,
  NotifierDevice,
  NotifierEnrollToken,
  NotifierRawNotification,
  NotifierPayment,
};
