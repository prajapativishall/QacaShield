import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";
import { User } from "../models/User.js";
import { broadcastToAdmins, sendPushNotification, notifyUserEmailSMS } from "./notificationService.js";

const stuckState = new Map();
const pendingStuckAck = new Map();
const STUCK_RADIUS_METERS = 25;

export async function acknowledgeStuckAlert(tripId, userId) {
  const key = String(tripId);
  const pending = pendingStuckAck.get(key);
  if (!pending) return false;
  if (pending.userId !== userId) return false;
  if (pending.timeoutId) clearTimeout(pending.timeoutId);
  pendingStuckAck.delete(key);
  try {
    const trip = await Trip.findByPk(tripId);
    if (trip?.current_phase !== "ACTIVE" || !trip?.active) {
      stuckState.delete(key);
      return true;
    }
    if (trip.current_lat != null && trip.current_lng != null) {
      stuckState.set(key, {
        anchorLat: Number(trip.current_lat),
        anchorLng: Number(trip.current_lng),
        sinceMs: Date.now(),
        notified: false
      });
    } else {
      stuckState.delete(key);
    }
  } catch (_) {
    stuckState.delete(key);
  }
  return true;
}

// Helper for automated status notifications
async function notifyAutoStatusChange(trip, status) {
  try {
    const user = await User.findByPk(trip.user_id);
    const title = `Automated Update: ${status}`;
    const message = `Assignment: ${trip.task_title || `#${trip.id}`}\nRider: ${user?.name || "Unknown"}\nNew Status: ${status}`;
    
    // Notify Admin always
    await broadcastToAdmins(title, message);
    
    // Notify User via Push always
    if (user?.fcm_token) {
      sendPushNotification(user.fcm_token, title, message, { tripId: trip.id });
    }
    if (user) {
      await notifyUserEmailSMS(user, title, message);
    }
  } catch (err) {
    console.error("Failed to send auto status notification:", err.message);
  }
}

export function startGeofenceMonitor(io) {
  const minHits = 2; // Reduced from 3
  const minSeconds = 10; // Reduced from 15
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
        const radiusMeters = Number(trip.geofence_radius) || 100;
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
        const radiusMeters = Number(trip.geofence_radius) || 100;
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

  setInterval(async () => {
    try {
      const trips = await Trip.findAll({
        where: { current_phase: "ACTIVE", active: true }
      });
      const activeIds = new Set(trips.map((t) => String(t.id)));
      for (const key of stuckState.keys()) {
        if (!activeIds.has(key)) {
          stuckState.delete(key);
          const pending = pendingStuckAck.get(key);
          if (pending?.timeoutId) clearTimeout(pending.timeoutId);
          pendingStuckAck.delete(key);
        }
      }

      for (const trip of trips) {
        if (trip.current_lat == null || trip.current_lng == null) continue;
        const tripId = String(trip.id);
        const lat = Number(trip.current_lat);
        const lng = Number(trip.current_lng);
        const radiusKm = STUCK_RADIUS_METERS / 1000;

        const state = stuckState.get(tripId) || {
          anchorLat: lat,
          anchorLng: lng,
          sinceMs: Date.now(),
          notified: false
        };

        const distKm = haversine(lat, lng, Number(state.anchorLat), Number(state.anchorLng));

        if (distKm > radiusKm) {
          const pending = pendingStuckAck.get(tripId);
          if (pending?.timeoutId) clearTimeout(pending.timeoutId);
          pendingStuckAck.delete(tripId);
          stuckState.set(tripId, { anchorLat: lat, anchorLng: lng, sinceMs: Date.now(), notified: false });
          continue;
        }

        if (!state.notified && Date.now() - Number(state.sinceMs) >= 60 * 60 * 1000) {
          const user = await User.findByPk(trip.user_id);
          const assignmentId = trip.task_title || `#${trip.id}`;
          const title = "Location Alert";
          const message = `You have spent more than 1 hour at the same location.\nAssignment: ${assignmentId}\nPlease tap OK to confirm.`;

          if (user?.fcm_token) {
            sendPushNotification(user.fcm_token, title, message, { tripId: trip.id, type: "STUCK_1H" });
          }
          io.to(`trip:${trip.id}`).emit("stuckAlert", { tripId: trip.id, title, message });

          const timeoutId = setTimeout(async () => {
            const pending = pendingStuckAck.get(tripId);
            if (!pending) return;
            pendingStuckAck.delete(tripId);

            try {
              const freshTrip = await Trip.findByPk(trip.id);
              if (!freshTrip || freshTrip.current_phase !== "ACTIVE" || !freshTrip.active) {
                stuckState.delete(tripId);
                return;
              }
              const freshUser = await User.findByPk(freshTrip.user_id);
              const riderName = freshUser?.name || "Unknown Rider";
              const taskTitle = freshTrip.task_title || `#${freshTrip.id}`;
              const lat2 = freshTrip.current_lat ?? lat;
              const lng2 = freshTrip.current_lng ?? lng;

              const logMessage = `Stuck >1h (no rider ack). Rider: ${riderName}. Assignment: ${taskTitle}. Location: ${lat2}, ${lng2}`;
              await Log.create({
                assignment_id: freshTrip.id,
                type: "ALERT",
                message: logMessage.slice(0, 500),
                lat: lat2,
                lng: lng2
              });

              const adminTitle = "⏱️ STUCK ALERT: No Acknowledgement";
              const adminMessage = `Rider: ${riderName}\nAssignment: ${taskTitle}\nLocation: ${lat2}, ${lng2}\nRider did not acknowledge the 1-hour location alert.`;
              await broadcastToAdmins(adminTitle, adminMessage);
              stuckState.set(tripId, { anchorLat: Number(lat2), anchorLng: Number(lng2), sinceMs: Date.now(), notified: false });
            } catch (e) {
              console.error("Failed to escalate stuck alert:", e.message);
            }
          }, 10000);

          pendingStuckAck.set(tripId, { userId: trip.user_id, timeoutId });
          stuckState.set(tripId, { ...state, notified: true });
        } else {
          stuckState.set(tripId, state);
        }
      }
    } catch (err) {
      console.error("Stuck monitor error:", err.message);
    }
  }, 10000);
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
