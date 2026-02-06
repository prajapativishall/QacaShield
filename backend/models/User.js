import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(200), allowNull: false },
    role: { type: DataTypes.ENUM("USER", "MANAGER", "ADMIN"), defaultValue: "USER" },
    fcm_token: { type: DataTypes.STRING(500), allowNull: true },
    home_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    home_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    employee_id: { type: DataTypes.STRING(50), allowNull: true },
    phone_number: { type: DataTypes.STRING(20), allowNull: true },
    emergency_contact: { type: DataTypes.STRING(20), allowNull: true },
    circle_zone: { type: DataTypes.STRING(100), allowNull: true },
    blood_group: { type: DataTypes.STRING(10), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    bike_insurance_expiry: { type: DataTypes.DATEONLY, allowNull: true },
    bike_insurance_photo_url: { type: DataTypes.STRING(255), allowNull: true },
    dl_expiry: { type: DataTypes.DATEONLY, allowNull: true },
    dl_photo_url: { type: DataTypes.STRING(255), allowNull: true },
    helmet_photo_url: { type: DataTypes.STRING(255), allowNull: true },
    profile_pic_url: { type: DataTypes.STRING(255), allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    delete_reason: { type: DataTypes.TEXT, allowNull: true }
  },
  { tableName: "users", timestamps: true, underscored: true }
);
