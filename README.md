# 🚀 Intelligent Conveyor Belt Monitoring System

An AI-powered, real-time conveyor belt monitoring system designed for industrial applications such as **mining, iron ore handling, and material transportation**.

The system combines **IoT-based machine condition monitoring**, **AI-powered computer vision**, and a **real-time web dashboard** to detect conveyor belt damage and monitor machine operating conditions.

---

## 📌 Project Overview

Conveyor belts used in mining and heavy industries operate continuously under high mechanical loads and harsh environmental conditions.

Over time, conveyor belts can develop:

- Holes
- Tears
- Surface damage
- Misalignment
- Abnormal vibration
- Excessive tension
- Abnormal motor current
- Temperature-related issues
- Speed/RPM abnormalities

If these problems are detected late, they can result in:

- Unexpected conveyor failure
- Production downtime
- Increased maintenance costs
- Material losses
- Safety risks

To address this problem, this project combines **real-time sensor monitoring with AI-based visual inspection**.

The system continuously collects machine-condition parameters using an **ESP32** while a camera monitors the physical condition of the conveyor belt.

The collected information is displayed on a unified web dashboard.

---

# 🎯 Objectives

The main objectives of this project are:

- Monitor conveyor belt operating conditions in real time.
- Detect visible belt defects using artificial intelligence.
- Monitor vibration and motor current.
- Monitor temperature and humidity.
- Monitor conveyor/motor RPM.
- Monitor belt alignment.
- Monitor belt tension.
- Display motor and relay states.
- Provide a centralized real-time monitoring dashboard.
- Calculate machine health and failure-risk indicators.
- Provide early warning of abnormal operating conditions.
- Reduce unexpected downtime.
- Support preventive and predictive maintenance.

---

# 🧠 Key Features

### 🔹 Real-Time Sensor Monitoring

The ESP32 continuously collects machine-condition parameters and sends them to the monitoring server.

Monitored parameters include:

- Vibration
- Motor current
- Temperature
- Humidity
- RPM
- Belt alignment
- Belt tension
- Motor A status
- Motor B status
- Relay status

---

### 🔹 AI-Based Conveyor Belt Inspection

A camera continuously observes the conveyor belt.

The captured images are sent to a trained computer vision model for analysis.

The AI system is designed to detect:

- `Damage`
- `Hole`
- `Tear`

The dashboard can display:

- Detected defect
- Confidence score
- Defect location
- Segmentation outline when available
- Defect severity

---

### 🔹 Real-Time Web Dashboard

The web dashboard provides a centralized view of the conveyor system.

It combines:

```text
Sensor Data
      +
Camera Feed
      +
AI Detection
      +
Machine Health
      +
Failure Risk
      =
Unified Monitoring Dashboard
````

---

### 🔹 Machine Health Monitoring

The system calculates a basic machine health indicator using sensor values.

The dashboard can indicate conditions such as:

```text
NORMAL
WARNING
CRITICAL
```

AI-based defect detection can also contribute to the machine status.

---

# 🏗️ System Architecture

```text
                         CONVEYOR BELT
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
       ┌──────────────┐                ┌──────────────┐
       │   Sensors    │                │ Camera/Webcam │
       │              │                │              │
       │ Vibration    │                │ Belt Surface │
       │ Current      │                │ Inspection   │
       │ Temperature  │                └──────┬───────┘
       │ Humidity     │                       │
       │ RPM          │                       │
       │ Alignment    │                       │
       │ Tension      │                       │
       └──────┬───────┘                       │
              │                               │
              ▼                               ▼
       ┌──────────────┐                ┌──────────────┐
       │    ESP32     │                │   Browser    │
       └──────┬───────┘                └──────┬───────┘
              │                               │
              │ USB Serial                    │ HTTP
              │                               │
              └──────────────┬────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │    Node.js Server   │
                  │                     │
                  │ Express             │
                  │ SerialPort          │
                  │ WebSocket           │
                  │ AI API Integration  │
                  └─────────┬───────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
             ┌──────────────┐  ┌───────────────┐
             │  Roboflow AI │  │ Web Dashboard │
             │    Model     │  │               │
             └──────────────┘  └───────────────┘
