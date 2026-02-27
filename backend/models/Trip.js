import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Trip = sequelize.define(
  "Trip",
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    origin_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    origin_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    dest_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    dest_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destination_address: { type: DataTypes.STRING(255), allowNull: true },
    home_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    home_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    route_polyline: { type: DataTypes.TEXT('long'), allowNull: true },
    helmet_image_url: { type: DataTypes.STRING(255), allowNull: true },
    helmet_start_image_url: { type: DataTypes.STRING(255), allowNull: true },
    helmet_return_image_url: { type: DataTypes.STRING(255), allowNull: true },
    is_safety_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    exit_reason: { type: DataTypes.TEXT, allowNull: true },
    
    // New Fields for Assignment Form
    task_title: { type: DataTypes.STRING(200), allowNull: true },
    priority: { type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"), defaultValue: "MEDIUM" },
    geofence_radius: { type: DataTypes.INTEGER, defaultValue: 100 }, // in meters
    route_optimization: { type: DataTypes.ENUM("FASTEST", "SAFEST"), defaultValue: "FASTEST" },
    expected_start_time: { type: DataTypes.DATE, allowNull: true },
    buffer_time: { type: DataTypes.INTEGER, defaultValue: 15 }, // in minutes
    
    // Completion Data
    actual_start_time: { type: DataTypes.DATE, allowNull: true },
    actual_end_time: { type: DataTypes.DATE, allowNull: true },
    
    current_phase: {
      type: DataTypes.ENUM("PLANNED", "PENDING", "ACCEPTED", "ACTIVE", "REACHED_DESTINATION", "RETURNING_HOME", "FINALIZED", "COMPLETED"),
      defaultValue: "PENDING", // Changed default to PENDING
    },
    active: { type: DataTypes.BOOLEAN, defaultValue: false }
  },
  { tableName: "assignments", timestamps: true, underscored: true }
);
