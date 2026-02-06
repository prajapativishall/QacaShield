import dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../config/db.js";
import { User } from "../models/User.js";

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("Database connected...");

    const password_hash = "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"; // password123

    const users = [
      { name: "Admin User", email: "admin@qaca.com", password_hash, role: "ADMIN" },
      { name: "Manager User", email: "manager@qaca.com", password_hash, role: "MANAGER" },
      { name: "Regular User", email: "user@qaca.com", password_hash, role: "USER" }
    ];

    for (const u of users) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u
      });
      if (created) {
        console.log(`Created user: ${u.email}`);
      } else {
        console.log(`User already exists: ${u.email}`);
        // Update role if needed
        if (user.role !== u.role) {
            user.role = u.role;
            await user.save();
            console.log(`Updated role for: ${u.email}`);
        }
      }
    }

    console.log("Seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
