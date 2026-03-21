import { Trip } from "../models/Trip.js";
import { User } from "../models/User.js";
import { Log } from "../models/Log.js";
import { fetchBestRoutePolyline, getRouteFromCoords, geocodeAddress, geocodeSuggestions } from "../services/routingService.js";
import { sendPushNotification, broadcastToAdmins } from "../services/notificationService.js";

// Helper for status notifications
async function notifyStatusChange(trip, status) {
  try {
    const user = await User.findByPk(trip.user_id);
    const title = `Assignment Update: ${status}`;
    const message = `Assignment: ${trip.task_title || `#${trip.id}`}\nRider: ${user?.name || "Unknown"}\nNew Status: ${status}`;
    
    // Notify Admin
    broadcastToAdmins(title, message);
    
    // Notify User via Push
    if (user?.fcm_token) {
      await sendPushNotification(user.fcm_token, title, message, { tripId: trip.id });
    }
  } catch (err) {
    console.error("Failed to send status notification:", err.message);
  }
}
import { Op } from "sequelize";

export async function createTrip(req, res) {
  let { 
    user_id, 
    origin_lat, 
    origin_lng, 
    dest_lat, 
    dest_lng, 
    destination_address,
    home_lat, 
    home_lng,
    route_polyline,
    task_title,
    priority,
    geofence_radius,
    route_optimization,
    expected_start_time,
    buffer_time
  } = req.body;

  // Geocode destination if coordinates are missing but address is provided
  if ((!dest_lat || !dest_lng) && destination_address) {
      console.log(`Geocoding destination address: ${destination_address}`);
      const coords = await geocodeAddress(destination_address);
      if (coords) {
          dest_lat = coords.lat;
          dest_lng = coords.lon;
      } else {
          // If geocoding fails, we can't create a valid trip without destination coordinates
          return res.status(400).json({ error: "Could not locate destination address. Please use the Preview button to verify." });
      }
  } else if (!dest_lat || !dest_lng) {
      return res.status(400).json({ error: "Destination required" });
  }

  console.log(`Creating trip with Dest: ${destination_address} (${dest_lat}, ${dest_lng})`);

  // Generate Assignment ID Logic
  const user = await User.findByPk(user_id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let empSuffix = "00";
  if (user.employee_id) {
      const strId = String(user.employee_id);
      empSuffix = strId.length >= 2 ? strId.slice(-2) : strId.padStart(2, '0');
  }

  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const mm = pad(now.getMinutes());
  const dd = pad(now.getDate());
  const MM = pad(now.getMonth() + 1);
  const yy = String(now.getFullYear()).slice(-2);

  // Format: [Last 2 digits of Emp ID] + [Minutes] + [Day] + [Month] + [Year]
  task_title = `${empSuffix}${mm}${dd}${MM}${yy}`;

  const trip = await Trip.create({
    user_id,
    assigned_by: req.user.id,
    origin_lat,
    origin_lng,
    dest_lat,
    dest_lng,
    destination_address,
    home_lat,
    home_lng,
    route_polyline,
    task_title,
    priority,
    geofence_radius,
    route_optimization,
    expected_start_time,
    buffer_time,
    current_phase: "PENDING", // Changed from PLANNED
    active: false,
    is_safety_verified: false
  });

  // Send Push Notification
  try {
    if (user && user.fcm_token) {
      await sendPushNotification(
        user.fcm_token,
        "New Assignment",
        `You have a new assignment: ${task_title}`,
        { tripId: trip.id }
      );
    }
  } catch (notifError) {
    console.error("Failed to send push notification:", notifError);
  }

  try {
    const assignmentId = trip.task_title || `#${trip.id}`;
    await Log.create({
      assignment_id: trip.id,
      type: "STATUS",
      message: `Assignment ${assignmentId} created`
    });
  } catch (e) {
    console.error("Failed to log assignment creation:", e.message);
  }

  notifyStatusChange(trip, "Assignment Created (PENDING)");

  res.status(201).json({ id: trip.id });
}

export async function getMyTrips(req, res) {
  const userId = req.user.id;
  const trips = await Trip.findAll({
    where: { 
      user_id: userId,
      current_phase: { [Op.notIn]: ["COMPLETED", "FINALIZED", "CANCELLED"] },
      [Op.or]: [
        { active: true },
        { current_phase: "PENDING" },
        { current_phase: "ACCEPTED" },
        { current_phase: "PLANNED" } // Keep PLANNED for backward compatibility if needed
      ]
    },
    order: [['created_at', 'DESC']]
  });
  res.json(trips);
}

export async function listActiveTrips(req, res) {
  const trips = await Trip.findAll({
    where: { 
      [Op.or]: [
        { active: true },
        { current_phase: { [Op.in]: ["PENDING", "ACCEPTED", "PLANNED"] } }
      ]
    },
    order: [['created_at', 'DESC']],
    include: [{ association: "User", attributes: ["name", "email"] }]
  });
  res.json(trips);
}

export async function getCompletedTripsCount(req, res) {
  try {
    const count = await Trip.count({
      where: { 
        [Op.or]: [
            { current_phase: "COMPLETED" },
            { current_phase: "FINALIZED" }
        ]
      }
    });
    res.json({ count });
  } catch (error) {
    console.error("Error fetching completed trips count:", error);
    res.status(500).json({ error: "Failed to fetch completed trips count" });
  }
}

export async function getMyCompletedTrips(req, res) {
  try {
    const userId = req.user.id;
    const trips = await Trip.findAll({
      where: {
        user_id: userId,
        current_phase: { [Op.in]: ["COMPLETED", "FINALIZED"] }
      },
      order: [["actual_end_time", "DESC"]],
      limit: 100
    });
    res.json(trips);
  } catch (error) {
    console.error("Error fetching completed assignments:", error);
    res.status(500).json({ error: "Failed to fetch completed assignments" });
  }
}

export async function getMyHistory(req, res) {
  try {
    const userId = req.user.id;
    const { year, month } = req.query;
    const where = {
      user_id: userId,
      current_phase: { [Op.in]: ["COMPLETED", "FINALIZED", "CANCELLED"] }
    };
    if (year && String(year).trim() !== "") {
      const y = Number(year);
      if (!Number.isNaN(y) && y > 1970) {
        const m = Number(month);
        if (!Number.isNaN(m) && m >= 1 && m <= 12) {
          const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
          const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
          where.actual_end_time = { [Op.between]: [start, end] };
        } else {
          const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
          const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
          where.actual_end_time = { [Op.between]: [start, end] };
        }
      }
    }
    const trips = await Trip.findAll({
      where,
      order: [["actual_end_time", "DESC"], ["created_at", "DESC"]],
      limit: 500
    });
    res.json(trips);
  } catch (error) {
    console.error("Error fetching assignment history:", error);
    res.status(500).json({ error: "Failed to fetch assignment history" });
  }
}
export async function acceptTrip(req, res) {
  try {
    const { tripId } = req.body;
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });

    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (trip.current_phase !== "PENDING" && trip.current_phase !== "PLANNED") {
      return res.status(400).json({ error: "Assignment is not pending acceptance" });
    }

    trip.current_phase = "ACCEPTED";
    await trip.save();

    notifyStatusChange(trip, "Assignment Accepted");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} accepted`
      });
    } catch (e) {
      console.error("Failed to log accept status:", e.message);
    }

    res.json({ ok: true, message: "Assignment accepted successfully" });
  } catch (error) {
    console.error("Error accepting trip:", error);
    res.status(500).json({ error: "Failed to accept trip" });
  }
}

export async function getCurrentLocation(req, res) {
  try {
    const { tripId } = req.query;
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });
    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });
    return res.json({
      tripId: trip.id,
      current_lat: trip.current_lat,
      current_lng: trip.current_lng,
      current_phase: trip.current_phase,
      active: trip.active,
      updated_at: trip.updated_at
    });
  } catch (error) {
    console.error("Error fetching current location:", error);
    res.status(500).json({ error: "Failed to fetch current location" });
  }
}
export async function startTrip(req, res) {
  try {
    const { tripId, lat, lng } = req.body; // or req.params
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });

    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (trip.current_phase === "ACTIVE") {
      return res.json({ message: "Assignment already active", ok: true });
    }

    // Safety Check Enforcement
    if (!trip.helmet_image_url || !trip.is_safety_verified) {
      return res.status(403).json({ 
        error: "Safety check incomplete: Helmet verification required." 
      });
    }

    // Update Origin if provided (from Mobile App Start Trip)
    if (lat && lng) {
        // If home location not set, use the first start location as home base
        if (!trip.home_lat || !trip.home_lng) {
            trip.home_lat = lat;
            trip.home_lng = lng;
        }

        trip.origin_lat = lat;
        trip.origin_lng = lng;

        // Calculate route if destination exists
        if (trip.dest_lat && trip.dest_lng) {
            const { polyline } = await getRouteFromCoords(lat, lng, trip.dest_lat, trip.dest_lng);
            if (polyline) {
                trip.route_polyline = polyline;
            }
        }
    }

    trip.current_phase = "ACTIVE";
    trip.active = true;
    trip.actual_start_time = new Date();
    await trip.save();

    notifyStatusChange(trip, "Assignment Started (ACTIVE)");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} started`
      });
    } catch (e) {
      console.error("Failed to log start status:", e.message);
    }

    res.json({ ok: true, message: "Assignment started successfully" });
  } catch (error) {
    console.error("Error starting trip:", error);
    res.status(500).json({ error: "Failed to start trip" });
  }
}

