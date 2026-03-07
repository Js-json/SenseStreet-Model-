<p align="center">
  <img src="assets/sensestreet-banner.png" alt="SenseStreet Banner" width="100%">
</p>
# 🚦 SenseStreet
## Smart Community Road Safety Network

SenseStreet turns everyday smartphones into road safety sensors.

Using built-in phone sensors like the accelerometer, gyroscope, and GPS, SenseStreet automatically detects potholes, sudden braking zones, and possible crashes, mapping them in real time to help communities avoid dangerous roads.

Instead of relying only on manual reports, SenseStreet creates a distributed road safety network powered by the phones people already carry.

------------------------------------------------------------

## 🌍 The Problem

Road accidents often occur because drivers encounter hazards too late.

Common causes include:

- Hidden potholes
- Poor road conditions
- Dangerous curves
- Sudden obstacles
- Lack of hazard awareness
- Delayed emergency response

Most navigation apps rely heavily on manual reporting.  
This means hazards are usually reported only after many people have already encountered them.

Communities need a system that can automatically detect road hazards in real time.

------------------------------------------------------------

## 💡 Our Idea

SenseStreet transforms smartphones into mobile road monitoring sensors.

Smartphone Sensors
(Accelerometer + Gyroscope + GPS) <br>
        ↓ <br>
Detection Logic <br>
        ↓ <br>
Firebase Database <br>
        ↓ <br>
Live Hazard Map <br>
        ↓ <br>
Community Road Safety Network 

Every phone contributes to a crowdsourced road safety system that helps identify dangerous road conditions.

------------------------------------------------------------

## ⭐ Key Features

### 1. Automatic Pothole Detection

When a vehicle hits a pothole, the phone experiences a sudden vertical acceleration spike.

Detection rule:

IF acceleration > threshold  
AND GPS speed > 15 km/h  
THEN pothole detected

Result:

Pothole detected  
Location saved to database  
Marker appears on map

------------------------------------------------------------

### 2. Sudden Brake / Hazard Detection

Sudden deceleration may indicate:

- obstacle on road
- animal crossing
- dangerous curve
- unexpected traffic

Detection rule:

IF acceleration change < -threshold  
AND speed > 20 km/h  
THEN sudden braking event

Result:

Hazard zone detected  
Marker added to map

------------------------------------------------------------

### 3. Crash Detection

SenseStreet detects possible crashes using multiple signals:

- very high acceleration spike
- large gyroscope rotation
- sudden drop in GPS speed

Rule example:

IF acceleration > crashThreshold  
AND gyroscope change is large  
AND speed drops rapidly  
THEN crash detected

Result:

Crash detected  
Location saved  
Emergency alert triggered

------------------------------------------------------------

### 4. Live Hazard Map

Using Leaflet.js, SenseStreet visualizes hazards on an interactive map.

Markers represent different types of risks:

Pothole  
Hazard Zone  
Crash Location

Drivers and communities can instantly see dangerous areas in real time.

------------------------------------------------------------

### 5. Road Safety Score

SenseStreet calculates a safety score for each road area.

Safety Score =

100
- (potholes × 5)
- (crashes × 10)
- (sudden brakes × 3)

Example:

MG Road  
Safety Score: 41 / 100  
High Risk Zone

This helps identify dangerous roads at a glance.

------------------------------------------------------------

### 6. Manual Hazard Reporting

Users can also report hazards manually.

Report options:

- pothole
- accident
- broken streetlight
- unsafe road

Reports are immediately added to the map.

------------------------------------------------------------

### 7. Live Sensor Dashboard

SenseStreet includes a live sensor dashboard showing real-time phone data:

- Acceleration (X Y Z)
- Gyroscope
- GPS speed

Graphs update live as the phone moves.
------------------------------------------------------------
## 🧠 Why We Don't Use Machine Learning

Many modern systems rely heavily on machine learning models such as CNNs or deep neural networks for detection tasks.

However, SenseStreet intentionally avoids heavy machine learning models and instead uses efficient rule-based sensor logic.

This decision was made for several important reasons.

### 1. Real-Time Processing
Machine learning models can introduce latency and require significant computation.
SenseStreet uses simple threshold-based detection, allowing events to be detected instantly.

### 2. Energy Efficiency
Smartphones continuously collecting sensor data need to conserve battery.
Lightweight detection logic consumes far less power than running ML inference.

### 3. Accessibility
Our system can run on any smartphone without requiring powerful processors or GPUs.

### 4. Transparency
Rule-based detection is easy to understand and explain.
Every hazard detection can be traced directly to sensor readings and thresholds.

### 5. Scalability
Because the system is lightweight, it can scale to thousands of devices without heavy cloud processing.

By focusing on efficient sensor logic instead of complex models, SenseStreet demonstrates that powerful safety systems can be built using simple and accessible technology.
------------------------------------------------------------

## 📱 Platform Support

SenseStreet currently runs on *mobile devices* because it relies on built-in smartphone sensors.

Required sensors include:

- Accelerometer
- Gyroscope
- GPS

These sensors are necessary for detecting road hazards.

Since most laptops and desktop computers do not have motion sensors, the road scanning feature is designed to run directly on smartphones.

The hazard map and dashboard can still be viewed on any browser.

------------------------------------------------------------

## 🔧 Tech Stack

Frontend
- HTML / React
- AnyGravity
- Leaflet.js

Backend
- Firebase Firestore

Phone Sensor APIs
- DeviceMotion API
- DeviceOrientation API
- Geolocation API

Hosting
- Vercel / Netlify

------------------------------------------------------------

## ☁️ Firebase Database Structure

Collection: hazards

Example document:

{
  type: "pothole",
  latitude: 9.9816,
  longitude: 76.2999,
  intensity: 18,
  timestamp: 171000000
}

------------------------------------------------------------

## 🧪 Demo Plan

Step 1  
Open the dashboard on a laptop.

Step 2  
Open SenseStreet on a phone and press:

Start Road Scan

Step 3  
Tap the phone on a table.

System response:

Pothole detected  
Saving location

Marker appears on the map.

Step 4  
Shake the phone strongly.

System response:

Crash detected  
Emergency alert triggered

------------------------------------------------------------

## 🌍 Impact

SenseStreet creates a crowdsourced road intelligence network.

Benefits include:

- Early hazard detection
- Safer navigation
- Faster accident awareness
- Community safety data
- Improved road monitoring

With enough users, SenseStreet could build real-time road safety maps for entire cities.

------------------------------------------------------------

## 🚀 Vision

Every smartphone can become a road safety sensor.

By leveraging sensors already present in modern devices, SenseStreet demonstrates how technology can build a scalable, low-cost system that helps make streets safer for everyone.
