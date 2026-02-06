import "dotenv/config";
import { User } from "../models/User.js";
import { sequelize } from "../config/db.js";

async function checkUsers() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");
    
    const users = await User.findAll();
    console.log(`Found ${users.length} users.`);
    users.forEach(u => {
      console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Active: ${u.is_active}, Deleted: ${u.is_deleted}, EmpID: ${u.employee_id}`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

checkUsers();