export async function completeTrip(req, res) {
  try {
    const { tripId, lat, lng } = req.body;
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });

    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (trip.current_phase === "COMPLETED" || trip.current_phase === "FINALIZED") {
      return res.json({ ok: true, message: "Assignment already completed" });
    }

    // Allow completion from RETURNING_HOME or REACHED_DESTINATION (for manual override)
    if (trip.current_phase !== "RETURNING_HOME" && trip.current_phase !== "REACHED_DESTINATION") {
      return res.status(400).json({ error: "Assignment must be in 'RETURNING_HOME' or 'REACHED_DESTINATION' phase to complete." });
    }

    trip.current_phase = "COMPLETED";
    trip.active = false;
    trip.actual_end_time = new Date();
    
    if (lat && lng) {
      trip.completed_lat = lat;
      trip.completed_lng = lng;
    }

    await trip.save();

    notifyStatusChange(trip, "Assignment Completed");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} completed`,
        lat: lat,
        lng: lng
      });
    } catch (e) {
      console.error("Failed to log completion status:", e.message);
    }

    res.json({ ok: true, message: "Assignment completed successfully" });
  } catch (error) {
    console.error("Error completing trip:", error);
    res.status(500).json({ error: "Failed to complete trip" });
  }
}

export async function earlyExitTrip(req, res) {
  try {
    const { tripId, reason, lat, lng } = req.body;
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Missing exit reason" });
    }

    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (trip.current_phase === "COMPLETED" || trip.current_phase === "FINALIZED") {
      return res.json({ ok: true, message: "Assignment already completed" });
    }

    let atDestination = trip.current_phase === "REACHED_DESTINATION";

    if (!atDestination && lat !== undefined && lng !== undefined && trip.dest_lat && trip.dest_lng) {
      const distKm = haversineKm(
        Number(lat),
        Number(lng),
        Number(trip.dest_lat),
        Number(trip.dest_lng)
      );
      const radiusMeters =
        typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
          ? trip.geofence_radius
          : 100;
      const radiusKm = Math.max(radiusMeters, 10) / 1000;
      if (distKm <= radiusKm) {
        atDestination = true;
      }
    }

    if (!atDestination) {
      return res.status(400).json({ error: "Assignment must be at destination for early exit" });
    }

    trip.exit_reason = reason;
    trip.current_phase = "COMPLETED";
    trip.active = false;
    trip.actual_end_time = new Date();
    if (lat && lng) {
      trip.completed_lat = lat;
      trip.completed_lng = lng;
    }
    if (!trip.arrival_time) {
      trip.arrival_time = new Date();
      if (lat && lng) {
        trip.arrival_lat = lat;
        trip.arrival_lng = lng;
      }
    }
    await trip.save();

    notifyStatusChange(trip, `Assignment Early Exit: ${reason}`);

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} marked early exit (${reason})`,
        lat: lat,
        lng: lng
      });
    } catch (e) {
      console.error("Failed to log early-exit status:", e.message);
    }

    res.json({ ok: true, message: "Assignment marked as early exit" });
  } catch (error) {
    console.error("Error marking early exit:", error);
    res.status(500).json({ error: "Failed to mark early exit" });
  }
}

