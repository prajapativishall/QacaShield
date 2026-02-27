import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME || "qacashield",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      socketPath: (process.platform !== 'win32' && process.env.DB_HOST === 'localhost') 
        ? '/var/run/mysqld/mysqld.sock' 
        : undefined
    }
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
    Trip.belongsTo(User, { foreignKey: 'assigned_by', as: 'assigner' });

    User.hasMany(ExitLog, { foreignKey: 'user_id' });
    ExitLog.belongsTo(User, { foreignKey: 'user_id' });

    Trip.hasMany(Log, { foreignKey: 'trip_id' });
    Log.belongsTo(Trip, { foreignKey: 'trip_id' });

    await sequelize.sync({ alter: false });

    // Helper function to add column if it doesn't exist
    async function addColumnIfNotExists(tableName, columnName, definition) {
        try {
            const [results] = await sequelize.query(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}' AND TABLE_SCHEMA = DATABASE()`
            );
            if (results.length === 0) {
                await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
                console.log(`Added column ${columnName} to ${tableName}`);
            }
        } catch (e) {
            console.log(`Error adding column ${columnName} to ${tableName}:`, e.message);
        }
    }
    
    // Manually upgrade route_polyline to LONGTEXT to support long trips
    try {
        await sequelize.query("ALTER TABLE trips MODIFY COLUMN route_polyline LONGTEXT");
    } catch (e) {
        console.log("Note: Could not alter route_polyline to LONGTEXT.");
    }

    // Add missing columns to trips
    await addColumnIfNotExists('trips', 'assigned_by', 'INTEGER UNSIGNED NULL AFTER user_id');
    await addColumnIfNotExists('trips', 'destination_address', 'VARCHAR(255) NULL AFTER dest_lng');
    await addColumnIfNotExists('trips', 'helmet_image_url', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('trips', 'helmet_start_image_url', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('trips', 'helmet_return_image_url', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('trips', 'is_safety_verified', 'TINYINT(1) DEFAULT 0');
    await addColumnIfNotExists('trips', 'exit_reason', 'TEXT NULL');
    await addColumnIfNotExists('trips', 'task_title', 'VARCHAR(200) NULL');
    await addColumnIfNotExists('trips', 'priority', "ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM'");
    await addColumnIfNotExists('trips', 'geofence_radius', 'INTEGER DEFAULT 100');
    await addColumnIfNotExists('trips', 'route_optimization', "ENUM('FASTEST', 'SAFEST') DEFAULT 'FASTEST'");
    await addColumnIfNotExists('trips', 'expected_start_time', 'DATETIME NULL');
    await addColumnIfNotExists('trips', 'buffer_time', 'INTEGER DEFAULT 15');
    await addColumnIfNotExists('trips', 'actual_start_time', 'DATETIME NULL');
    await addColumnIfNotExists('trips', 'actual_end_time', 'DATETIME NULL');

    // Update ENUM for current_phase
    try {
        await sequelize.query(`
            ALTER TABLE trips 
            MODIFY COLUMN current_phase 
            ENUM('PLANNED', 'PENDING', 'ACCEPTED', 'ACTIVE', 'REACHED_DESTINATION', 'RETURNING_HOME', 'FINALIZED', 'COMPLETED') 
            DEFAULT 'PENDING'
        `);
    } catch (e) {
        console.log("Note: Could not update current_phase ENUM.");
    }

    // Add lat/lng columns to trip_logs if they don't exist
    await addColumnIfNotExists('trip_logs', 'lat', 'DECIMAL(10, 7) NULL');
    await addColumnIfNotExists('trip_logs', 'lng', 'DECIMAL(10, 7) NULL');

    // Add new columns to users table
    const userColumns = [
        { name: 'employee_id', def: 'VARCHAR(50) NULL' },
        { name: 'phone_number', def: 'VARCHAR(20) NULL' },
        { name: 'emergency_contact', def: 'VARCHAR(20) NULL' },
        { name: 'circle_zone', def: 'VARCHAR(100) NULL' },
        { name: 'blood_group', def: 'VARCHAR(10) NULL' },
        { name: 'is_active', def: 'BOOLEAN DEFAULT 1' },
        { name: 'bike_insurance_expiry', def: 'DATE NULL' },
        { name: 'bike_insurance_photo_url', def: 'VARCHAR(255) NULL' },
        { name: 'dl_expiry', def: 'DATE NULL' },
        { name: 'dl_photo_url', def: 'VARCHAR(255) NULL' },
        { name: 'helmet_photo_url', def: 'VARCHAR(255) NULL' },
        { name: 'profile_pic_url', def: 'VARCHAR(255) NULL' },
        { name: 'fcm_token', def: 'VARCHAR(500) NULL' },
        { name: 'is_deleted', def: 'BOOLEAN DEFAULT 0' },
        { name: 'delete_reason', def: 'TEXT NULL' }
    ];

    for (const col of userColumns) {
        await addColumnIfNotExists('users', col.name, col.def);
    }

    console.log("Database connected and models synced");
  } catch (err) {
    console.error("Database connection failed", err);
    throw err;
  }
}
