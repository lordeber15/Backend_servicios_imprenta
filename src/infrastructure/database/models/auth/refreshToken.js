const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

/**
 * Refresh token de una sesión. Solo se guarda el SHA-256 del token; el valor
 * en claro existe únicamente en la cookie httpOnly del navegador.
 * Tabla creada por la migración 0004-sesiones.
 */
const RefreshToken = sequelize.define("RefreshToken", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false },
  family_id: { type: DataTypes.UUID, allowNull: false },
  sesion_inicio: { type: DataTypes.DATE, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked_at: { type: DataTypes.DATE, allowNull: true },
  revoked_motivo: { type: DataTypes.STRING(30), allowNull: true },
  user_agent: { type: DataTypes.STRING(255), allowNull: true },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "RefreshTokens",
  timestamps: false,
});

module.exports = RefreshToken;
