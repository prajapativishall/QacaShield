import { sequelize } from "../config/db.js";

export async function logManagerView(managerId, subject, meta = {}) {
  const sql =
    "INSERT INTO audit_logs (manager_id, subject, meta_json, created_at) VALUES (?, ?, ?, NOW())";
  const metaJson = JSON.stringify(meta);
  await sequelize.query(sql, { replacements: [managerId, subject, metaJson] });
}