```

---

# 🔧 Hardware Components

The prototype uses an ESP32 as the primary embedded controller.

### Main Hardware

* ESP32 development board
* Vibration sensor
* Current sensor
* Temperature sensor
* Humidity sensor
* RPM/speed sensor
* Belt alignment sensor
* Belt tension sensor
* Relay module
* Motor/conveyor mechanism
* Webcam/camera
* USB cable
* Conveyor belt prototype

> The exact sensor models and electrical connections may vary depending on the prototype implementation.

---

# 💻 Software Stack

## Embedded System

* ESP32
* Arduino IDE
* C/C++
* Serial communication
* 115200 baud communication

## Backend

* Node.js
* Express.js
* Axios
* SerialPort
* WebSocket (`ws`)
* dotenv

## Frontend

* HTML5
* CSS3
* JavaScript
* Browser Camera API
* WebSocket communication

## AI / Computer Vision

* Roboflow
* YOLO-based computer vision
* Instance Segmentation
* Conveyor belt damage dataset/model

---

# 🤖 AI Model

The computer vision component is based on a trained conveyor-belt damage model.

## Dataset

Dataset:

```text
Conveyor-belt-damage
```

Task:

```text
Instance Segmentation
```

Dataset size:

```text
922 images
```

Classes:

```text
Damage
Hole
Tear
```

---

# 🎨 Instance Segmentation

The project uses an instance-segmentation model rather than relying only on rectangular object detection.

When polygon information is available, the dashboard can display the actual detected defect outline.

Conceptually:

```text
Traditional Object Detection

┌─────────────────────┐
│                     │
│       DEFECT        │
│                     │
└─────────────────────┘


Instance Segmentation

       ╱──────────╲
     ╱              ╲
    │     DEFECT      │
     ╲              ╱
       ╲──────────╱
```

This provides a more detailed representation of the damaged region.

If segmentation points are not returned by the inference service, the dashboard can fall back to a bounding rectangle.

---

# 📊 Monitored Parameters

| Parameter      | Purpose                                 |
| -------------- | --------------------------------------- |
| Vibration      | Detect abnormal mechanical vibration    |
| Motor Current  | Identify abnormal motor/mechanical load |
| Temperature    | Monitor overheating                     |
| Humidity       | Monitor environmental conditions        |
| RPM            | Monitor motor/conveyor speed            |
| Alignment      | Detect belt tracking problems           |
| Belt Tension   | Monitor abnormal belt tension           |
| Motor A        | Monitor motor operating state           |
| Motor B        | Monitor motor operating state           |
| Relay          | Monitor control state                   |
| AI Detection   | Detect visible belt defects             |
| Confidence     | Indicate AI prediction confidence       |
| Machine Health | Overall machine condition               |
| Failure Risk   | Basic calculated risk indicator         |

---

# 🔄 Data Flow

The system operates using the following data flow:

```text
Sensors
   ↓
ESP32
   ↓
USB Serial
   ↓
Node.js Server
   ↓
Data Processing
   ↓
WebSocket
   ↓
Dashboard
```

For AI inspection:

```text
Camera
   ↓
Image Frame
   ↓
Browser
   ↓
POST /api/infer
   ↓
Node.js
   ↓
Roboflow Model
   ↓
Prediction
   ↓
Dashboard
```

---

# 🌐 Backend APIs

The Node.js server provides several endpoints.

## Get Server Status

```http
GET /api/status
```

Returns information about:

* Server status
* Serial connection
* Serial port
* Baud rate
* Available ports
* Roboflow configuration status

---

## Get Current Sensor Data

```http
GET /api/data
```

Returns the latest normalized machine data.

---

## Send Sensor Data

```http
POST /api/data
```

Used to send sensor information to the backend.

---

## Connect Serial Port

```http
POST /api/connect
```

Used to connect the monitoring server to a selected serial port.

---

## AI Inference

```http
POST /api/infer
```

Receives an image frame and sends it to the configured computer vision inference service.

---

# 📡 WebSocket Communication

The system uses WebSockets for real-time dashboard updates.

The server can broadcast events including:

```text
sensor
serial
serialLine
detection
```

This allows the dashboard to update dynamically without requiring continuous page refreshes.

---

# 🔌 ESP32 Communication

The ESP32 communicates with the Node.js server through USB serial communication.

Default configuration:

```text
Port: COM7
Baud Rate: 115200
```

The actual COM port may differ between computers.

For example:

```text
COM3
COM4
COM5
COM7
```

The correct port should be configured in the `.env` file.

---

# 📦 Example Sensor Data

The backend supports JSON sensor packets.

Example:

```json
{
  "vibration": 0,
  "current": 2.1,
  "temperature": 31.5,
  "humidity": 62,
  "rpm": 1450,
  "alignment": 0,
  "tension": 50,
  "motorA": "RUNNING",
  "motorB": "RUNNING",
  "relay": "ON"
}
```

---

# 🧮 Machine Health Logic

The current prototype uses sensor values to generate a basic risk indicator.

Parameters considered include:

* Vibration
* Motor current
* Temperature
* RPM

The system derives:

```text
Sensor Values
      ↓
