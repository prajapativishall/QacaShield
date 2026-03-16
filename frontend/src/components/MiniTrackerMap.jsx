import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer as LeafletMap, TileLayer, Polyline, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const bikeSvg = encodeURIComponent(`
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="5.5" cy="17.5" r="3.5"></circle>
  <circle cx="18.5" cy="17.5" r="3.5"></circle>
  <path d="M5.5 17.5L9 10h4l2 4h3"></path>
  <path d="M10 10l1.5-3.5H14"></path>
</svg>`);

const bikeIcon = new L.DivIcon({
  html: `<img src="data:image/svg+xml;utf8,${bikeSvg}" style="transform: translate(-50%, -50%);" />`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function MiniTrackerMap({ lat, lng }) {
  const initial = useMemo(() => ({ lat: lat ?? 28.6139, lng: lng ?? 77.2090 }), []); // Default Delhi
  const [displayPos, setDisplayPos] = useState(initial);
  const [trail, setTrail] = useState([initial]);
  const animRef = useRef(null);
  const lastTargetRef = useRef({ lat, lng });

  useEffect(() => {
    const target = { lat: lat ?? displayPos.lat, lng: lng ?? displayPos.lng };
    if (lastTargetRef.current.lat === target.lat && lastTargetRef.current.lng === target.lng) return;
    lastTargetRef.current = target;
    const duration = 800; // ms
    const steps = 24;
    const start = performance.now();
    const from = { ...displayPos };

    const tick = (t) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / duration);
      // ease-out quad
      const e = 1 - (1 - p) * (1 - p);
      const next = {
        lat: from.lat + (target.lat - from.lat) * e,
        lng: from.lng + (target.lng - from.lng) * e,
      };
      setDisplayPos(next);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        // finalize and update trail (keep last N)
        setTrail((prev) => {
          const updated = [...prev, target];
          const max = 25;
          return updated.slice(Math.max(0, updated.length - max));
        });
      }
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
    return () => animRef.current && cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div style={{ width: 260, height: 160 }}>
      <LeafletMap
        center={[displayPos.lat, displayPos.lng]}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution=""
        />
        {trail.length > 1 && (
          <Polyline
            positions={trail.map((p) => [p.lat, p.lng])}
            color="#ef4444"
            weight={4}
            opacity={0.6}
          />
        )}
        <Marker position={[displayPos.lat, displayPos.lng]} icon={bikeIcon} />
      </LeafletMap>
    </div>
  );
}

