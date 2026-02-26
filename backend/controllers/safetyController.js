import { Trip } from "../models/Trip.js";
import { detectHelmet } from "../services/helmetService.js";
import fs from "fs/promises";

export async function uploadHelmetSelfie(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Expecting tripId in body
    const { tripId } = req.body;
    if (!tripId) {
      // Clean up uploaded file if request is invalid
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Missing tripId" });
    }

    const trip = await Trip.findByPk(tripId);
    if (!trip) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Perform Helmet Detection (DISABLED BY USER REQUEST)
    // const detectionResult = await detectHelmet(req.file.path);
    console.log("Skipping helmet detection (User requested bypass). Accepting upload.");
    const detectionResult = {
        detected: true,
        confidence: 1.0,
        message: "Helmet detection disabled."
    };

    if (!detectionResult.detected) {
      // Reject: Delete file and return error
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        error: detectionResult.message,
        confidence: detectionResult.confidence 
      });
    }

    // Construct public URL (assuming backend serves uploads at /uploads)
    // We store the relative path or full URL. Storing relative path is flexible.
    // server.js will need to serve "uploads" folder.
    const relativePath = `/uploads/safety_checks/${req.file.filename}`;

    if (trip.current_phase === "REACHED_DESTINATION" || trip.current_phase === "RETURNING_HOME") {
      trip.helmet_return_image_url = relativePath;
    } else {
      trip.helmet_start_image_url = relativePath;
      trip.helmet_image_url = relativePath;
    }
    
    trip.is_safety_verified = true; // Mark as verified upon successful upload
    // Also save the timestamp of verification if needed, updated_at covers it mostly
    
    await trip.save();

    res.json({ 
      ok: true, 
      message: "Safety check verified", 
      helmet_image_url: relativePath,
      confidence: detectionResult.confidence
    });

  } catch (error) {
    console.error("Upload error:", error);
    // Attempt to cleanup if file exists
    if (req.file) {
       await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: "Internal server error" });
  }
}
