const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

/**
 * Bitácora de auditoría (solo-anexar). Tabla creada por la migración 0005.
 * Se escribe a través de application/services/auditoria.service.js.
 */
const AuditLog = sequelize.define("AuditLog", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  usuario: { type: DataTypes.STRING(255), allowNull: true },
  accion: { type: DataTypes.STRING(60), allowNull: false },
  entidad: { type: DataTypes.STRING(60), allowNull: true },
  entidad_id: { type: DataTypes.STRING(60), allowNull: true },
  antes: { type: DataTypes.JSONB, allowNull: true },
  despues: { type: DataTypes.JSONB, allowNull: true },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  user_agent: { type: DataTypes.STRING(255), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "AuditLog",
  timestamps: false,
});

module.exports = AuditLog;
