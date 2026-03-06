import React from 'react';
import { AlertTriangle, CircleAlert, Car } from 'lucide-react';

const typeConfig = {
  pothole: {
    icon: CircleAlert,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    label: 'Pothole',
  },
  sudden_brake: {
    icon: Car,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    label: 'Sudden Brake',
  },
  crash: {
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    label: 'Crash',
  },
};

function formatTimeAgo(ts) {
  if (!ts) return 'Unknown';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HazardCard({ hazard, compact = false }) {
  const config = typeConfig[hazard.type] || typeConfig.pothole;
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 36, height: 36, background: config.bg }}
        >
          <Icon size={18} color={config.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: config.color }}>{config.label}</div>
          <div className="text-xs text-slate-500 truncate">
            Int: {hazard.intensity?.toFixed(1)} · {hazard.source}
          </div>
        </div>
        <div className="text-xs text-slate-500 shrink-0">{formatTimeAgo(hazard.timestamp)}</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 flex items-start gap-4">
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{ width: 48, height: 48, background: config.bg }}
      >
        <Icon size={24} color={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold" style={{ color: config.color }}>{config.label}</h4>
          <span className="text-xs text-slate-500">{formatTimeAgo(hazard.timestamp)}</span>
        </div>
        <p className="text-xs text-slate-400 mb-1">
          Intensity: <span className="font-semibold text-slate-300">{hazard.intensity?.toFixed(1)}</span> · Source: <span className="capitalize">{hazard.source}</span>
        </p>
        <p className="text-xs text-slate-500 font-mono">
          📍 {hazard.latitude?.toFixed(4)}, {hazard.longitude?.toFixed(4)}
        </p>
        {hazard.description && (
          <p className="text-xs text-slate-400 mt-1 italic">{hazard.description}</p>
        )}
      </div>
    </div>
  );
}