Risk Evaluation
      ↓
Failure Risk
      ↓
Machine Health
      ↓
NORMAL / WARNING / CRITICAL
```

The AI detection system can also raise the machine status when a defect such as a hole, tear, puncture, or damage is detected.

> The current risk calculation is a prototype rule-based indicator. It is not a certified industrial safety or predictive-maintenance algorithm.

---

# 📁 Project Structure

```text
conveyor-dashboard-auto/
│
├── esp32/
│   ├── esp32_serial_example.ino
│   └── smart_mach_esp32.ino
│
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── .venv/
│
├── node_modules/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

---

# ⚙️ Installation

## 1. Install Node.js

Install a current LTS version of Node.js.

Verify:

```bash
node --version
npm --version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/conveyor-belt-monitoring-system.git
```

Then:

```bash
cd conveyor-belt-monitoring-system
```

---

## 3. Install Dependencies

```bash
npm install
```

---

# 🔐 Environment Configuration

Create a `.env` file in the project root.

Example:

```env
PORT=3000

SERIAL_PORT=COM7
BAUD=115200

ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY
ROBOFLOW_PROJECT_ID=YOUR_ROBOFLOW_PROJECT_ID
ROBOFLOW_VERSION=1
```

### Important

The values above are **placeholders only**.

Never commit your real API key to GitHub.

---

# 🛡️ API Key Security

The Roboflow API key must remain private.

### ❌ Never do this:

```env
ROBOFLOW_API_KEY=actual-secret-key
```

inside a public README.

### ❌ Never hard-code it in JavaScript:

```javascript
const API_KEY = "actual-secret-key";
```

### ✅ Use `.env`:

```env
ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY
```

and access it from Node.js using environment variables.

---

# 🚫 Files That Should NOT Be Uploaded

The following files/directories should normally not be committed:

```text
.env
node_modules/
.venv/
*.log
```

The `.env` file is especially important because it can contain API credentials.

---

# 📝 Recommended .gitignore

Create a `.gitignore` file containing:

```gitignore
node_modules/
.venv/

.env
.env.*
!.env.example

*.log

.DS_Store
Thumbs.db

.vscode/
.idea/
```

---

# 🧪 .env.example

For other developers, create:

```text
.env.example
```

with:

```env
PORT=3000

SERIAL_PORT=COM7
BAUD=115200

ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY
ROBOFLOW_PROJECT_ID=YOUR_ROBOFLOW_PROJECT_ID
ROBOFLOW_VERSION=1
```

This file is safe to publish because it contains placeholders instead of credentials.

---

# ▶️ Running the Project

Start the Node.js server:

```bash
npm start
```

Expected output:

```text
Dashboard: http://localhost:3000
Serial:    COM7 @ 115200
Roboflow:  PROJECT_ID/1
ESP32 connected: COM7 @ 115200
```

Open the dashboard:

```text
http://localhost:3000
```

---

# 📷 Camera Setup

The browser uses the connected camera/webcam for conveyor inspection.

Recommended camera setup:

* Position the camera so the belt surface is clearly visible.
* Avoid excessive glare.
* Maintain consistent lighting.
* Keep the belt within the trained model's expected visual conditions.
* Avoid unnecessary background objects.
* Use sufficient image resolution.
* Ensure defects are visible in the camera frame.

---

# 🤖 AI Detection Process

The AI inspection process is:

```text
1. Camera captures belt image
             ↓
2. Browser prepares image
             ↓
3. Image sent to Node.js
             ↓
4. Node.js sends image to AI inference service
             ↓
5. AI model processes the image
             ↓
6. Prediction returned
             ↓
7. Best prediction selected
             ↓
8. Dashboard displays detection
```

---

# 🚦 Defect Severity

The prototype can classify detections into severity levels based on confidence.

Example:

```text
Confidence < 85%
        ↓
     WARNING

Confidence >= 85%
        ↓
    CRITICAL
```

These thresholds are configurable and should be validated using real industrial data before operational deployment.

---

# 🛠️ Troubleshooting

## ESP32 Access Denied

If the terminal shows:

```text
Could not open COM7: Access denied
```

possible causes include:

* Arduino Serial Monitor is open.
* Arduino Serial Plotter is open.
* Another application is using the serial port.
* Another Node.js process is connected to the port.