export async function cancelTrip(req, res) {
  try {
    const { tripId } = req.body;
    if (!tripId) return res.status(400).json({ error: "Missing tripId" });

    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (["COMPLETED", "FINALIZED", "CANCELLED"].includes(trip.current_phase)) {
      return res.status(400).json({ error: "Assignment is already finished" });
    }

    trip.current_phase = "CANCELLED";
    trip.active = false;
    trip.actual_end_time = new Date();
    await trip.save();

    notifyStatusChange(trip, "Assignment Cancelled");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} cancelled`
      });
    } catch (e) {
      console.error("Failed to log cancel status:", e.message);
    }

    res.json({ ok: true, message: "Assignment cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling assignment:", error);
    res.status(500).json({ error: "Failed to cancel assignment: " + error.message });
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function reachDestination(req, res) {
  try {
    const { tripId, lat, lng } = req.body;
    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Assignment not found" });

    if (trip.current_phase !== "ACTIVE") {
      return res.status(400).json({ error: "Assignment must be ACTIVE to reach destination" });
    }

    if (lat !== undefined && lng !== undefined && trip.dest_lat && trip.dest_lng) {
      const distKm = haversineKm(
        Number(lat),
        Number(lng),
        Number(trip.dest_lat),
        Number(trip.dest_lng)
      );
      const radiusMeters =
        typeof trip.geofence_radius === "number" && !Number.isNaN(trip.geofence_radius)
          ? trip.geofence_radius
          : 100;
      const radiusKm = Math.max(radiusMeters, 10) / 1000; // enforce minimum 10m
      if (distKm > radiusKm) {
        return res.status(400).json({ error: "Too far from destination to mark arrival" });
      }
    }

    trip.current_phase = "REACHED_DESTINATION";
    trip.arrival_time = new Date();
    if (lat && lng) {
      trip.arrival_lat = lat;
      trip.arrival_lng = lng;
    }
    // Keep active = true because assignment isn't over
    await trip.save();

    notifyStatusChange(trip, "Rider Reached Destination");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} reached destination`,
        lat: lat,
        lng: lng
      });
    } catch (e) {
      console.error("Failed to log reached-destination status:", e.message);
    }

    res.json({ ok: true, message: "Reached destination" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function startReturnTrip(req, res) {
  try {
    const { tripId, lat, lng } = req.body;
    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (trip.current_phase !== "REACHED_DESTINATION") {
      return res.status(400).json({ error: "Must reach destination first" });
    }

    // Update coordinates for return leg
    // Current location becomes Origin
    trip.origin_lat = lat; 
    trip.origin_lng = lng;

    // Home becomes Destination
    trip.dest_lat = trip.home_lat;
    trip.dest_lng = trip.home_lng;
    trip.destination_address = "Returning Home";

    // Recalculate route if possible (simplified here, ideally call route service)
    const { polyline } = await fetchBestRoutePolyline(
        `${lat},${lng}`, 
        `${trip.home_lat},${trip.home_lng}`
    );
    trip.route_polyline = polyline;
    trip.return_time = new Date();
    trip.current_phase = "RETURNING_HOME";
    await trip.save();

    notifyStatusChange(trip, "Rider Started Return Trip");

    try {
      const assignmentId = trip.task_title || `#${trip.id}`;
      await Log.create({
        assignment_id: trip.id,
        type: "STATUS",
        message: `Assignment ${assignmentId} started return trip`
      });
    } catch (e) {
      console.error("Failed to log return-trip status:", e.message);
    }

    res.json({ ok: true, message: "Return trip started" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to start return trip" });
  }
}

export async function geocode(req, res) {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Missing address" });
    const coords = await geocodeAddress(address);
    if (!coords) return res.status(404).json({ error: "Address not found" });
    res.json(coords);
}

export async function geocodeSuggestionsHandler(req, res) {
    try {
        const { address } = req.query;
        if (!address) return res.status(400).json({ error: "Missing address" });
        const results = await geocodeSuggestions(address);
        res.json(results);
    } catch (error) {
        console.error("Error fetching geocode suggestions:", error);
        res.status(500).json({ error: "Failed to fetch address suggestions" });
    }
}

export async function bestRoute(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) return res.status(400).json({ error: "Missing origin/destination" });
  const { polyline, route_path } = await fetchBestRoutePolyline(origin, destination);
  res.json({ route_polyline: polyline, route_path });
}

export async function offlineSync(req, res) {
  const { tripId } = req.query;
  const trip = await Trip.findByPk(tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json({
    route_polyline: trip.route_polyline,
    home_coordinates: { lat: trip.home_lat, lng: trip.home_lng }
  });
}

export async function updateGpsPing(req, res) {
  const { lat, lng } = req.body;
  const trip = req.trip;
  trip.current_lat = lat;
  trip.current_lng = lng;
  await trip.save();
  res.json({ ok: true });
}

export async function getAssignedTripsHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 200;

    if (!User) {
        throw new Error("User model import failed");
    }

    // Check associations
    if (!Trip.associations.User) {
        console.warn("Trip model missing User association! Attempting to fix...");
        try {
            Trip.belongsTo(User, { foreignKey: 'user_id' });
            User.hasMany(Trip, { foreignKey: 'user_id' });
        } catch (assocError) {
            console.error("Failed to re-establish association:", assocError);
        }
    }

    if (!Trip.associations.Assigner) {
        try {
             Trip.belongsTo(User, { as: 'Assigner', foreignKey: 'assigned_by' });
        } catch (e) {
            console.error("Failed to add Assigner association:", e);
        }
    }

    const trips = await Trip.findAll({
      order: [['created_at', 'DESC']],
      limit,
      include: [
        { 
          model: User, 
          attributes: ['id', 'name', 'email'] 
        },
        {
          model: User,
          as: 'Assigner',
          attributes: ['name', 'email']
        }
      ],
    });
    res.json(trips);
  } catch (error) {
    console.error("Error fetching trip history:", error);
    res.status(500).json({ error: "Failed to fetch trip history: " + error.message });
  }
}
