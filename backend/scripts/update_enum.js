
import dotenv from 'dotenv';
dotenv.config();

// Use dynamic import to ensure environment variables are loaded first
async function updateEnum() {
  const { sequelize } = await import("../config/db.js");
  
  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    console.log("Updating ENUM for current_phase in trips table...");
    await sequelize.query(`
      ALTER TABLE trips 
      MODIFY COLUMN current_phase 
      ENUM('PLANNED', 'PENDING', 'ACCEPTED', 'ACTIVE', 'REACHED_DESTINATION', 'RETURNING_HOME', 'FINALIZED', 'COMPLETED') 
      DEFAULT 'PENDING';
    `);

    console.log("ENUM updated successfully.");
  } catch (error) {
    console.error("Unable to update ENUM:", error);
  } finally {
    await sequelize.close();
  }
}

updateEnum();
