import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";
import { User } from "../models/User.js";
import { broadcastToAdmins, sendPushNotification } from "./notificationService.js";

// Helper for automated status notifications
async function notifyAutoStatusChange(trip, status) {
  try {
    const user = await User.findByPk(trip.user_id);
    const title = `Automated Update: ${status}`;
    const message = `Assignment: ${trip.task_title || `#${trip.id}`}\nRider: ${user?.name || "Unknown"}\nNew Status: ${status}`;
    
    // Notify Admin
    broadcastToAdmins(title, message);
    
    // Notify User via Push
    if (user?.fcm_token) {
      sendPushNotification(user.fcm_token, title, message, { tripId: trip.id });
    }
  } catch (err) {
    console.error("Failed to send auto status notification:", err.message);
  }
}

export function startGeofenceMonitor(io) {
  const minHits = 3;
  const minSeconds = 15;
  const inRadiusState = new Map();

  // 1. Monitor Return Home (Phase: RETURNING_HOME -> FINALIZED)
  setInterval(async () => {
    try {
      const trips = await Trip.findAll({
        where: { 
          current_phase: ["RETURNING_HOME", "REACHED_DESTINATION"], 
          active: true 
        }
      });
      for (const trip of trips) {
        const targetLat = trip.home_lat ?? trip.origin_lat;
        const targetLng = trip.home_lng ?? trip.origin_lng;
        if (!targetLat || !targetLng || !trip.current_lat || !trip.current_lng) continue;
        
        const dist = haversine(
          Number(trip.current_lat),
          Number(trip.current_lng),
          Number(targetLat),
          Number(targetLng)
        );
        const radiusMeters =
          typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
            ? trip.geofence_radius
            : 100;
        const radiusKm = Math.max(radiusMeters, 10) / 1000;
        if (dist <= radiusKm) {
          const now = Date.now();
          const state = inRadiusState.get(trip.id) || { firstSeen: now, hits: 0 };
          state.hits += 1;
          if (!inRadiusState.has(trip.id)) {
            state.firstSeen = now;
          }
          inRadiusState.set(trip.id, state);
          const elapsedSec = (now - state.firstSeen) / 1000;
          if (state.hits >= minHits && elapsedSec >= minSeconds) {
            inRadiusState.delete(trip.id);
            trip.current_phase = "FINALIZED";
            trip.active = false;
            trip.actual_end_time = new Date();
            trip.completed_lat = trip.current_lat;
            trip.completed_lng = trip.current_lng;
            await trip.save();

            notifyAutoStatusChange(trip, "Finalized (Auto Return Home)");

            try {
              const assignmentId = trip.task_title || `#${trip.id}`;
              await Log.create({
                assignment_id: trip.id,
                type: "STATUS",
                message: `Assignment ${assignmentId} finalized (auto return home)`,
                lat: trip.current_lat,
                lng: trip.current_lng
              });
            } catch (e) {
              console.error("Failed to log finalized status:", e.message);
            }
            io.to(`trip:${trip.id}`).emit("tripFinalized", { tripId: trip.id });
          }
        } else {
          inRadiusState.delete(trip.id);
        }
      }
    } catch (err) {
      console.error("Return geofence monitor error:", err.message);
    }
  }, 10000);

  // 2. Monitor Destination Arrival (Phase: ACTIVE -> REACHED_DESTINATION)
  setInterval(async () => {
    try {
      const trips = await Trip.findAll({
        where: { current_phase: "ACTIVE", active: true }
      });
      for (const trip of trips) {
        if (!trip.dest_lat || !trip.dest_lng || !trip.current_lat || !trip.current_lng) continue;
        const dist = haversine(
          Number(trip.current_lat),
          Number(trip.current_lng),
          Number(trip.dest_lat),
          Number(trip.dest_lng)
        );
        const radiusMeters =
          typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
            ? trip.geofence_radius
            : 100;
        const radiusKm = Math.max(radiusMeters, 10) / 1000;
        if (dist <= radiusKm) {
          const now = Date.now();
          const state = inRadiusState.get(`dest_${trip.id}`) || { firstSeen: now, hits: 0 };
          state.hits += 1;
          if (!inRadiusState.has(`dest_${trip.id}`)) {
            state.firstSeen = now;
          }
          inRadiusState.set(`dest_${trip.id}`, state);
          const elapsedSec = (now - state.firstSeen) / 1000;
          if (state.hits >= minHits && elapsedSec >= minSeconds) {
            inRadiusState.delete(`dest_${trip.id}`);
            trip.current_phase = "REACHED_DESTINATION";
            trip.arrival_time = new Date();
            trip.arrival_lat = trip.current_lat;
            trip.arrival_lng = trip.current_lng;
            await trip.save();

            notifyAutoStatusChange(trip, "Reached Destination (Auto Geofence)");

            try {
              const assignmentId = trip.task_title || `#${trip.id}`;
              await Log.create({
                assignment_id: trip.id,
                type: "STATUS",
                message: `Assignment ${assignmentId} reached destination (auto geofence)`,
                lat: trip.current_lat,
                lng: trip.current_lng
              });
            } catch (e) {
              console.error("Failed to log reached destination status:", e.message);
            }
            io.to(`trip:${trip.id}`).emit("tripReachedDestination", { tripId: trip.id });
          }
        } else {
          inRadiusState.delete(`dest_${trip.id}`);
        }
      }
    } catch (err) {
      console.error("Dest geofence monitor error:", err.message);
    }
  }, 5000);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(v) {
  return (v * Math.PI) / 180;
}
