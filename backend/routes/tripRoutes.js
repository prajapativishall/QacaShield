import { Router } from "express";
import { privacyGuard } from "../middleware/privacyGuard.js";
import { requireRole } from "../middleware/roleAuth.js";
import { 
  createTrip, 
  bestRoute, 
  offlineSync, 
  updateGpsPing, 
  getMyTrips, 
  startTrip, 
  completeTrip,
  acceptTrip,
  reachDestination,
  startReturnTrip,
  listActiveTrips,
  getAssignedTripsHistory,
  getCompletedTripsCount,
  getMyCompletedTrips,
  getMyHistory,
  getCurrentLocation,
  earlyExitTrip,
  cancelTrip,
  geocode,
  geocodeSuggestionsHandler
} from "../controllers/tripController.js";
import { createAlert, getAlerts } from "../controllers/alertController.js";
import { logManagerView } from "../services/auditService.js";

const router = Router();

router.post("/", requireRole(["MANAGER", "ADMIN"]), createTrip);
router.get("/my-trips", requireRole([]), getMyTrips);
router.get("/my-completed", requireRole([]), getMyCompletedTrips);
router.get("/my-history", requireRole([]), getMyHistory);
router.get("/current-location", requireRole(["MANAGER", "ADMIN"]), getCurrentLocation);
router.get("/active", requireRole(["MANAGER", "ADMIN"]), listActiveTrips);
router.get("/completed/count", requireRole(["MANAGER", "ADMIN"]), getCompletedTripsCount);
router.get("/assigned-history", requireRole(["MANAGER", "ADMIN"]), getAssignedTripsHistory);
router.post("/start", requireRole(["USER", "MANAGER", "ADMIN"]), startTrip);
router.post("/accept", requireRole(["USER", "MANAGER", "ADMIN"]), acceptTrip);
router.post("/reach-destination", requireRole(["USER", "MANAGER", "ADMIN"]), reachDestination);
router.post("/return-home", requireRole(["USER", "MANAGER", "ADMIN"]), startReturnTrip);
router.post("/complete", requireRole(["USER", "MANAGER", "ADMIN"]), completeTrip);
router.post("/early-exit", requireRole(["USER", "MANAGER", "ADMIN"]), earlyExitTrip);
router.post("/cancel", requireRole(["ADMIN"]), cancelTrip);
router.get("/best-route", bestRoute);
router.get("/geocode", geocode);
router.get("/geocode-suggestions", geocodeSuggestionsHandler);
router.get("/offline-sync", offlineSync);
router.post("/gps-ping", privacyGuard, updateGpsPing);
router.post("/alert", createAlert);
router.get("/alerts", requireRole(["MANAGER", "ADMIN"]), getAlerts); // New endpoint for dashboard
router.get(
  "/manager/view/:tripId",
  requireRole(["MANAGER", "ADMIN"]),
  async (req, res) => {
    await logManagerView(0, `trip:${req.params.tripId}`, { ip: req.ip });
    res.json({ ok: true });
  }
);

export default router;
