import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';

export default function SafetyScore({ scoreData }) {
  const { score, label, color, potholes, crashes, brakes } = scoreData;

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  let Icon = ShieldCheck;
  if (score < 40) Icon = ShieldX;
  else if (score < 60) Icon = ShieldAlert;
  else if (score < 80) Icon = Shield;

  return (
    <div className="glass-card p-6 flex flex-col items-center">
      <div className="relative mb-4" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Background ring */}
          <circle
            cx="70" cy="70" r="54"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="10"
          />
          {/* Score ring */}
          <circle
            cx="70" cy="70" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-zinc-500 font-medium">/ 100</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Icon size={20} color={color} />
        <span className="font-bold text-sm" style={{ color }}>{label}</span>
      </div>

      <div className="flex gap-6 text-center">
        <div>
          <span className="block text-lg font-bold text-amber-600">{potholes}</span>
          <span className="text-xs text-zinc-500">Potholes</span>
        </div>
        <div>
          <span className="block text-lg font-bold text-red-600">{crashes}</span>
          <span className="text-xs text-zinc-500">Crashes</span>
        </div>
        <div>
          <span className="block text-lg font-bold text-orange-600">{brakes}</span>
          <span className="text-xs text-zinc-500">Brakes</span>
        </div>
      </div>
    </div>
  );
}
