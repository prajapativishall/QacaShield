import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";

export function startReturnHomeMonitor(sequelize, io) {
  const intervalMs = Number(process.env.RETURN_HOME_INTERVAL_MS || 10000);
  const minHits = Math.max(1, Number(process.env.RETURN_HOME_MIN_HITS || 3));
  const minSeconds = Math.max(0, Number(process.env.RETURN_HOME_MIN_SECONDS || 20));
  const inRadiusState = new Map();
  setInterval(async () => {
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
      
      // If in REACHED_DESTINATION, only auto-finalize if they have actually moved AWAY from destination first
      // OR if they are very close to home. 
      // For simplicity, if they are in REACHED_DESTINATION and within home radius, we assume they returned.
      
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
        if (inRadiusState.has(trip.id)) {
          inRadiusState.delete(trip.id);
        }
      }
    }
  }, intervalMs);
}

export function startDestinationArrivalMonitor(sequelize, io) {
  const intervalMs = Number(process.env.DESTINATION_ARRIVAL_INTERVAL_MS || 10000);
  const minHits = Math.max(1, Number(process.env.DESTINATION_ARRIVAL_MIN_HITS || 3));
  const minSeconds = Math.max(0, Number(process.env.DESTINATION_ARRIVAL_MIN_SECONDS || 20));
  // In-memory debounce state per tripId
  const inRadiusState = new Map(); // tripId -> { firstSeen: number, hits: number }
  setInterval(async () => {
    const trips = await Trip.findAll({
      where: { current_phase: "ACTIVE", active: true }
    });
    for (const trip of trips) {
      if (!trip.dest_lat || !trip.dest_lng || !trip.current_lat || !trip.current_lng) continue;

      const distKm = haversine(
        Number(trip.current_lat),
        Number(trip.current_lng),
        Number(trip.dest_lat),
        Number(trip.dest_lng)
      );

      const radiusMeters =
        typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
          ? trip.geofence_radius
          : 100;
      const radiusKm = Math.max(radiusMeters, 10) / 1000; // minimum 10m

      if (distKm <= radiusKm) {
        const now = Date.now();
        const state = inRadiusState.get(trip.id) || { firstSeen: now, hits: 0 };
        state.hits += 1;
        // Reset firstSeen if previous hit was too long ago (gap larger than 2*interval)
        if (!inRadiusState.has(trip.id)) {
          state.firstSeen = now;
        }
        inRadiusState.set(trip.id, state);

        const elapsedSec = (now - state.firstSeen) / 1000;
        if (state.hits >= minHits && elapsedSec >= minSeconds) {
          // Confirm arrival
          inRadiusState.delete(trip.id);
          trip.current_phase = "REACHED_DESTINATION";
          trip.arrival_time = new Date();
          trip.arrival_lat = trip.current_lat;
          trip.arrival_lng = trip.current_lng;
          await trip.save();
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
            console.error("Failed to log reached-destination status:", e.message);
          }
          io.to(`trip:${trip.id}`).emit("tripReachedDestination", { tripId: trip.id });
        }
      }
      else {
        // Outside geofence: clear any pending state for this trip
        if (inRadiusState.has(trip.id)) {
          inRadiusState.delete(trip.id);
        }
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
