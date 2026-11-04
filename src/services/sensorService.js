/**
 * SenseStreet Sensor Service
 * Encapsulates DeviceMotion, DeviceOrientation, and Geolocation APIs.
 * Hazard classification lives in hazardDetector.js (profile-based, calibrated).
 */

import { HazardDetector, PROFILES } from './hazardDetector';

const PROFILE_KEY = 'sensestreet_profile';
const CAL_KEY = (profile) => `sensestreet_calibration_${profile}`;

/** Which vehicle profile is selected ('car' | 'toy'). Persisted. */
export function getProfileName() {
  try {
    const p = localStorage.getItem(PROFILE_KEY);
    return PROFILES[p] ? p : 'car';
  } catch {
    return 'car';
  }
}

export function setProfileName(name) {
  try {
    if (PROFILES[name]) localStorage.setItem(PROFILE_KEY, name);
  } catch {
    /* storage unavailable */
  }
}

/** Saved calibration for a profile: { sigma, fwdSign } or null. */
export function getCalibration(profile = getProfileName()) {
  try {
    const raw = localStorage.getItem(CAL_KEY(profile));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(profile, cal) {
  try {
    localStorage.setItem(CAL_KEY(profile), JSON.stringify({ sigma: cal.sigma, sigmaF: cal.sigmaF, fwdSign: cal.fwdSign }));
  } catch {
    /* storage unavailable */
  }
}

export function clearCalibration(profile = getProfileName()) {
  try {
    localStorage.removeItem(CAL_KEY(profile));
  } catch {
    /* storage unavailable */
  }
}

let motionListener = null;
let orientationListener = null;
let geoWatchId = null;

/**
 * Start listening to device motion events.
 *
 * Mounting: the TOP EDGE of the phone should point toward the FRONT of the vehicle.
 *
 * @param {Function} onData - callback receiving { t, hasAccel, ax, ay, az, magnitude, rotAlpha, rotBeta, rotGamma, gyroMagnitude }
 *                            (gyro values are in degrees per second, as reported by browsers)
 * @param {Function} onHazard - callback receiving { type, intensity }
 * @param {{ profile?: 'car'|'toy', calibrating?: boolean }} [options]
 * @returns {HazardDetector} the detector (call finishCalibration() on it after a calibration run)
 */
export function startMotionSensor(onData, onHazard, options = {}) {
  const profile = options.profile || getProfileName();
  const detector = new HazardDetector(profile, getCalibration(profile));
  if (options.calibrating) detector.startCalibration();

  motionListener = (event) => {
    const now = performance.now(); // one clock read, shared by the recorder and the detector
    const acc = event.accelerationIncludingGravity || {};
    const rot = event.rotationRate || {};

    const ax = acc.x || 0;
    const ay = acc.y || 0;
    const az = acc.z || 0;
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

    const rotAlpha = rot.alpha || 0;
    const rotBeta = rot.beta || 0;
    const rotGamma = rot.gamma || 0;
    const gyroMagnitude = Math.sqrt(rotAlpha * rotAlpha + rotBeta * rotBeta + rotGamma * rotGamma);

    const hasAccel = !(acc.x == null && acc.y == null && acc.z == null);

    onData({
      t: now,
      hasAccel,
      ax: +ax.toFixed(2),
      ay: +ay.toFixed(2),
      az: +az.toFixed(2),
      magnitude: +magnitude.toFixed(2),
      rotAlpha: +rotAlpha.toFixed(2),
      rotBeta: +rotBeta.toFixed(2),
      rotGamma: +rotGamma.toFixed(2),
      gyroMagnitude: +gyroMagnitude.toFixed(2),
    });

    // Some browsers/desktops fire devicemotion with no accelerometer data (all null)
    if (!hasAccel) return;

    const events = detector.update({ t: now, ax, ay, az, gyro: gyroMagnitude });
    for (const e of events) onHazard(e);
  };

  window.addEventListener('devicemotion', motionListener);
  return detector;
}

/**
 * Start listening to orientation events.
 * @param {Function} onData - callback receiving { alpha, beta, gamma }
 */
export function startOrientationSensor(onData) {
  orientationListener = (event) => {
    onData({
      alpha: +(event.alpha || 0).toFixed(2),
      beta: +(event.beta || 0).toFixed(2),
      gamma: +(event.gamma || 0).toFixed(2),
    });
  };
  window.addEventListener('deviceorientation', orientationListener);
}

/**
 * Start watching GPS position.
 * @param {Function} onPosition - callback receiving { latitude, longitude, speed, accuracy }
 * @param {Function} onError - callback for errors
 */
export function startGPS(onPosition, onError) {
  if (!navigator.geolocation) {
    onError?.({ message: 'Geolocation not supported' });
    return;
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: pos.coords.speed !== null ? +(pos.coords.speed * 3.6).toFixed(1) : 0, // m/s to km/h
        accuracy: +pos.coords.accuracy.toFixed(1),
      });
    },
    (err) => {
      onError?.(err);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

/**
 * Stop all sensors.
 */
export function stopAllSensors() {
  if (motionListener) {
    window.removeEventListener('devicemotion', motionListener);
    motionListener = null;
  }
  if (orientationListener) {
    window.removeEventListener('deviceorientation', orientationListener);
    orientationListener = null;
  }
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
}

/**
 * Request permission for motion sensors on iOS 13+.
 * @returns {Promise<boolean>}
 */
export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true; // non-iOS or older iOS → no permission needed
}

export { PROFILES };
