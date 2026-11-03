import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom marker icons
const createIcon = (color, emoji) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 36px; height: 36px;
      background: ${color};
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      border: 3px solid rgba(255,255,255,0.3);
      box-shadow: 0 4px 12px ${color}66;
    ">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

const hazardIcons = {
  pothole: createIcon('#f59e0b', '🕳️'),
  sudden_brake: createIcon('#f97316', '🛑'),
  crash: createIcon('#ef4444', '💥'),
  default: createIcon('#6366f1', '⚠️'),
};

function getIcon(type) {
  return hazardIcons[type] || hazardIcons.default;
}

function formatTime(ts) {
  if (!ts) return 'Unknown';
  return new Date(ts).toLocaleString();
}

function RecenterMap({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function MapView({ hazards = [], center = [9.98, 76.29], zoom = 13, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', minHeight: 300 }}
        zoomControl={false}
      >
      <TileLayer
     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
   />
        <RecenterMap center={center} />
        {hazards.map((h, i) => (
          <Marker key={h.id || i} position={[h.latitude, h.longitude]} icon={getIcon(h.type)}>
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', marginBottom: 4 }}>
                  {h.type?.replace('_', ' ')}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>
                  Intensity: {h.intensity?.toFixed(1)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>
                  Source: {h.source}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>
                  {formatTime(h.timestamp)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
