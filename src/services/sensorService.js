/**
 * SenseStreet Sensor Service
 * Encapsulates DeviceMotion, DeviceOrientation, and Geolocation APIs.
 * Provides hazard detection via threshold-based logic.
 */

const THRESHOLDS = {
  POTHOLE_ACC: 18,
  POTHOLE_MIN_SPEED: 15,
  BRAKE_ACC_CHANGE: -10,
  BRAKE_MIN_SPEED: 20,
  CRASH_ACC: 30,
  CRASH_GYRO: 8,
};

let motionListener = null;
let orientationListener = null;
let geoWatchId = null;

/**
 * Start listening to device motion events.
 * @param {Function} onData - callback receiving { ax, ay, az, magnitude, rotAlpha, rotBeta, rotGamma }
 * @param {Function} onHazard - callback receiving { type, intensity }
 */
export function startMotionSensor(onData, onHazard) {
  let lastMagnitude = 0;

  motionListener = (event) => {
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

    onData({
      ax: +ax.toFixed(2),
      ay: +ay.toFixed(2),
      az: +az.toFixed(2),
      magnitude: +magnitude.toFixed(2),
      rotAlpha: +rotAlpha.toFixed(2),
      rotBeta: +rotBeta.toFixed(2),
      rotGamma: +rotGamma.toFixed(2),
      gyroMagnitude: +gyroMagnitude.toFixed(2),
    });

    // Crash detection
    if (magnitude > THRESHOLDS.CRASH_ACC && gyroMagnitude > THRESHOLDS.CRASH_GYRO) {
      onHazard({ type: 'crash', intensity: +magnitude.toFixed(2) });
    }
    // Pothole detection
    else if (magnitude > THRESHOLDS.POTHOLE_ACC) {
      onHazard({ type: 'pothole', intensity: +magnitude.toFixed(2) });
    }

    // Sudden brake detection
    const accChange = magnitude - lastMagnitude;
    if (accChange < THRESHOLDS.BRAKE_ACC_CHANGE) {
      onHazard({ type: 'sudden_brake', intensity: +Math.abs(accChange).toFixed(2) });
    }

    lastMagnitude = magnitude;
  };

  window.addEventListener('devicemotion', motionListener);
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

export { THRESHOLDS };
