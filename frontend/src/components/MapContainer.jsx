import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer as LeafletMap, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useSocket } from "../hooks/useSocket.js";
import "../styles/MapContainer.css";

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

// Helper component to center map on route or position
function MapUpdater({ center, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    } else if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, bounds, map]);
  return null;
}

export function MapContainer({ viewOnly = false, routePath: propRoutePath = null, bounds: propBounds = null, markers = [] }) {
  const socket = useSocket();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [tripId, setTripId] = useState("");
  const [localRoutePath, setLocalRoutePath] = useState([]);
  const [currentPos, setCurrentPos] = useState({ lat: 37.7749, lng: -122.4194 }); // Default SF
  const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 });
  const [mapBounds, setMapBounds] = useState(null);

  // Use props if provided, otherwise local state
  const routePath = propRoutePath || localRoutePath;
  const activeBounds = propBounds || mapBounds;
  const customMarkers = markers;

  const baseUrl = useMemo(() => {
    return (
      import.meta.env.VITE_BACKEND_URL ||
      `http://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 4000}`
    );
  }, []);

  useEffect(() => {
    socket.on("tripFinalized", () => {
      console.log("Trip finalized");
    });
    return () => {
      socket.off("tripFinalized");
    };
  }, [socket]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        // Only center if we don't have a route yet
        if (routePath.length === 0) {
            setMapCenter(newPos);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [routePath]);

  const joinTripRoom = useCallback(() => {
    if (!tripId) return;
    socket.emit("joinTripRoom", String(tripId));
  }, [socket, tripId]);

  const fetchRoute = useCallback(async () => {
    if (!origin || !destination) return;
    try {
        const res = await fetch(
          `${baseUrl}/api/trips/best-route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
        );
        const data = await res.json();
        if (data.route_path && data.route_path.length > 0) {
          setLocalRoutePath(data.route_path);
          // Calculate bounds
          const lats = data.route_path.map(p => p[0]);
          const lngs = data.route_path.map(p => p[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          setMapBounds([[minLat, minLng], [maxLat, maxLng]]);
        }
    } catch (err) {
        console.error("Failed to fetch route", err);
    }
  }, [baseUrl, origin, destination]);

  return (
    <div className="map-wrapper">
      {!viewOnly && (
      <div className="controls">
        <input 
          placeholder="Trip ID" 
          value={tripId} 
          onChange={(e) => setTripId(e.target.value)} 
        />
        <button onClick={joinTripRoom}>Join Room</button>
        <div className="route-controls">
            <input 
              placeholder="Origin (e.g. New York)" 
              value={origin} 
              onChange={(e) => setOrigin(e.target.value)} 
            />
            <input 
              placeholder="Destination (e.g. Boston)" 
              value={destination} 
              onChange={(e) => setDestination(e.target.value)} 
            />
            <button onClick={fetchRoute}>Get Route</button>
        </div>
      </div>
      )}
      
      <div className="map-container">
        <LeafletMap center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} bounds={activeBounds} />
          
          <Marker position={currentPos}>
            <Popup>Current Location</Popup>
          </Marker>

          {customMarkers.map((m, idx) => (
            <Marker key={idx} position={m.position}>
              <Popup>{m.label}</Popup>
            </Marker>
          ))}

          {routePath.length > 0 && (
            <Polyline positions={routePath} color="#ff6a00" weight={5} opacity={0.9} />
          )}
        </LeafletMap>
      </div>
    </div>
  );
}
