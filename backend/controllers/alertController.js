import { Log } from "../models/Log.js";
import { Trip } from "../models/Trip.js";
import { User } from "../models/User.js";

export async function createAlert(req, res) {
  const { trip_id, message, type, lat, lng } = req.body;
  
  // Mobile app sends 'type', 'lat', 'lng', but might miss 'message'
  const finalMessage = message || (type === 'SOS' ? 'SOS Alert Triggered' : 'Safety Alert');
  
  if (!trip_id) return res.status(400).json({ error: "Missing trip_id" });
  
  const log = await Log.create({ 
      trip_id, 
      type: "ALERT", 
      message: finalMessage,
      lat: lat || null,
      lng: lng || null
  });
  
  res.status(201).json({ id: log.id });
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
