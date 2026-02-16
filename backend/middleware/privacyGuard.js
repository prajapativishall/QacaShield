import { Trip } from "../models/Trip.js";

export async function privacyGuard(req, res, next) {
  const tripId = req.headers["x-trip-id"] || req.query.tripId || req.body.tripId;
  if (!tripId) return res.status(400).json({ error: "Missing tripId" });
  const trip = await Trip.findByPk(tripId);
  if (!trip) return res.status(404).json({ error: "Assignment not found" });
  if (trip.current_phase !== "ACTIVE") {
    return res.status(403).json({ error: "GPS tracking blocked: assignment not ACTIVE" });
  }
  req.trip = trip;
  next();
}
