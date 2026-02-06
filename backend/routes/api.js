import { Router } from "express";
import authRoutes from "./authRoutes.js";
import tripRoutes from "./tripRoutes.js";
import userRoutes from "./userRoutes.js";
import safetyRoutes from "./safetyRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/trips", tripRoutes);
router.use("/users", userRoutes);
router.use("/safety", safetyRoutes);
router.use("/dashboard", dashboardRoutes);


export default router;
