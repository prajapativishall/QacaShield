import { Task } from "../models/Task.js";

export async function createTask(req, res) {
  const { user_id, title } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: "Missing fields" });
  const t = await Task.create({ user_id, title, status: "PENDING" });
  res.status(201).json({ id: t.id });
}

export async function listTasks(req, res) {
  const tasks = await Task.findAll();
  res.json(tasks);
}
