import { Log } from "../models/Log.js";
import { Trip } from "../models/Trip.js";
import { User } from "../models/User.js";
import { broadcastToAdmins } from "../services/notificationService.js";

// Cache for alert deduplication (tripId_type_lat_lng -> timestamp)
const alertCache = new Map();
const DEDUPLICATION_WINDOW_MS = 60000; // 1 minute

export async function createAlert(req, res) {
  try {
    const { assignment_id, message, type, lat, lng } = req.body;
    
    if (!assignment_id) return res.status(400).json({ error: "Missing assignment_id" });

    // Deduplication Logic
    const cacheKey = `${assignment_id}_${type}_${lat}_${lng}`;
    const now = Date.now();
    const lastAlertTime = alertCache.get(cacheKey);

    if (lastAlertTime && (now - lastAlertTime < DEDUPLICATION_WINDOW_MS)) {
      console.log(`Deduplicating SOS alert for assignment ${assignment_id}`);
      return res.status(200).json({ ok: true, message: "Duplicate alert suppressed" });
    }
    alertCache.set(cacheKey, now);

    // Periodic cleanup of old cache entries
    if (alertCache.size > 1000) {
      for (const [key, timestamp] of alertCache.entries()) {
        if (now - timestamp > DEDUPLICATION_WINDOW_MS) alertCache.delete(key);
      }
    }
    
    // Mobile app sends 'type', 'lat', 'lng', but might miss 'message'
    const finalMessage = message || (type === 'SOS' ? 'SOS Alert Triggered' : 'Safety Alert');
    
    const log = await Log.create({ 
        assignment_id, 
        type: "ALERT", 
        message: finalMessage,
        lat: lat || null,
        lng: lng || null
    });

    // Send emergency notification to admins
    try {
      const trip = await Trip.findByPk(assignment_id, { include: [User] });
      const userName = trip?.User?.name || "Unknown Rider";
      const taskTitle = trip?.task_title || "Unknown Task";
      
      const title = `🚨 EMERGENCY: ${type} Alert`;
      const notificationMessage = `Rider: ${userName}\nAssignment: ${taskTitle}\nLocation: ${lat}, ${lng}\nType: ${type}\nMessage: ${finalMessage}`;
      
      broadcastToAdmins(title, notificationMessage);
    } catch (err) {
      console.error("Failed to send alert notification:", err.message);
    }
    
    res.status(201).json({ id: log.id });
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
}

export async function getAlerts(req, res) {
    try {
        const logs = await Log.findAll({
            where: { type: "ALERT" },
            order: [['created_at', 'DESC']],
            limit: 50,
            include: [
                {
                    model: Trip,
                    include: [
                        {
                            model: User,
                            attributes: ['name', 'email']
                        }
                    ]
                }
            ]
        });
        res.json(logs);
    } catch (error) {
        console.error("Fetch alerts error:", error);
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
}
