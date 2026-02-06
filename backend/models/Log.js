import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Log = sequelize.define(
  "Log",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    trip_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    message: { type: DataTypes.STRING(500), allowNull: false },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true }
  },
  { tableName: "trip_logs", timestamps: true, underscored: true }
);
