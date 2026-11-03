import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radar, MapPin, Gauge, AlertTriangle, Play, Square, Wifi, WifiOff } from 'lucide-react';
import SensorGraph, { MAX_POINTS } from '../components/SensorGraph';
import HazardCard from '../components/HazardCard';
import {
  startMotionSensor,
  startOrientationSensor,
  startGPS,
  stopAllSensors,
  requestMotionPermission,
} from '../services/sensorService';
import { uploadHazard, getDeviceId } from '../services/hazardService';

export default function Scan() {
  const [isScanning, setIsScanning] = useState(false);
  const [sensorPermission, setSensorPermission] = useState(null);
  const [gpsData, setGpsData] = useState({ latitude: 0, longitude: 0, speed: 0, accuracy: 0 });
  const [accHistory, setAccHistory] = useState([]);
  const [gyroHistory, setGyroHistory] = useState([]);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [currentAcc, setCurrentAcc] = useState(0);
  const [currentGyro, setCurrentGyro] = useState(0);
  const [detectedHazards, setDetectedHazards] = useState([]);
  const [hazardCount, setHazardCount] = useState(0);

  const gpsRef = useRef(gpsData);
  gpsRef.current = gpsData;

  const deviceId = useRef(getDeviceId());

  // Debounce hazard uploads
  const lastHazardTime = useRef(0);
  const HAZARD_COOLDOWN = 3000; // 3 seconds between hazards

  const handleHazard = useCallback((hazard) => {
    const now = Date.now();
    if (now - lastHazardTime.current < HAZARD_COOLDOWN) return;
    lastHazardTime.current = now;

    const fullHazard = {
      ...hazard,
      latitude: gpsRef.current.latitude,
      longitude: gpsRef.current.longitude,
      timestamp: now,
      source: 'sensor',
      deviceId: deviceId.current,
    };

    setDetectedHazards((prev) => [fullHazard, ...prev].slice(0, 20));
    setHazardCount((c) => c + 1);

    // Upload to Firebase (non-blocking)
    uploadHazard(fullHazard).catch(() => {});
  }, []);

  const startScan = async () => {
    const granted = await requestMotionPermission();
    setSensorPermission(granted);
    if (!granted) return;

    setIsScanning(true);
    setDetectedHazards([]);
    setHazardCount(0);

    startMotionSensor(
      (data) => {
        setCurrentAcc(data.magnitude);
        setCurrentGyro(data.gyroMagnitude);
        setAccHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.magnitude]);
        setGyroHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.gyroMagnitude]);
      },
      handleHazard
    );

    startGPS(
      (pos) => {
        setGpsData(pos);
        setSpeedHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), pos.speed]);
      },
      (err) => console.warn('GPS error:', err.message)
    );

    startOrientationSensor(() => {});
  };

  const stopScan = () => {
    stopAllSensors();
    setIsScanning(false);
  };

  useEffect(() => {
    return () => stopAllSensors();
  }, []);

  // Simulate sensor data for demo/desktop
  useEffect(() => {
    if (!isScanning) return;

    // If no real device motion after 2 seconds, start simulating
    const timeout = setTimeout(() => {
      if (accHistory.length === 0) {
        const interval = setInterval(() => {
          const fakeAcc = 9.8 + Math.random() * 3 + (Math.random() > 0.95 ? 15 : 0);
          const fakeGyro = Math.random() * 2;
          const fakeSpeed = 20 + Math.random() * 30;
          setCurrentAcc(+fakeAcc.toFixed(2));
          setCurrentGyro(+fakeGyro.toFixed(2));
          setAccHistory((p) => [...p.slice(-(MAX_POINTS - 1)), +fakeAcc.toFixed(2)]);
          setGyroHistory((p) => [...p.slice(-(MAX_POINTS - 1)), +fakeGyro.toFixed(2)]);
          setSpeedHistory((p) => [...p.slice(-(MAX_POINTS - 1)), +fakeSpeed.toFixed(1)]);
          setGpsData({
            latitude: 9.98 + (Math.random() - 0.5) * 0.01,
            longitude: 76.29 + (Math.random() - 0.5) * 0.01,
            speed: +fakeSpeed.toFixed(1),
            accuracy: 5,
          });

          if (fakeAcc > 18) {
            handleHazard({ type: 'pothole', intensity: +fakeAcc.toFixed(2) });
          }
        }, 200);
        return () => clearInterval(interval);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isScanning, accHistory.length, handleHazard]);

  return (
    <div className="page-container has-bottom-nav">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Road Scan</h1>
            <p className="text-sm text-zinc-500">Real-time sensor monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            {isScanning && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="pulse-dot" />
                <span className="text-xs font-medium text-emerald-700">LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Button */}
        <div className="text-center mb-6">
          {!isScanning ? (
            <button onClick={startScan} className="btn-primary text-lg py-4 px-10">
              <Play size={22} />
              Start Scanning
            </button>
          ) : (
            <button onClick={stopScan} className="btn-danger text-lg py-4 px-10">
              <Square size={22} />
              Stop Scanning
            </button>
          )}
          {sensorPermission === false && (
            <p className="text-sm text-red-600 mt-3">⚠️ Sensor permission denied. Please enable in device settings.</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(24, 24, 27, 0.06)' }}>
              <Gauge size={22} className="text-zinc-900" />
            </div>
            <span className="stat-value text-zinc-900">{currentAcc.toFixed(1)}</span>
            <span className="stat-label">Accel (m/s²)</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(24, 24, 27, 0.06)' }}>
              <Radar size={22} className="text-zinc-900" />
            </div>
            <span className="stat-value text-zinc-900">{currentGyro.toFixed(1)}</span>
            <span className="stat-label">Gyro (rad/s)</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(21, 128, 61, 0.1)' }}>
              <MapPin size={22} className="text-emerald-700" />
            </div>
            <span className="stat-value text-emerald-700">{gpsData.speed.toFixed(0)}</span>
            <span className="stat-label">Speed (km/h)</span>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <span className="stat-value text-red-600">{hazardCount}</span>
            <span className="stat-label">Hazards</span>
          </div>
        </div>

        {/* GPS Info */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-emerald-700" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">GPS Location</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">Latitude</span>
              <div className="font-mono font-semibold">{gpsData.latitude.toFixed(6)}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Longitude</span>
              <div className="font-mono font-semibold">{gpsData.longitude.toFixed(6)}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Speed</span>
              <div className="font-mono font-semibold">{gpsData.speed.toFixed(1)} km/h</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Accuracy</span>
              <div className="font-mono font-semibold">±{gpsData.accuracy.toFixed(0)}m</div>
            </div>
          </div>
        </div>

        {/* Sensor Graphs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SensorGraph dataHistory={accHistory} label="Acceleration" color="#18181b" unit="m/s²" />
          <SensorGraph dataHistory={gyroHistory} label="Gyroscope" color="#71717a" unit="rad/s" />
          <SensorGraph dataHistory={speedHistory} label="Speed" color="#15803d" unit="km/h" />
        </div>

        {/* Detected Hazards */}
        {detectedHazards.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              Detected Hazards
            </h2>
            <div className="space-y-3">
              {detectedHazards.map((h, i) => (
                <HazardCard key={i} hazard={h} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
