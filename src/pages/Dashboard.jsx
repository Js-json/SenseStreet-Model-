import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Wifi,
  AlertTriangle,
  Car,
  Shield,
  Activity,
  TrendingUp,
  Clock,
} from 'lucide-react';
import SafetyScore from '../components/SafetyScore';
import HazardCard from '../components/HazardCard';
import MapView from '../components/MapView';
import { subscribeToHazards, calculateSafetyScore } from '../services/hazardService';

// Demo data
const DEMO_HAZARDS = [
  { id: '1', type: 'pothole', latitude: 9.9816, longitude: 76.2999, intensity: 19.2, timestamp: Date.now() - 300000, source: 'sensor' },
  { id: '2', type: 'sudden_brake', latitude: 9.984, longitude: 76.295, intensity: 12.5, timestamp: Date.now() - 600000, source: 'sensor' },
  { id: '3', type: 'crash', latitude: 9.978, longitude: 76.302, intensity: 34.1, timestamp: Date.now() - 1200000, source: 'manual' },
  { id: '4', type: 'pothole', latitude: 9.986, longitude: 76.288, intensity: 20.5, timestamp: Date.now() - 1800000, source: 'sensor' },
  { id: '5', type: 'pothole', latitude: 9.975, longitude: 76.297, intensity: 18.8, timestamp: Date.now() - 5400000, source: 'manual' },
  { id: '6', type: 'sudden_brake', latitude: 9.990, longitude: 76.285, intensity: 14.3, timestamp: Date.now() - 7200000, source: 'sensor' },
];

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const [hazards, setHazards] = useState(DEMO_HAZARDS);
  const [usingDemo, setUsingDemo] = useState(true);

  useEffect(() => {
    let unsub;
    try {
      unsub = subscribeToHazards((data) => {
        if (data.length > 0) {
          setHazards(data);
          setUsingDemo(false);
        }
      });
    } catch (e) {
      console.warn('Firebase not configured');
    }
    return () => unsub?.();
  }, []);

  const scoreData = calculateSafetyScore(hazards);
  const todayCount = hazards.filter((h) => Date.now() - h.timestamp < 86400000).length;
  const crashCount = hazards.filter((h) => h.type === 'crash').length;
  const activeSensors = usingDemo ? 3 : hazards.reduce((s, h) => { s.add(h.deviceId); return s; }, new Set()).size;

  return (
    <div className="page-container has-bottom-nav">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="page-content">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-indigo-400" />
            Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Road safety analytics
            {usingDemo && <span className="text-amber-400 ml-2">(Demo Data)</span>}
          </p>
        </div>

        {/* Stat Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)' }}>
              <Wifi size={22} className="text-cyan-400" />
            </div>
            <span className="stat-value text-cyan-400">{activeSensors}</span>
            <span className="stat-label">Active Sensors</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
              <AlertTriangle size={22} className="text-amber-400" />
            </div>
            <span className="stat-value text-amber-400">{todayCount}</span>
            <span className="stat-label">Hazards Today</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
              <Car size={22} className="text-red-400" />
            </div>
            <span className="stat-value text-red-400">{crashCount}</span>
            <span className="stat-label">Crash Alerts</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: `${scoreData.color}1f` }}>
              <Shield size={22} style={{ color: scoreData.color }} />
            </div>
            <span className="stat-value" style={{ color: scoreData.color }}>{scoreData.score}</span>
            <span className="stat-label">Safety Score</span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Safety Score Widget */}
          <div className="lg:col-span-1">
            <SafetyScore scoreData={scoreData} />
          </div>

          {/* Mini Map */}
          <div className="lg:col-span-2">
            <div className="glass-card p-4" style={{ height: '100%', minHeight: 300 }}>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-300">Hazard Overview</h3>
              </div>
              <MapView
                hazards={hazards.slice(0, 50)}
                center={hazards.length > 0 ? [hazards[0].latitude, hazards[0].longitude] : [9.98, 76.29]}
                zoom={13}
                style={{ height: 'calc(100% - 40px)', borderRadius: 12 }}
              />
            </div>
          </div>
        </div>

        {/* Hazard Distribution & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hazard Distribution */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-300">Hazard Distribution</h3>
            </div>
            <div className="space-y-4">
              {[
                { type: 'Potholes', count: scoreData.potholes, color: '#f59e0b', total: hazards.length },
                { type: 'Sudden Brakes', count: scoreData.brakes, color: '#f97316', total: hazards.length },
                { type: 'Crashes', count: scoreData.crashes, color: '#ef4444', total: hazards.length },
              ].map((item) => (
                <div key={item.type}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400">{item.type}</span>
                    <span className="font-semibold" style={{ color: item.color }}>{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%`,
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                        minWidth: item.count > 0 ? 8 : 0,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Timeline */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-300">Event Timeline</h3>
            </div>
            <div className="max-h-64 overflow-y-auto pr-1">
              {hazards.slice(0, 10).map((h, i) => (
                <div key={h.id || i} className="timeline-item">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize" style={{
                      color: h.type === 'crash' ? '#ef4444' : h.type === 'sudden_brake' ? '#f97316' : '#f59e0b'
                    }}>
                      {h.type?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500">{formatTimeAgo(h.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Intensity: {h.intensity?.toFixed(1)} · {h.source}
                  </p>
                </div>
              ))}
              {hazards.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No events recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
