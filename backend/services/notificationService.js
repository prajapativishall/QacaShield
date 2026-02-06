import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isInitialized = false;

// Try to load service account
// Expects serviceAccountKey.json in backend/config/ folder
// You can download this from Firebase Console -> Project Settings -> Service Accounts
try {
    const serviceAccountPath = path.join(__dirname, "../config/serviceAccountKey.json");
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isInitialized = true;
        console.log("Firebase Admin initialized successfully.");
    } else {
        console.warn("Warning: backend/config/serviceAccountKey.json not found. Push notifications will be disabled.");
    }
} catch (error) {
    console.error("Error initializing Firebase Admin:", error);
}

export async function sendPushNotification(token, title, body, data = {}) {
    if (!isInitialized) {
        console.log("Skipping push notification (Firebase not initialized)");
        return;
    }

    if (!token) {
        console.log("Skipping push notification (No token provided)");
        return;
    }

    // Ensure data values are strings
    const stringData = {};
    for (const key in data) {
        stringData[key] = String(data[key]);
    }

    const message = {
        notification: {
            title: title,
            body: body,
        },
        data: {
            ...stringData,
            click_action: "FLUTTER_NOTIFICATION_CLICK"
        },
        token: token
    };

    try {
        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
        return response;
    } catch (error) {
        console.error("Error sending message:", error);
        // Don't throw, just log, so we don't break the main flow
    }
}
