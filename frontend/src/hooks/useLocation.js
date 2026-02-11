import { useEffect } from "react";
import { API_URL } from "../apiConfig";

export function useLocation(tripId) {
  useEffect(() => {
    if (!("geolocation" in navigator) || !tripId) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          await fetch(`${API_URL}/api/trips/gps-ping`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-trip-id": String(tripId)
            },
            body: JSON.stringify({ lat: latitude, lng: longitude })
          });
        } catch (e) {
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tripId]);
}
