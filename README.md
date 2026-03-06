<div align="center">
  <img width="1200" height="475" alt="SenseStreet Banner" src="banner.jpg" />  <!-- Replace with your actual banner image filename -->
</div>

# 🚦 SenseStreet — Smart Community Road Safety Network

> Turn every smartphone into a road safety sensor: automatically detect potholes, sudden braking, and crashes using phone sensors — then map hazards in real time to make roads safer for everyone.

## 📌 Overview

Road accidents often happen due to hidden potholes, poor road conditions, sudden obstacles, or crashes — but most reporting is manual and delayed.  
**SenseStreet** solves this by crowdsourcing real-time hazard detection: smartphones use built-in **accelerometer**, **gyroscope**, and **GPS** to automatically identify dangerous events and push them to a shared live map.

No more guesswork — communities get instant alerts about risky roads, helping drivers avoid hazards and enabling faster emergency response.

## 🤖 How It Works

Smartphone Sensors  
(Accelerometer + Gyroscope + GPS)  
↓  
On-device Detection Logic (simple thresholds + rules)  
↓  
Hazard data sent to Firebase (when online, buffered offline)  
↓  
Live Hazard Map + Safety Dashboard (Leaflet.js frontend)

Every participating phone becomes part of a distributed road monitoring network.

## 🛠 Initial Vision

- Fully background service on Android/iOS (using DeviceMotion API + Geolocation)
- Offline buffering of detections (IndexedDB or similar)
- Real-time syncing via Firebase
- AI-enhanced detection (future ML models on sensor data)
- Community alerts, geofencing notifications, safety scoring per road segment

## 🚧 Current Implementation (Hackathon Version)

A **Progressive Web App (PWA)** that demonstrates core automatic detection:

- ✅ Start Road Scan → access motion + GPS sensors
- ✅ Real-time graphs for acceleration, gyroscope, speed
- ✅ Automatic pothole / sudden brake / crash detection using threshold rules
- ✅ Offline buffering (events stored locally when no network)
- ✅ Sync to Firebase on reconnect → markers appear on shared map
- ✅ Live hazard map with icons (🕳️ pothole, ⚠️ hazard, 🚨 crash)
- ✅ Simple road safety score calculation per area
- ✅ Manual hazard reporting fallback

<img src="screenshot-demo.png" alt="SenseStreet Demo Screenshot" />  
<!-- Replace with your actual screenshot filename, e.g. a map with markers or sensor graph -->

## 🎯 Goal

Build a scalable, community-driven road safety platform that reduces accidents by making hazard data visible and actionable in real time — starting from everyday smartphones.

## Try it (Live Demo)

**[SenseStreet Live](https://sensestreet.vercel.app)**  
(or your deployed URL — e.g. Vercel/Netlify)

**Note:** Best experienced on a mobile phone. Add to home screen for full PWA/standalone mode.

## 🚀 Main Features (Hackathon MVP)

1. **Automatic Pothole Detection**  
   Sudden vertical acceleration spike + speed > 15 km/h → 🕳️ Pothole marker

2. **Sudden Braking / Hazard Detection**  
   Sharp deceleration + speed > 20 km/h → ⚠️ Hazard zone

3. **Crash Detection (Showstopper)**  
   Extreme acceleration + gyro rotation + speed drop → 🚨 Crash alert + location saved

4. **Live Hazard Map**  
   Leaflet.js map with real-time markers and color-coded risk zones (🟢 Safe / 🟡 Moderate / 🔴 Dangerous)

5. **Road Safety Score**  
   Simple formula:  
   `Safety Score = 100 - (potholes × 5) - (crashes × 10) - (brakes × 3)`  
   Displayed per road/area

6. **Offline Support**  
   Detections buffered locally → auto-sync when online

7. **Manual Reporting**  
   Quick buttons to report pothole, accident, broken light, etc.

8. **Live Sensor Dashboard**  
   Real-time graphs of acceleration (X/Y/Z), gyro, GPS speed — looks scientific in demos!

## 🔧 Tech Stack

- **Frontend**: HTML / React (or Vanilla JS) + Leaflet.js for maps  
- **Sensors**: DeviceMotion API, DeviceOrientation API, Geolocation API  
- **Offline / Sync**: Service Worker + IndexedDB (buffer) + Background Sync API  
- **Backend / Storage**: Firebase Firestore (hazards collection)  
- **Hosting**: Vercel / Netlify / Render  
- **PWA Features**: Web App Manifest + Service Worker for installability & offline

**Firestore Example Document**:
```json
{
  "type": "pothole",
  "latitude": 8.5241,
  "longitude": 76.9366,
  "intensity": 22,
  "timestamp": 1741362000000,
  "deviceId": "anon-123"
}
