import React, { useCallback, useEffect, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useSocket } from "../hooks/useSocket.js";
import { API_URL } from "../apiConfig.js";
import "../styles/MapContainer.css";

export function MapContainer({ viewOnly = false, routePath: propRoutePath = null, bounds: propBounds = null, markers = [] }) {
  const socket = useSocket();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [tripId, setTripId] = useState("");
  const [localRoutePath, setLocalRoutePath] = useState([]);
  const [currentPos, setCurrentPos] = useState({ lat: 37.7749, lng: -122.4194 }); // Default SF
  const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 });
  const [mapBounds, setMapBounds] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  // Use props if provided, otherwise local state
  const routePath = propRoutePath || localRoutePath;
  const activeBounds = propBounds || mapBounds;
  const customMarkers = markers;

  const baseUrl = API_URL;

  useEffect(() => {
    socket.on("tripFinalized", () => {
      console.log("Trip finalized");
    });
    return () => {
      socket.off("tripFinalized");
    };
  }, [socket]);

  const { isLoaded } = useJsApiLoader({
    id: "qacashield-google-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
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
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ height: "100%", width: "100%" }}
            center={mapCenter}
            zoom={13}
            onLoad={(map) => {
              setMapInstance(map);
              if (activeBounds) {
                const bounds = new window.google.maps.LatLngBounds();
                activeBounds.forEach(([lat, lng]) =>
                  bounds.extend({ lat, lng })
                );
                map.fitBounds(bounds);
              }
            }}
          >
            <Marker position={currentPos} />
            {customMarkers.map((m, idx) => (
              <Marker key={idx} position={m.position} label={m.label} />
            ))}
            {routePath.length > 0 && (
              <Polyline
                path={routePath.map(([lat, lng]) => ({ lat, lng }))}
                options={{ strokeColor: "#ff6a00", strokeWeight: 5 }}
              />
            )}
          </GoogleMap>
        )}
        {!isLoaded && (
          <div style={{ padding: 16 }}>Loading Google Maps…</div>
        )}
      </div>
    </div>
  );
}
