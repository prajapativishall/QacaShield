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

function buildUserTemplates(title, message, user) {
    const appName = process.env.APP_NAME || "QacaShield";
    const brand = process.env.BRAND_NAME || appName;
    const brandColor = process.env.BRAND_COLOR || "#FF5252";
    const dashboardUrl = process.env.APP_DASHBOARD_URL || "";
    const subject = `${brand}: ${title}`;
    const text = `${title}\n\n${message}\n\n${dashboardUrl ? `Open: ${dashboardUrl}` : ""}\n— ${brand}`.trim();
    const safeName = user?.name || "Rider";
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;padding:24px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
          <tr>
            <td style="background:${brandColor};color:#ffffff;padding:16px 20px;font-size:18px;font-weight:600">
              ${brand}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 20px 8px 20px;color:#111827;font-size:18px;font-weight:700;line-height:1.3">
              ${title}
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 8px 20px;color:#374151;font-size:14px">
              Hello ${safeName},
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 16px 20px;color:#111827;font-size:15px;line-height:1.6;white-space:pre-line">
              ${message}
            </td>
          </tr>
          ${dashboardUrl ? `
          <tr>
            <td style="padding:0 20px 24px 20px">
              <a href="${dashboardUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
                Open Dashboard
              </a>
            </td>
          </tr>` : ``}
          <tr>
            <td style="padding:16px 20px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">
              © ${new Date().getFullYear()} ${brand}
            </td>
          </tr>
        </table>
      </div>
    `.trim();
    let sms = `[${brand}] ${title}: ${message}`.replace(/\s+/g, " ").trim();
    if (sms.length > 320) sms = sms.slice(0, 317) + "...";
    return { subject, text, html, sms };
}

export async function notifyUserEmailSMS(user, title, message) {
    if (!user) return;
    const tasks = [];
    const t = buildUserTemplates(title, message, user);
    if (user.email) {
        tasks.push(sendEmail(user.email, t.subject, t.text, t.html));
    }
    if (user.phone_number) {
        tasks.push(sendSMS(user.phone_number, t.sms));
    }
    await Promise.allSettled(tasks);
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
