import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory (backend root) if running from scripts folder
// Or just assume running from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("DB_USER:", process.env.DB_USER); // Debug

// Dynamic import to ensure env vars are loaded first
const { sequelize } = await import("../config/db.js");
const { Trip } = await import("../models/Trip.js");
const { User } = await import("../models/User.js");

async function updateAssignmentIds() {
  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("Database connected.");

    // Ensure associations are set up (just in case)
    User.hasMany(Trip, { foreignKey: 'user_id' });
    Trip.belongsTo(User, { foreignKey: 'user_id' });

    const trips = await Trip.findAll({
      include: [
        { model: User, attributes: ['id', 'employee_id'] }
      ]
    });

    console.log(`Found ${trips.length} trips to process.`);

    let updatedCount = 0;

    for (const trip of trips) {
      const createdDate = new Date(trip.createdAt);

      const pad = (num) => String(num).padStart(2, '0');
      
      let empSuffix = "00";
      if (trip.User && trip.User.employee_id) {
          const strId = String(trip.User.employee_id);
          empSuffix = strId.length >= 2 ? strId.slice(-2) : strId.padStart(2, '0');
      }

      const mm = pad(createdDate.getMinutes());
      const dd = pad(createdDate.getDate());
      const MM = pad(createdDate.getMonth() + 1);
      const yy = String(createdDate.getFullYear()).slice(-2);

      const newAssignmentId = `${empSuffix}${mm}${dd}${MM}${yy}`;

      console.log(`Trip ID: ${trip.id}, Old: ${trip.task_title}, New: ${newAssignmentId}`);

      if (trip.task_title !== newAssignmentId) {
        trip.task_title = newAssignmentId;
        await trip.save();
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} trips.`);

  } catch (error) {
    console.error("Error updating assignment IDs:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

updateAssignmentIds();
