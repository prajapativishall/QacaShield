import { Router } from "express";
import { listUsers, createUser, getUserById, updateUser, deleteUser, uploadUserDoc, logExit, updateFcmToken } from "../controllers/userController.js";
import { requireRole } from "../middleware/roleAuth.js";
import { uploadUserDocs } from "../middleware/multerUserDocs.js";

const router = Router();

// Upload endpoint (needs to be before /:id to avoid conflict if :id matches "upload")
router.post("/upload", requireRole(["ADMIN", "MANAGER"]), uploadUserDocs.single("file"), uploadUserDoc);

// Exit Tracking (Any authenticated user can log exit)
router.post("/exit", requireRole([]), logExit);

// Update FCM Token (Any authenticated user)
router.post("/fcm-token", requireRole([]), updateFcmToken);

// Only Managers and Admins can see the employee list for assignment
router.get("/", requireRole(["ADMIN", "MANAGER"]), listUsers);
router.post("/", requireRole(["ADMIN", "MANAGER"]), createUser);
router.get("/:id", requireRole(["ADMIN", "MANAGER"]), getUserById);
router.put("/:id", requireRole(["ADMIN", "MANAGER"]), updateUser);
router.delete("/:id", requireRole(["ADMIN"]), deleteUser);

export default router;
