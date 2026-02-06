import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const ExitLog = sequelize.define(
  "ExitLog",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  { tableName: "exit_logs", timestamps: true, underscored: true }
);
