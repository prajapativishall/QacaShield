import { Trip } from "../models/Trip.js";

export async function privacyGuard(req, res, next) {
  const tripId = req.headers["x-trip-id"] || req.query.tripId || req.body.tripId;
  if (!tripId) return res.status(400).json({ error: "Missing tripId" });
  const trip = await Trip.findByPk(tripId);
  if (!trip) return res.status(404).json({ error: "Assignment not found" });
  if (!["ACTIVE", "REACHED_DESTINATION", "RETURNING_HOME"].includes(trip.current_phase)) {
    return res.status(403).json({ error: `GPS tracking blocked: assignment in phase ${trip.current_phase}` });
  }
  req.trip = trip;
  next();
}
