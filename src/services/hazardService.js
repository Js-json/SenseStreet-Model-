import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";

const HAZARDS_COLLECTION = "hazards";
const SENSORS_COLLECTION = "sensors";

/**
 * Upload a hazard event to Firestore.
 */
export async function uploadHazard(data) {
  try {
    const docRef = await addDoc(collection(db, HAZARDS_COLLECTION), {
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      intensity: data.intensity,
      timestamp: Date.now(),
      source: data.source || "sensor",
      deviceId: data.deviceId || "unknown",
      description: data.description || "",
      status: "active",
    });
    return docRef.id;
  } catch (error) {
    console.error("Error uploading hazard:", error);
    throw error;
  }
}

/**
 * Upload a sensor reading snapshot to Firestore.
 */
export async function uploadSensorData(data) {
  try {
    await addDoc(collection(db, SENSORS_COLLECTION), {
      deviceId: data.deviceId || "unknown",
      acceleration: data.acceleration,
      gyroX: data.gyroX || 0,
      gyroY: data.gyroY || 0,
      gyroZ: data.gyroZ || 0,
      speed: data.speed || 0,
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error uploading sensor data:", error);
  }
}

/**
 * Subscribe to real-time hazard updates.
 * @param {Function} callback - receives array of hazard objects
 * @param {number} limitCount - max number of hazards to fetch
 * @returns {Function} unsubscribe function
 */
export function subscribeToHazards(callback, limitCount = 200) {
  const q = query(
    collection(db, HAZARDS_COLLECTION),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const hazards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(hazards);
  }, (error) => {
    console.error("Error subscribing to hazards:", error);
  });
}

/**
 * Get hazards from the last N hours.
 * @param {Function} callback
 * @param {number} hours
 * @returns {Function} unsubscribe
 */
export function subscribeToRecentHazards(callback, hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const q = query(
    collection(db, HAZARDS_COLLECTION),
    where("timestamp", ">=", cutoff),
    orderBy("timestamp", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const hazards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(hazards);
  }, (error) => {
    console.error("Error subscribing to recent hazards:", error);
  });
}

/**
 * Calculate safety score from hazard list.
 * @param {Array} hazards
 * @returns {{ score: number, label: string, color: string }}
 */
export function calculateSafetyScore(hazards) {
  let potholes = 0;
  let crashes = 0;
  let brakes = 0;

  hazards.forEach((h) => {
    if (h.type === "pothole") potholes++;
    else if (h.type === "crash") crashes++;
    else if (h.type === "sudden_brake") brakes++;
  });

  const score = Math.max(0, Math.min(100, 100 - potholes * 5 - crashes * 10 - brakes * 3));

  let label, color;
  if (score >= 80) {
    label = "Safe";
    color = "#10b981";
  } else if (score >= 60) {
    label = "Moderate Risk";
    color = "#f59e0b";
  } else if (score >= 40) {
    label = "High Risk";
    color = "#f97316";
  } else {
    label = "Dangerous";
    color = "#ef4444";
  }

  return { score, label, color, potholes, crashes, brakes };
}

/**
 * Generate a simple device ID.
 */
export function getDeviceId() {
  let id = localStorage.getItem("sensestreet_device_id");
  if (!id) {
    id = "device_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("sensestreet_device_id", id);
  }
  return id;
}
