import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radar, MapPin, Gauge, AlertTriangle, Play, Square, SlidersHorizontal, Circle, Download } from 'lucide-react';
import SensorGraph, { MAX_POINTS } from '../components/SensorGraph';
import HazardCard from '../components/HazardCard';
import {
  startMotionSensor,
  startOrientationSensor,
  startGPS,
  stopAllSensors,
  requestMotionPermission,
  PROFILES,
  getProfileName,
  setProfileName,
  getCalibration,
  saveCalibration,
  clearCalibration,
} from '../services/sensorService';
import { uploadHazard, getDeviceId } from '../services/hazardService';
import { SessionRecorder, LABELS } from '../services/sessionRecorder';

// Seconds to put the phone on the car after tapping Start/Calibrate (toy profile or recording)
const READY_SECONDS = 4;

// Calibration starts with this many seconds of holding the car still (gravity, direction)
const CAL_REST_SECONDS = 2;

// Distance in metres between two lat/lon points (haversine)
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

  // Vehicle profile + calibration
  const [profile, setProfile] = useState(getProfileName());
  const [calibration, setCalibration] = useState(() => getCalibration(getProfileName()));
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calSecondsLeft, setCalSecondsLeft] = useState(0);
  const [calMessage, setCalMessage] = useState('');
  // Raw-data recording (for tuning the detector offline)
  const [recordEnabled, setRecordEnabled] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [recStats, setRecStats] = useState(null);
  const [lastMark, setLastMark] = useState('');
  const [readyLeft, setReadyLeft] = useState(0);
  const recorderRef = useRef(null);
  const readyCancelRef = useRef(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const detectorRef = useRef(null);
  const calTimerRef = useRef(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const gpsRef = useRef(gpsData);
  gpsRef.current = gpsData;

  const deviceId = useRef(getDeviceId());

  // Per-type cooldown (so a pothole never hides a crash) and de-duplication of repeat hits on the same spot
  const lastHazardTime = useRef({});
  const recentHazards = useRef([]);
  const HAZARD_COOLDOWN = 1500;

  const handleHazard = useCallback((hazard) => {
    const now = Date.now();
    if (now - (lastHazardTime.current[hazard.type] || 0) < HAZARD_COOLDOWN) return;
    lastHazardTime.current[hazard.type] = now;

    const cfg = PROFILES[profileRef.current];
    const { latitude, longitude, accuracy } = gpsRef.current;
    const hasFix = latitude !== 0 || longitude !== 0;
    const accurateEnough = !accuracy || accuracy <= cfg.maxGpsAccuracy;
    const savable = hasFix && accurateEnough;

    // Same type, nearby, within 30 s = same hazard seen again (e.g. toy car driving over a bump twice)
    if (savable) {
      recentHazards.current = recentHazards.current.filter((r) => now - r.t < 30000);
      const dup = recentHazards.current.some(
        (r) => r.type === hazard.type && distanceMeters(r.lat, r.lon, latitude, longitude) < cfg.dedupeMeters
      );
      if (dup) return;
      recentHazards.current.push({ type: hazard.type, lat: latitude, lon: longitude, t: now });
    }

    const fullHazard = {
      ...hazard,
      latitude,
      longitude,
      timestamp: now,
      source: 'sensor',
      deviceId: deviceId.current,
    };

    setDetectedHazards((prev) => [fullHazard, ...prev].slice(0, 20));
    setHazardCount((c) => c + 1);

    // Only save to the shared map when there is a trustworthy location
    if (savable) uploadHazard(fullHazard).catch(() => {});
  }, []);

  // ---- recording helpers ----
  const refreshRecStats = () => setRecStats(recorderRef.current ? recorderRef.current.stats() : null);

  const ensureRecorder = () => {
    if (!recordEnabled) return null;
    if (!recorderRef.current) {
      const rec = new SessionRecorder({ includeLocation });
      rec.meta('profile', profile);
      rec.meta('saved_calibration', JSON.stringify(calibration || null));
      rec.meta('started_at', new Date().toISOString());
      rec.meta('include_location', includeLocation);
      rec.meta('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
      recorderRef.current = rec;
    }
    return recorderRef.current;
  };

  const markLabel = (type) => {
    const rec = recorderRef.current;
    if (!rec) return;
    rec.label(performance.now(), type);
    detectorRef.current?.ignoreFor(); // the tap itself jolts the phone; don't mistake it for an event
    setLastMark(`Marked: ${LABELS[type]}`);
    refreshRecStats();
  };

  const undoMark = () => {
    if (recorderRef.current?.undoLabel()) {
      setLastMark('Last mark removed');
      refreshRecStats();
    }
  };

  const downloadRecording = () => recorderRef.current?.download(profile);

  const discardRecording = () => {
    recorderRef.current = null;
    setRecStats(null);
    setLastMark('');
  };

  // Gives you time to put the phone on the car. Resolves false if cancelled.
  const runCountdown = (secs) =>
    new Promise((resolve) => {
      let left = secs;
      setReadyLeft(left);
      const id = setInterval(() => {
        left -= 1;
        setReadyLeft(left);
        if (left <= 0) {
          clearInterval(id);
          readyCancelRef.current = null;
          resolve(true);
        }
      }, 1000);
      readyCancelRef.current = () => {
        clearInterval(id);
        readyCancelRef.current = null;
        setReadyLeft(0);
        resolve(false);
      };
    });

  const needsReadyDelay = () => profile === 'toy' || recordEnabled;

  const startScan = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Permission must be requested straight from the tap (iOS requirement)
      const granted = await requestMotionPermission();
      setSensorPermission(granted);
      if (!granted) return;

      if (needsReadyDelay()) {
        const go = await runCountdown(READY_SECONDS);
        if (!go || !mountedRef.current) return;
      }

      const rec = ensureRecorder();
      rec?.phase('scan', performance.now());

      setIsScanning(true);
      setDetectedHazards([]);
      setHazardCount(0);

      recentHazards.current = [];
      detectorRef.current = startMotionSensor(
        (data) => {
          rec?.sample(data);
          setCurrentAcc(data.magnitude);
          setCurrentGyro(data.gyroMagnitude);
          setAccHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.magnitude]);
          setGyroHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.gyroMagnitude]);
        },
        (hazard) => {
          rec?.event(performance.now(), hazard.type, hazard.intensity);
          handleHazard(hazard);
        },
        { profile }
      );
      rec?.meta('sigma_at_scan_start', detectorRef.current.sigma.toFixed(3));
      rec?.meta('forward_sign_at_scan_start', detectorRef.current.fwdSign);

      startGPS(
        (pos) => {
          rec?.gps(performance.now(), pos);
          setGpsData(pos);
          setSpeedHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), pos.speed]);
        },
        (err) => console.warn('GPS error:', err.message)
      );

      startOrientationSensor(() => {});
    } finally {
      startingRef.current = false;
    }
  };

  const stopScan = () => {
    stopAllSensors();
    setIsScanning(false);
    recorderRef.current?.phase('stop', performance.now());
    refreshRecStats();
  };

  const changeProfile = (name) => {
    setProfile(name);
    setProfileName(name);
    setCalibration(getCalibration(name));
    setCalMessage('');
  };

  const finishCalibration = () => {
    clearInterval(calTimerRef.current);
    const result = detectorRef.current?.finishCalibration();
    stopAllSensors();
    setIsCalibrating(false);
    recorderRef.current?.phase('calibrate_end', performance.now());
    recorderRef.current?.meta('calibration_result', JSON.stringify(result || null));
    refreshRecStats();
    if (result?.ok) {
      saveCalibration(profile, result);
      setCalibration({ sigma: result.sigma, sigmaF: result.sigmaF, fwdSign: result.fwdSign });
      setCalMessage(
        result.learnedDirection
          ? 'Calibrated. Normal vibration level and forward direction learned.'
          : 'Calibrated. Normal vibration level learned (forward direction not detected, so braking uses the default).'
      );
    } else {
      setCalMessage(result?.reason || 'Calibration failed. Try again.');
    }
  };

  const startCalibration = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const granted = await requestMotionPermission();
      setSensorPermission(granted);
      if (!granted) return;

      if (needsReadyDelay()) {
        const go = await runCountdown(READY_SECONDS);
        if (!go || !mountedRef.current) return;
      }

      setCalMessage('');
      const rec = ensureRecorder();
      rec?.phase('calibrate', performance.now());
      setIsCalibrating(true);
      setCalSecondsLeft(PROFILES[profile].calSeconds + CAL_REST_SECONDS);
      detectorRef.current = startMotionSensor(
        (data) => {
          rec?.sample(data);
          setCurrentAcc(data.magnitude);
          setCurrentGyro(data.gyroMagnitude);
          setAccHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.magnitude]);
          setGyroHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), data.gyroMagnitude]);
        },
        () => {},
        { profile, calibrating: true }
      );
      calTimerRef.current = setInterval(() => {
        setCalSecondsLeft((n) => n - 1);
      }, 1000);
    } finally {
      startingRef.current = false;
    }
  };

  const cancelCalibration = () => {
    clearInterval(calTimerRef.current);
    stopAllSensors();
    setIsCalibrating(false);
    recorderRef.current?.phase('calibrate_end', performance.now());
    recorderRef.current?.meta('calibration_result', 'cancelled');
    refreshRecStats();
    setCalMessage('Calibration cancelled.');
  };

  // Auto-finish when the countdown reaches zero
  useEffect(() => {
    if (isCalibrating && calSecondsLeft <= 0) finishCalibration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalibrating, calSecondsLeft]);

  const resetCalibration = () => {
    clearCalibration(profile);
    setCalibration(null);
    setCalMessage('Calibration cleared. Using default sensitivity.');
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      readyCancelRef.current?.();
      clearInterval(calTimerRef.current);
      stopAllSensors();
    };
  }, []);

  // Keep the recording counters fresh without re-rendering at sensor rate
  useEffect(() => {
    refreshRecStats();
    if (!(isScanning || isCalibrating) || !recorderRef.current) return undefined;
    const id = setInterval(refreshRecStats, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, isCalibrating]);

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

        {/* Vehicle profile + calibration */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={14} className="text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Vehicle</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {Object.entries(PROFILES).map(([key, p]) => (
              <button
                key={key}
                disabled={isScanning || isCalibrating || readyLeft > 0}
                onClick={() => changeProfile(key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all disabled:opacity-50 ${
                  profile === key
                    ? 'bg-zinc-900 text-white border border-zinc-900'
                    : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-zinc-500 ml-1">
              {calibration ? 'Calibrated ✓' : 'Using default sensitivity'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Mount the phone so its <strong>top edge points to the front</strong> of the vehicle and it cannot slide around.
            Any tilt is fine.
          </p>
          {isCalibrating ? (
            <div>
              {calSecondsLeft > PROFILES[profile].calSeconds ? (
                <p className="text-lg font-semibold mb-2">Hold the car still… {calSecondsLeft - PROFILES[profile].calSeconds}</p>
              ) : (
                <p className="text-lg font-semibold mb-2">
                  Push it straight now, at your normal pace. {Math.max(calSecondsLeft, 0)}s left
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={finishCalibration} className="btn-secondary text-sm py-2 px-4">Finish now</button>
                <button onClick={cancelCalibration} className="btn-secondary text-sm py-2 px-4">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={startCalibration} disabled={isScanning || readyLeft > 0} className="btn-secondary text-sm py-2 px-4 disabled:opacity-50">
                {calibration ? 'Recalibrate' : 'Calibrate'} ({PROFILES[profile].calSeconds}s)
              </button>
              {calibration && !isScanning && (
                <button onClick={resetCalibration} className="text-xs text-zinc-500 underline">Reset</button>
              )}
            </div>
          )}
          {calMessage && <p className="text-xs text-zinc-600 mt-3">{calMessage}</p>}
        </div>

        {/* Data recording (for tuning) */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Circle size={14} className="text-red-600" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Record data (for tuning)</span>
          </div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={recordEnabled}
              disabled={isScanning || isCalibrating || readyLeft > 0 || !!recStats}
              onChange={(e) => setRecordEnabled(e.target.checked)}
              className="accent-zinc-900"
            />
            Record raw sensor data
          </label>
          {recordEnabled && !recStats && (
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={includeLocation}
                onChange={(e) => setIncludeLocation(e.target.checked)}
                className="accent-zinc-900"
              />
              Include GPS location in the file (off by default)
            </label>
          )}
          {!recStats && (
            <p className="text-xs text-zinc-500">
              Saves motion readings to a CSV you can download and send for tuning. Nothing is uploaded.
              Calibration and scans both go into the same recording.
            </p>
          )}

          {recStats && (
            <div>
              <p className="text-xs text-zinc-600 mb-2">
                {recStats.sample} readings · {recStats.event} detector events · {recStats.label} marks · about {recStats.approxKB} KB
              </p>
              {recStats.full && (
                <p className="text-xs text-amber-600 mb-2">Recording is full. Download it and discard before recording more.</p>
              )}

              {isScanning && (
                <div className="mb-2">
                  <p className="text-xs text-zinc-500 mb-2">
                    Do one thing, stop the car, then tap what you did. Tapping while it is still moving adds a jolt.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {Object.entries(LABELS).map(([key, text]) => (
                      <button key={key} onClick={() => markLabel(key)} className="btn-secondary justify-center py-3 text-sm">
                        {text}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={undoMark} className="text-xs text-zinc-500 underline">Undo last mark</button>
                    {lastMark && <span className="text-xs text-zinc-600">{lastMark}</span>}
                  </div>
                </div>
              )}

              {!isScanning && !isCalibrating && (
                <div>
                  {recStats.sample === 0 && (
                    <p className="text-xs text-amber-600 mb-2">
                      No sensor readings were captured. Recording only works on a phone with motion sensors.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={downloadRecording} className="btn-primary text-sm py-2 px-4">
                      <Download size={16} />
                      Download CSV
                    </button>
                    <button onClick={discardRecording} className="btn-secondary text-sm py-2 px-4">Discard</button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Download before leaving this page. A new scan adds to this recording until you discard it.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Get-ready countdown */}
        {readyLeft > 0 && (
          <div className="text-center mb-4">
            <p className="text-lg font-semibold">Put the phone on the car. Starting in {readyLeft}s</p>
            <button onClick={() => readyCancelRef.current?.()} className="btn-secondary text-sm py-2 px-4 mt-2">Cancel</button>
          </div>
        )}

        {/* Control Button */}
        <div className="text-center mb-6">
          {!isScanning ? (
            <button onClick={startScan} disabled={isCalibrating || readyLeft > 0} className="btn-primary text-lg py-4 px-10 disabled:opacity-50">
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
          {isScanning && gpsData.latitude === 0 && gpsData.longitude === 0 && (
            <p className="text-sm text-amber-600 mt-3">Waiting for a GPS fix. Events are shown here but not saved to the map without a location.</p>
          )}
          {isScanning && gpsData.accuracy > PROFILES[profile].maxGpsAccuracy && (
            <p className="text-sm text-amber-600 mt-3">
              GPS accuracy is ±{gpsData.accuracy.toFixed(0)} m. Events are not saved to the map until it is within ±{PROFILES[profile].maxGpsAccuracy} m.
            </p>
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
            <span className="stat-label">Gyro (°/s)</span>
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
          <SensorGraph dataHistory={gyroHistory} label="Gyroscope" color="#71717a" unit="°/s" />
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
