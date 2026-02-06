import dotenv from "dotenv";
dotenv.config();
import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";

async function main() {
  const filePath = path.resolve(process.cwd(), "init.sql");
  const sql = await fs.readFile(filePath, "utf8");
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "";
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });
  await connection.query(sql);
  await connection.end();
  console.log("Database and schema initialized successfully");
}

main().catch((err) => {
  console.error("Failed to initialize database:", err.message);
  process.exit(1);
});
