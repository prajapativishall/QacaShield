import { User } from "../models/User.js";
import { Op } from "sequelize";
import crypto from "crypto";
import { generateToken } from "../utils/auth.js";

export async function login(req, res) {
  const { email, employee_id, password } = req.body;
  // Support login by either email or employee_id
  const loginId = employee_id || email;

  console.log(`Login attempt for: ${loginId} from IP: ${req.ip}`);
  if (!loginId || !password) return res.status(400).json({ error: "Missing credentials" });
  
  const user = await User.findOne({ 
    where: { 
      [Op.or]: [
        { email: loginId },
        { employee_id: loginId }
      ]
    } 
  });

  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (user.password_hash !== hash) return res.status(401).json({ error: "Invalid credentials" });
  
  const token = generateToken(user);
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      home_lat: user.home_lat,
      home_lng: user.home_lng,
      employee_id: user.employee_id,
      phone_number: user.phone_number,
              emergency_contact: user.emergency_contact,
              circle_zone: user.circle_zone,
      blood_group: user.blood_group,
      profile_pic_url: user.profile_pic_url
    } 
  });
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const password_hash = crypto.createHash("sha256").update(password).digest("hex");
  const user = await User.create({ name, email, password_hash, role: "USER" });
  res.status(201).json({ id: user.id });
}
