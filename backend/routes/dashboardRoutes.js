import { Router } from "express";
import { requireRole } from "../middleware/roleAuth.js";
import { getRecentActivities } from "../controllers/dashboardController.js";

const router = Router();

router.get("/activities", requireRole(["MANAGER", "ADMIN"]), getRecentActivities);

export default router;
