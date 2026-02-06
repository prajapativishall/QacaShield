import { Server } from "socket.io";

let ioInstance = null;

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  ioInstance.on("connection", (socket) => {
    socket.on("joinTripRoom", (tripId) => {
      socket.join(`trip:${tripId}`);
    });
  });
  return ioInstance;
}

export function io() {
  return ioInstance;
}
