import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";

export function useSocket() {
  const url =
    import.meta.env.VITE_BACKEND_URL ||
    `http://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 4000}`;
  const socket = useMemo(() => io(url, { transports: ["websocket"] }), [url]);
  useEffect(() => {
    return () => {
      socket.close();
    };
  }, [socket]);
  return socket;
}
