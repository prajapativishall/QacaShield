import { Log } from "../models/Log.js";
import { Trip } from "../models/Trip.js";
import { User } from "../models/User.js";
import { broadcastToAdmins } from "../services/notificationService.js";

export async function createAlert(req, res) {
  try {
    const { assignment_id, message, type, lat, lng } = req.body;
    
    // Mobile app sends 'type', 'lat', 'lng', but might miss 'message'
    const finalMessage = message || (type === 'SOS' ? 'SOS Alert Triggered' : 'Safety Alert');
    
    if (!assignment_id) return res.status(400).json({ error: "Missing assignment_id" });
    
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