### Solution

1. Close Arduino Serial Monitor.
2. Close Arduino Serial Plotter.
3. Stop duplicate Node.js processes.
4. Confirm the correct COM port.
5. Restart the Node.js server.

---

# 🔴 Roboflow Timeout

If the terminal displays:

```text
Roboflow inference error:
timeout
```

check:

* Internet connection
* Roboflow API key
* Project ID
* Model version
* Inference endpoint
* Request format
* Image size
* Roboflow service status

---

# 🔴 Roboflow Socket Hang Up

Example:

```text
Roboflow inference error:
socket hang up
```

This means the connection to the inference service was closed before a normal response was received.

Possible causes include:

* Incorrect inference endpoint
* Incorrect request format
* Network connection issue
* API/service-side issue
* Request size or encoding issue
* Temporary inference-service problem

Check the backend inference configuration before changing the frontend.

---

# 🔴 AI Shows Rectangle Instead of Segmentation

If the dashboard displays only a rectangular bounding box instead of the actual defect shape, possible reasons include:

* The inference response does not contain polygon points.
* The selected inference endpoint does not return segmentation data.
* The model response format differs from the expected format.
* The frontend is falling back to bounding-box rendering.

For true segmentation visualization, the inference response should contain polygon/mask information.

---

# 🔌 Arduino Serial Monitor Warning

Do not keep the Arduino Serial Monitor open while Node.js is trying to connect to the same ESP32 serial port.

Only one application should normally own the serial connection at a time.

---

# 🎥 Demonstration Workflow

A recommended project demonstration sequence:

### Step 1 — Introduce the Problem

Explain the challenges of conveyor belt monitoring in mining and industrial environments.

### Step 2 — Show Hardware

Show:

* ESP32
* Sensors
* Conveyor belt
* Motor
* Relay
* Camera

### Step 3 — Start the System

Start:

```bash
npm start
```

### Step 4 — Open Dashboard

Open:

```text
http://localhost:3000
```

### Step 5 — Show Sensor Monitoring

Demonstrate real-time:

* Temperature
* Humidity
* Current
* Vibration
* RPM
* Alignment
* Tension

### Step 6 — Show Camera

Display the live conveyor belt camera feed.

### Step 7 — Demonstrate Defect Detection

Present a visible belt defect such as:

```text
Hole
```

or:

```text
Tear
```

### Step 8 — Show AI Result

Display:

* Defect class
* Confidence
* Defect location
* Segmentation outline when available

### Step 9 — Show Machine Status

Demonstrate how abnormal conditions can change the machine status:

```text
NORMAL
     ↓
WARNING
     ↓
CRITICAL
```

### Step 10 — Conclusion

Explain that the system combines IoT sensor monitoring and AI vision into a single monitoring platform.

---

# 📈 Future Improvements

The project can be extended with:

## AI Improvements

* Faster inference
* Edge AI inference
* Local model deployment
* More damage classes
* Improved segmentation accuracy
* Model retraining with industrial images
* Automatic defect severity estimation
* Multi-camera inspection

## IoT Improvements

* Industrial-grade sensors
* Wireless ESP32 communication
* LoRa/LoRaWAN
* MQTT
* Sensor calibration
* Multiple ESP32 nodes
* Industrial PLC integration

## Dashboard Improvements

* Historical graphs
* Sensor data logging
* Event history
* Maintenance history
* Alert notifications
* User authentication
* Multi-conveyor monitoring
* Cloud dashboard
* Mobile dashboard

## Predictive Maintenance

Future versions can use historical machine data to predict failures before they occur.

Potential architecture:

```text
Historical Sensor Data
          +
AI Vision Data
          +
Machine Operating Data
          ↓
Machine Learning Model
          ↓
Failure Prediction
          ↓
Early Maintenance Alert
```

---

# 🏭 Industrial Deployment Possibilities

The concept can be extended for real industrial conveyor systems used in:

* Iron ore mining
* Coal handling
* Cement plants
* Steel plants
* Aggregate processing
* Ports
* Material handling facilities
* Manufacturing plants
* Bulk material transportation

For industrial deployment, the prototype would require appropriate industrial-grade hardware, calibration, environmental protection, networking, cybersecurity, and validation.

---

# ⚠️ Current Limitations

This project is currently a prototype/research and demonstration system.

Important limitations include:

* Prototype sensor hardware
* Rule-based machine-health calculation
* Dependence on network-based AI inference
* AI performance depends on training data
* Camera performance depends on lighting and positioning
* Industrial deployment requires additional validation
* Sensor thresholds are not universal for every conveyor system

