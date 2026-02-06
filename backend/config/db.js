import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME || "qacashield",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    logging: false
  }
);

export async function initDB() {
  try {
    await sequelize.authenticate();
    await import("../models/User.js");
    await import("../models/Task.js");
    await import("../models/Trip.js");
    await import("../models/Log.js");
    await import("../models/ExitLog.js");

    // Define Associations
    const { User } = await import("../models/User.js");
    const { Trip } = await import("../models/Trip.js");
    const { Log } = await import("../models/Log.js");
    const { ExitLog } = await import("../models/ExitLog.js");
    
    User.hasMany(Trip, { foreignKey: 'user_id' });
    Trip.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(ExitLog, { foreignKey: 'user_id' });
    ExitLog.belongsTo(User, { foreignKey: 'user_id' });

    Trip.hasMany(Log, { foreignKey: 'trip_id' });
    Log.belongsTo(Trip, { foreignKey: 'trip_id' });

    await sequelize.sync({ alter: false });
    
    // Manually upgrade route_polyline to LONGTEXT to support long trips
    try {
        await sequelize.query("ALTER TABLE trips MODIFY COLUMN route_polyline LONGTEXT");
    } catch (e) {
        // Ignore error if table doesn't exist or other minor issues
        console.log("Note: Could not alter route_polyline to LONGTEXT (might already be set or table issue).");
    }

    // Add lat/lng columns to trip_logs if they don't exist
    try {
        await sequelize.query("ALTER TABLE trip_logs ADD COLUMN lat DECIMAL(10, 7) NULL");
        await sequelize.query("ALTER TABLE trip_logs ADD COLUMN lng DECIMAL(10, 7) NULL");
    } catch (e) {
        // Ignore "Duplicate column name" error
    }

    // Add new columns to users table for compliance and details
    const userColumns = [
        "ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) NULL",
        "ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL",
        "ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(20) NULL",
        "ALTER TABLE users ADD COLUMN circle_zone VARCHAR(100) NULL",
        "ALTER TABLE users ADD COLUMN blood_group VARCHAR(10) NULL",
        "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1",
        "ALTER TABLE users ADD COLUMN bike_insurance_expiry DATE NULL",
        "ALTER TABLE users ADD COLUMN bike_insurance_photo_url VARCHAR(255) NULL",
        "ALTER TABLE users ADD COLUMN dl_expiry DATE NULL",
        "ALTER TABLE users ADD COLUMN dl_photo_url VARCHAR(255) NULL",
        "ALTER TABLE users ADD COLUMN helmet_photo_url VARCHAR(255) NULL",
        "ALTER TABLE users ADD COLUMN profile_pic_url VARCHAR(255) NULL",
        "ALTER TABLE users ADD COLUMN fcm_token VARCHAR(500) NULL",
        "ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0",
        "ALTER TABLE users ADD COLUMN delete_reason TEXT NULL"
    ];

    for (const query of userColumns) {
        try {
            await sequelize.query(query);
        } catch (e) {
            // Ignore duplicate column errors
        }
    }

    console.log("Database connected and models synced");
  } catch (err) {
    console.error("Database connection failed", err);
    throw err;
  }
}
