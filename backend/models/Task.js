import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Task = sequelize.define(
  "Task",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.ENUM("PENDING", "ACTIVE", "COMPLETED"), defaultValue: "PENDING" }
  },
  { tableName: "tasks", timestamps: true, underscored: true }
);
