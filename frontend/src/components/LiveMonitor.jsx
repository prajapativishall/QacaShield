import React, { useEffect, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../apiConfig.js";
import "../styles/MapContainer.css";

export function LiveMonitor() {
  const { token } = useAuth();
  const [activeTrips, setActiveTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const resolveHelmetUrl = (raw) => {
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/uploads")) return `${API_URL}${raw}`;
    return `${API_URL}/uploads/safety_checks/${raw.replace(/^\/+/, "")}`;
  };

  useEffect(() => {
    fetchActiveTrips();
    const interval = setInterval(fetchActiveTrips, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [token]);

  const fetchActiveTrips = async () => {
    try {
      const res = await fetch(`${API_URL}/api/assignments/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTrips(data);
      }
    } catch (err) {
      console.error("Failed to fetch active trips", err);
    } finally {
      setLoading(false);
    }
  };

  const center = { lat: 37.7749, lng: -122.4194 };

  const { isLoaded } = useJsApiLoader({
    id: "qacashield-google-maps-live",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  return (
    <div className="map-wrapper" style={{ height: "calc(100vh - 80px)" }}>
      <div className="map-container">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ height: "100%", width: "100%" }}
            center={center}
            zoom={5}
          >
            {activeTrips.map(trip => {
              const lat = trip.current_lat ?? trip.dest_lat;
              const lng = trip.current_lng ?? trip.dest_lng;
              if (!lat || !lng) return null;
              const label = trip.User?.name ? trip.User.name[0] : undefined;
              return (
                <Marker
                  key={trip.id}
                  position={{ lat, lng }}
                  label={label}
                />
              );
            })}
          </GoogleMap>
        )}
        {!isLoaded && (
          <div style={{ padding: 16 }}>Loading Google Maps…</div>
        )}
      </div>
      
      {/* Overlay List */}
      <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "white",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          zIndex: 1000,
          maxHeight: "80%",
          overflowY: "auto",
          width: "250px"
      }}>
          <h3>Active Fleet ({activeTrips.length})</h3>
          {activeTrips.length === 0 ? <p>No active assignments</p> : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                  {activeTrips.map(trip => (
                      <li key={trip.id} style={{ marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
                          <strong>{trip.User?.name || `Assignment #${trip.id}`}</strong>
                          <br/>
                          <small>{trip.current_phase}</small>
                      </li>
                  ))}
              </ul>
          )}
      </div>
    </div>
  );
}
