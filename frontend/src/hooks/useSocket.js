import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../apiConfig";

export function useSocket() {
  const url = API_URL;
  const socket = useMemo(() => io(url, { transports: ["websocket"] }), [url]);
  useEffect(() => {
    return () => {
      socket.close();
    };
  }, [socket]);
  return socket;
}
