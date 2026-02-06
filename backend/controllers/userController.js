import { User } from "../models/User.js";
import { Trip } from "../models/Trip.js";
import { ExitLog } from "../models/ExitLog.js";
import { Op } from "sequelize";
import crypto from "crypto";

// Helper to hash password
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function uploadUserDoc(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // Return the relative path to be stored in DB
        const relativePath = `/uploads/user_docs/${req.file.filename}`;
        res.json({ url: relativePath });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Upload failed" });
    }
}

export async function logExit(req, res) {
    try {
        const { reason, location } = req.body;
        if (!reason) {
            return res.status(400).json({ error: "Reason is required" });
        }

        await ExitLog.create({
            user_id: req.user.id,
            reason: reason,
            // You can store location if you add lat/lng columns to ExitLog in the future
        });

        res.json({ message: "Exit logged successfully" });
    } catch (error) {
        console.error("Log exit error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateFcmToken(req, res) {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) {
            return res.status(400).json({ error: "FCM Token is required" });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.fcm_token = fcm_token;
        await user.save();

        res.json({ message: "FCM Token updated successfully" });
    } catch (error) {
        console.error("Error updating FCM token:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createUser(req, res) {
  try {
    const { 
      name, email, password, role, home_lat, home_lng,
      employee_id, phone_number, emergency_contact, circle_zone, blood_group, is_active,
      bike_insurance_expiry, bike_insurance_photo_url,
      dl_expiry, dl_photo_url,
      helmet_photo_url,
      profile_pic_url
    } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already exists" });
    }
    const password_hash = hashPassword(password);
    const user = await User.create({
      name,
      email,
      password_hash,
      role: role || "USER",
      home_lat,
      home_lng,
      employee_id,
      phone_number,
      emergency_contact,
      circle_zone,
      blood_group,
      is_active: is_active !== undefined ? is_active : true,
      bike_insurance_expiry,
      bike_insurance_photo_url,
      dl_expiry,
      dl_photo_url,
      helmet_photo_url,
      profile_pic_url
    });
    res.status(201).json(user);
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserById(req, res) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password_hash"] }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("getUserById error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateUser(req, res) {
  try {
    const { 
      name, email, password, role, home_lat, home_lng,
      employee_id, phone_number, emergency_contact, circle_zone, blood_group, is_active,
      bike_insurance_expiry, bike_insurance_photo_url,
      dl_expiry, dl_photo_url,
      helmet_photo_url,
      profile_pic_url
    } = req.body;
    
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email; // Note: Unique check might be needed if email changes
    if (password) user.password_hash = hashPassword(password);
    if (role) user.role = role;
    if (home_lat !== undefined) user.home_lat = home_lat;
    if (home_lng !== undefined) user.home_lng = home_lng;
    
    if (employee_id !== undefined) user.employee_id = employee_id;
    if (phone_number !== undefined) user.phone_number = phone_number;
    if (emergency_contact !== undefined) user.emergency_contact = emergency_contact;
    if (circle_zone !== undefined) user.circle_zone = circle_zone;
    if (blood_group !== undefined) user.blood_group = blood_group;
    if (is_active !== undefined) user.is_active = is_active;
    if (bike_insurance_expiry !== undefined) user.bike_insurance_expiry = bike_insurance_expiry;
    if (bike_insurance_photo_url !== undefined) user.bike_insurance_photo_url = bike_insurance_photo_url;
    if (dl_expiry !== undefined) user.dl_expiry = dl_expiry;
    if (dl_photo_url !== undefined) user.dl_photo_url = dl_photo_url;
    if (helmet_photo_url !== undefined) user.helmet_photo_url = helmet_photo_url;
    if (profile_pic_url !== undefined) user.profile_pic_url = profile_pic_url;

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("updateUser error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteUser(req, res) {
  try {
    const { reason } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Soft delete
    user.is_deleted = true;
    user.is_active = false;
    user.delete_reason = reason || "No reason provided";
    
    // Rename email to allow re-registration
    user.email = `${user.email}.deleted.${Date.now()}`;
    
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listUsers(req, res) {
  try {
    const { role } = req.query;
    const where = { is_deleted: false }; // Filter out deleted users
    if (role) {
      if (role.toLowerCase() === 'employee') {
        where.role = 'USER';
      } else {
        where.role = role.toUpperCase();
      }
    }

    const users = await User.findAll({
      where,
      include: [{
        model: Trip,
        limit: 1,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'current_phase', 'active', 'actual_end_time']
      }]
    });

    // Return users directly without availability check
    res.json(users);
  } catch (error) {
    console.error("listUsers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
