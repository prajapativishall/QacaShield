import { Router } from "express";
import { upload } from "../middleware/multerConfig.js";
import { uploadHelmetSelfie } from "../controllers/safetyController.js";
import { requireRole } from "../middleware/roleAuth.js";

const router = Router();

// Endpoint for drivers to upload safety check
// We might want to restrict this to the assigned user, but for now allow authenticated users
// or even public if coming from mobile with just tripId? 
// Better to require authentication.
router.post("/upload", upload.single("helmet_image"), uploadHelmetSelfie);

export default router;