---

# 🔒 Safety Disclaimer

This project is intended for **research, educational, prototyping, and demonstration purposes**.

It should not be used as the sole safety system for an industrial conveyor.

Before production deployment, the system should be validated against:

* Real industrial sensor data
* Actual conveyor operating conditions
* Industrial safety standards
* Professional engineering requirements
* Certified emergency-stop systems
* PLC/interlock systems
* Site-specific maintenance procedures

The AI predictions and prototype risk calculations should not replace certified safety equipment or professional maintenance decisions.

---

# 👨‍💻 Development

The project is structured around three main layers:

```text
┌───────────────────────────────┐
│          FRONTEND             │
│       HTML / CSS / JS         │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│           BACKEND             │
│      Node.js / Express        │
│      SerialPort / WebSocket   │
└───────────────┬───────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│    ESP32     │  │   AI Model   │
│   Sensors    │  │  Roboflow    │
└──────────────┘  └──────────────┘
```

---

# 🚀 Quick Start

For a quick setup:

```bash
git clone https://github.com/YOUR_USERNAME/conveyor-belt-monitoring-system.git

cd conveyor-belt-monitoring-system

npm install
```

Create `.env`:

```env
PORT=3000
SERIAL_PORT=COM7
BAUD=115200
ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY
ROBOFLOW_PROJECT_ID=YOUR_ROBOFLOW_PROJECT_ID
ROBOFLOW_VERSION=1
```

Then:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

---

# 📌 Project Status

## ✅ Implemented

* ESP32 integration
* Serial communication
* Sensor data acquisition
* Node.js backend
* Express server
* WebSocket communication
* Real-time dashboard
* Browser camera integration
* Roboflow integration
* AI detection interface
* Machine health indicator
* Failure-risk indicator
* Motor status monitoring
* Relay status monitoring

## 🔄 Under Development / Validation

* Real-time AI inference reliability
* Low-latency inference
* Segmentation performance
* Industrial sensor calibration
* Field testing
* Predictive-maintenance algorithms
* Historical data storage
* Automated alerts

---

# 🌟 Project Vision

The long-term vision of this project is to develop a low-cost intelligent monitoring platform capable of continuously observing conveyor systems and identifying abnormal conditions before they become major failures.

The overall concept is:

```text
MONITOR
   ↓
DETECT
   ↓
ANALYZE
   ↓
PREDICT
   ↓
ALERT
   ↓
PREVENT FAILURE
```

By combining **IoT + Computer Vision + Artificial Intelligence + Real-Time Monitoring**, the system aims to make conveyor belt maintenance more proactive, reliable, and data-driven.

---

# 👥 Contributors

**Conveyor Belt Monitoring Project Team**

Developed as an intelligent industrial monitoring prototype integrating:

**IoT + ESP32 + Computer Vision + AI + Web Technologies**

---

# 📜 License

Choose an appropriate open-source software license before publishing the repository.

Possible choices include:

* MIT License
* Apache License 2.0

If external datasets or models are used, their individual licenses and attribution requirements must also be respected.

---

# 🙏 Acknowledgements

This project makes use of technologies and ecosystems including:

* ESP32
* Arduino
* Node.js
* Express.js
* SerialPort
* WebSockets
* Roboflow
* YOLO / Computer Vision

---

## ⭐ If you find this project useful

Consider giving the repository a ⭐ on GitHub and sharing the project with others interested in:

* Industrial IoT
* Predictive Maintenance
* Computer Vision
* AI-based Inspection
* Smart Manufacturing
* Mining Technology
* Conveyor Belt Monitoring

````

### 🔴 Before you push to GitHub

Your project should have this structure:

```text
conveyor-dashboard-auto/
│
├── esp32/
├── public/
├── server.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
└── .env              ← DO NOT PUSH THIS
````

And your `.gitignore` **must contain**:

```gitignore
node_modules/
.venv/
.env
.env.*
!.env.example
*.log
.vscode/
.idea/
```

Also create `.env.example` with **only placeholders**:

```env
PORT=3000
SERIAL_PORT=COM7
BAUD=115200

ROBOFLOW_API_KEY=YOUR_ROBOFLOW_API_KEY
ROBOFLOW_PROJECT_ID=YOUR_ROBOFLOW_PROJECT_ID
ROBOFLOW_VERSION=1
```

That way, anyone looking at your GitHub repository knows **what variables they need**, but your actual Roboflow key never gets exposed. 🔐
