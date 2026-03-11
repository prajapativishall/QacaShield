import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";

export function startReturnHomeMonitor(sequelize, io) {
  const intervalMs = Number(process.env.RETURN_HOME_INTERVAL_MS || 10000);
  setInterval(async () => {
    const trips = await Trip.findAll({
      where: { current_phase: "RETURNING_HOME", active: true }
    });
    for (const trip of trips) {
      if (!trip.home_lat || !trip.home_lng || !trip.current_lat || !trip.current_lng) continue;
      const dist = haversine(
        Number(trip.current_lat),
        Number(trip.current_lng),
        Number(trip.home_lat),
        Number(trip.home_lng)
      );
      const radiusMeters =
        typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
          ? trip.geofence_radius
          : 100;
      const radiusKm = Math.max(radiusMeters, 10) / 1000; // minimum 10m
      if (dist <= radiusKm) {
        trip.current_phase = "FINALIZED";
        trip.active = false;
        trip.actual_end_time = new Date();
        await trip.save();
        try {
          const assignmentId = trip.task_title || `#${trip.id}`;
          await Log.create({
            assignment_id: trip.id,
            type: "STATUS",
            message: `Assignment ${assignmentId} finalized (auto return home)`
          });
        } catch (e) {
          console.error("Failed to log finalized status:", e.message);
        }
        io.to(`trip:${trip.id}`).emit("tripFinalized", { tripId: trip.id });
      }
    }
  }, intervalMs);
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
