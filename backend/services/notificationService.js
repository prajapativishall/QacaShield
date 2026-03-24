import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import nodemailer from "nodemailer";
import twilio from "twilio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Push ---
let isFirebaseInitialized = false;
try {
    const serviceAccountPath = path.join(__dirname, "../config/serviceAccountKey.json");
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
        console.log("Firebase Admin initialized successfully.");
    } else {
        console.warn("Warning: backend/config/serviceAccountKey.json not found. Push notifications will be limited.");
    }
} catch (error) {
    console.error("Error initializing Firebase Admin:", error);
}

// --- Email (Nodemailer) ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- Twilio (SMS & WhatsApp) ---
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// --- Exported Functions ---

export async function sendPushNotification(token, title, body, data = {}) {
    if (!isFirebaseInitialized) return;
    if (!token) return;

    const stringData = {};
    for (const key in data) {
        stringData[key] = String(data[key]);
    }

    const message = {
        notification: { title, body },
        data: { ...stringData, click_action: "FLUTTER_NOTIFICATION_CLICK" },
        token
    };

    try {
        return await admin.messaging().send(message);
    } catch (error) {
        console.error("Error sending push notification:", error.message);
    }
}

export async function sendEmail(to, subject, text, html) {
    if (!process.env.EMAIL_USER) return;
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            text,
            html,
        });
        console.log("Email sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error.message);
    }
}

export async function sendSMS(to, body) {
    if (!twilioClient || !process.env.TWILIO_FROM_PHONE) return;
    try {
        const message = await twilioClient.messages.create({
            body,
            from: process.env.TWILIO_FROM_PHONE,
            to,
        });
        console.log("SMS sent:", message.sid);
        return message;
    } catch (error) {
        console.error("Error sending SMS:", error.message);
    }
}

export async function sendWhatsApp(to, body) {
    if (!twilioClient) {
        console.error("Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
        return;
    }
    
    let from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) {
        console.error("TWILIO_WHATSAPP_FROM not set in .env");
        return;
    }

    // Ensure 'from' starts with 'whatsapp:'
    if (!from.startsWith('whatsapp:')) {
        from = `whatsapp:${from}`;
    }

    // Ensure 'to' starts with 'whatsapp:'
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
        console.log(`Attempting to send WhatsApp from ${from} to ${toFormatted}`);
        const message = await twilioClient.messages.create({
            body,
            from: from,
            to: toFormatted,
        });
        console.log("WhatsApp sent successfully. SID:", message.sid);
        return message;
    } catch (error) {
        console.error("Error sending WhatsApp via Twilio:", error.message);
        if (error.code === 21608) {
            console.error("Twilio Sandbox Error: The 'to' number is not verified in your Twilio Sandbox.");
        }
    }
}

/**
 * Broadcast notification to all configured admin channels
 */
export async function broadcastToAdmins(title, message) {
    const adminEmails = process.env.ADMIN_EMAILS;
    const adminPhones = process.env.ADMIN_PHONES;
    const adminWhatsApp = process.env.ADMIN_WHATSAPP;

    const fullMessage = `${title}\n\n${message}`;

    const tasks = [];

    if (adminEmails) {
        tasks.push(sendEmail(adminEmails, title, fullMessage));
    }

    if (adminPhones) {
        adminPhones.split(',').forEach(phone => {
            tasks.push(sendSMS(phone.trim(), fullMessage));
        });
    }

    if (adminWhatsApp) {
        adminWhatsApp.split(',').forEach(wa => {
            tasks.push(sendWhatsApp(wa.trim(), fullMessage));
        });
    }

    await Promise.allSettled(tasks);
}

