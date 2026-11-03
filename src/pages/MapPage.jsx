import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Filter, RefreshCw, Layers } from 'lucide-react';
import MapView from '../components/MapView';
import HazardCard from '../components/HazardCard';
import { subscribeToHazards } from '../services/hazardService';

const HAZARD_TYPES = ['all', 'pothole', 'sudden_brake', 'crash'];

// Demo hazards for when Firebase isn't configured
const DEMO_HAZARDS = [
  { id: 'd1', type: 'pothole', latitude: 9.9816, longitude: 76.2999, intensity: 19.2, timestamp: Date.now() - 300000, source: 'sensor', status: 'active' },
  { id: 'd2', type: 'sudden_brake', latitude: 9.984, longitude: 76.295, intensity: 12.5, timestamp: Date.now() - 600000, source: 'sensor', status: 'active' },
  { id: 'd3', type: 'crash', latitude: 9.978, longitude: 76.302, intensity: 34.1, timestamp: Date.now() - 1200000, source: 'manual', status: 'active' },
  { id: 'd4', type: 'pothole', latitude: 9.986, longitude: 76.288, intensity: 20.5, timestamp: Date.now() - 1800000, source: 'sensor', status: 'active' },
  { id: 'd5', type: 'pothole', latitude: 9.975, longitude: 76.297, intensity: 18.8, timestamp: Date.now() - 3600000, source: 'manual', status: 'active' },
  { id: 'd6', type: 'sudden_brake', latitude: 9.990, longitude: 76.285, intensity: 14.3, timestamp: Date.now() - 5400000, source: 'sensor', status: 'active' },
  { id: 'd7', type: 'crash', latitude: 9.970, longitude: 76.310, intensity: 31.0, timestamp: Date.now() - 7200000, source: 'sensor', status: 'active' },
  { id: 'd8', type: 'pothole', latitude: 9.982, longitude: 76.305, intensity: 22.1, timestamp: Date.now() - 9000000, source: 'sensor', status: 'active' },
];

export default function MapPage() {
  const [hazards, setHazards] = useState(DEMO_HAZARDS);
  const [filter, setFilter] = useState('all');
  const [showSidebar, setShowSidebar] = useState(false);
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
      console.warn('Firebase not configured, using demo data');
    }
    return () => unsub?.();
  }, []);

  const filtered = filter === 'all' ? hazards : hazards.filter((h) => h.type === filter);
  const center = hazards.length > 0 ? [hazards[0].latitude, hazards[0].longitude] : [9.98, 76.29];

  return (
    <div className="page-container has-bottom-nav">
      <div className="bg-orb bg-orb-1" />

      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapIcon size={24} className="text-zinc-900" />
              Hazard Map
            </h1>
            <p className="text-sm text-zinc-500">
              {filtered.length} hazards detected
              {usingDemo && <span className="text-amber-600 ml-2">(Demo Data)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="btn-secondary py-2 px-3 text-sm"
            >
              <Layers size={16} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {HAZARD_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                filter === t
                  ? 'bg-zinc-900 text-white border border-zinc-900'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {t === 'all' ? `All (${hazards.length})` : `${t.replace('_', ' ')} (${hazards.filter(h => h.type === t).length})`}
            </button>
          ))}
        </div>

        {/* Map + Sidebar Layout */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
          {/* Map */}
          <div className="flex-1">
            <MapView
              hazards={filtered}
              center={center}
              zoom={14}
              style={{ height: '100%' }}
              className="border border-zinc-200"
            />
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="w-80 hidden md:block overflow-y-auto pr-1">
              <div className="space-y-2">
                {filtered.map((h) => (
                  <HazardCard key={h.id} hazard={h} compact />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center text-zinc-500 py-8 text-sm">No hazards found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
