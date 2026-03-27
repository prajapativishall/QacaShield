import React, { useEffect, useState, useMemo } from "react";
import { MapContainer as LeafletMap, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../apiConfig.js";
import "../styles/MapContainer.css"; // Reuse map styles

// Fix Leaflet marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export function LiveMonitor() {
  const { token } = useAuth();
  const [activeTrips, setActiveTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatTime = (ts) => {
    if (!ts) return "N/A";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleTimeString();
  };

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

  const center = { lat: 37.7749, lng: -122.4194 }; // Default center

  return (
    <div className="map-wrapper" style={{ height: "calc(100vh - 80px)" }}>
      <div className="map-container">
        <LeafletMap center={center} zoom={5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {activeTrips.map(trip => {
             const lat = trip.current_lat ?? trip.dest_lat;
             const lng = trip.current_lng ?? trip.dest_lng;
             return (lat && lng) ? (
                <Marker 
                  key={trip.id} 
                  position={[lat, lng]}
                >
                  <Popup>
                    <div style={{ minWidth: "200px" }}>
                      <h3>Assignment #{trip.id}</h3>
                      <p><strong>Driver:</strong> {trip.User?.name || "Unknown"}</p>
                      <p><strong>Status:</strong> {trip.current_phase}</p>
                      {trip.is_safety_verified ? (
                         <div style={{ marginTop: "10px" }}>
                            <div style={{ 
                                background: "#e8f5e9", 
                                color: "#2e7d32", 
                                padding: "4px", 
                                borderRadius: "4px", 
                                marginBottom: "8px",
                                textAlign: "center",
                                fontWeight: "bold"
                            }}>
                                ✅ Safety Verified
                            </div>
                            {(trip.helmet_start_image_url || trip.helmet_return_image_url || trip.helmet_image_url) && (
                              <>
                                {trip.helmet_start_image_url && resolveHelmetUrl(trip.helmet_start_image_url) && (
                                  <div style={{ marginBottom: "8px" }}>
                                    <strong style={{ fontSize: "0.8rem" }}>Start of Assignment</strong>
                                    <div style={{ 
                                      marginTop: "4px",
                                      borderRadius: "6px",
                                      overflow: "hidden",
                                      border: "1px solid #ddd",
                                      background: "#000"
                                    }}>
                                      <img
                                        src={resolveHelmetUrl(trip.helmet_start_image_url)}
                                        alt="Helmet Start"
                                        style={{ 
                                          display: "block",
                                          maxWidth: "100%",
                                          maxHeight: "160px",
                                          width: "auto",
                                          height: "auto",
                                          objectFit: "contain"
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {trip.helmet_return_image_url && resolveHelmetUrl(trip.helmet_return_image_url) && (
                                  <div>
                                    <strong style={{ fontSize: "0.8rem" }}>Return to Source</strong>
                                    <div style={{ 
                                      marginTop: "4px",
                                      borderRadius: "6px",
                                      overflow: "hidden",
                                      border: "1px solid #ddd",
                                      background: "#000"
                                    }}>
                                      <img
                                        src={resolveHelmetUrl(trip.helmet_return_image_url)}
                                        alt="Helmet Return"
                                        style={{ 
                                          display: "block",
                                          maxWidth: "100%",
                                          maxHeight: "160px",
                                          width: "auto",
                                          height: "auto",
                                          objectFit: "contain"
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {!trip.helmet_start_image_url && !trip.helmet_return_image_url && trip.helmet_image_url && resolveHelmetUrl(trip.helmet_image_url) && (
                                  <div style={{ 
                                    marginTop: "4px",
                                    borderRadius: "6px",
                                    overflow: "hidden",
                                    border: "1px solid #ddd",
                                    background: "#000"
                                  }}>
                                    <img
                                      src={resolveHelmetUrl(trip.helmet_image_url)}
                                      alt="Helmet"
                                      style={{ 
                                        display: "block",
                                        maxWidth: "100%",
                                        maxHeight: "160px",
                                        width: "auto",
                                        height: "auto",
                                        objectFit: "contain"
                                      }}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            <small style={{ display: "block", marginTop: "4px", color: "#666" }}>
                                Verified at: {formatTime(trip.updatedAt || trip.updated_at)}
                            </small>
                         </div>
                      ) : (
                          <div style={{ color: "red", fontWeight: "bold" }}>⚠️ Safety Check Pending</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
             ) : null;
          })}
        </LeafletMap>
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
