import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { initDB, sequelize } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import apiRouter from "./routes/api.js";
import { startReturnHomeMonitor, startDestinationArrivalMonitor } from "./services/geofenceService.js";
import path from "path";
import { fileURLToPath } from "url";

// Helper for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const rawOrigins = process.env.ALLOWED_ORIGINS || "*";
let corsOrigin = "*";
if (rawOrigins !== "*" && rawOrigins.trim() !== "") {
  const list = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);
  corsOrigin = function (origin, callback) {
    if (!origin) return callback(null, true);
    if (list.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  };
}
app.use(cors({ origin: corsOrigin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve uploads statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", apiRouter);

const server = http.createServer(app);
const io = initSocket(server);

async function bootstrap() {
  await initDB();
  const enableReturnMonitor = (process.env.RETURN_HOME_MONITOR_ENABLED ?? "true") !== "false";
  const enableDestinationMonitor = (process.env.DESTINATION_ARRIVAL_MONITOR_ENABLED ?? "true") !== "false";
  if (enableReturnMonitor) {
    startReturnHomeMonitor(sequelize, io);
  } else {
    console.log("Return-home monitor disabled by env");
  }
  if (enableDestinationMonitor) {
    startDestinationArrivalMonitor(sequelize, io);
  } else {
    console.log("Destination arrival monitor disabled by env");
  }
  const port = process.env.PORT || 4000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`QacaShield backend listening on :${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
