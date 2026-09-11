require("dotenv").config();

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { SerialPort } = require("serialport");
const os = require("os");
const axios = require("axios");

const PORT = Number(process.env.PORT || 3000);
const SERIAL_PATH = process.env.SERIAL_PORT || "COM7";
const BAUD = Number(process.env.BAUD || 115200);

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_PROJECT_ID = process.env.ROBOFLOW_PROJECT_ID;
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || "1";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

let serial = null;
let serialBuffer = "";

let lastSerialError = "";
let lastSerialLine = "";
let lastPacketAt = null;

let lastData = {
    vibration: null,
    current: null,
    temperature: null,
    humidity: null,
    rpm: null,
    alignment: null,
    tension: null,

    health: null,
    failureRisk: null,
    status: "WAITING",

    detection: {
        label: "No detection",
        confidence: 0,
        severity: "Normal"
    },

    ts: null
};


// ======================================================
// WEBSOCKET BROADCAST
// ======================================================

function broadcast(payload) {
    const msg = JSON.stringify(payload);

    wss.clients.forEach((ws) => {
        if (ws.readyState === 1) {
            ws.send(msg);
        }
    });
}


// ======================================================
// NUMBER HELPER
// ======================================================

function numberOr(value, fallback = null) {

    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
}


// ======================================================
// SENSOR DATA NORMALIZATION
// ======================================================

function normalizeData(obj) {

    const vibration = numberOr(
        obj.vibration ?? obj.vib,
        lastData.vibration
    );

    const current = numberOr(
        obj.current ?? obj.motorCurrent ?? obj.amps,
        lastData.current
    );

    const temperature = numberOr(
        obj.temperature ?? obj.temp,
        lastData.temperature
    );

    const humidity = numberOr(
        obj.humidity ?? obj.hum,
        lastData.humidity
    );

    const rpm = numberOr(
        obj.rpm ?? obj.speed,
        lastData.rpm
    );

    const alignment = numberOr(
        obj.alignment ?? obj.beltAlignment,
        lastData.alignment
    );

    const tension = numberOr(
        obj.tension ?? obj.beltTension,
        lastData.tension
    );


    // -----------------------------
    // SIMPLE SENSOR RISK
    // -----------------------------

    const risks = [];

    if (vibration !== null) {
        risks.push(
            vibration >= 4
                ? 70
                : vibration * 10
        );
    }

    if (current !== null) {
        risks.push(
            Math.max(0, current) >= 15
                ? 80
                : (Math.max(0, current) / 15) * 50
        );
    }

    if (temperature !== null) {
        risks.push(
            temperature >= 70
                ? 90
                : (temperature / 70) * 45
        );
    }

    if (rpm !== null && rpm > 0) {
        risks.push(
            rpm < 1400 || rpm > 1500
                ? 55
                : 5
        );
    }


    const failureRisk =
        risks.length
            ? Math.round(Math.min(100, Math.max(...risks)))
            : null;

    const health =
        failureRisk === null
            ? null
            : Math.max(0, 100 - failureRisk);


    let status;

    if (obj.status) {

        status = obj.status;

    } else if (failureRisk === null) {

        status = "WAITING";

    } else if (failureRisk >= 70) {

        status = "CRITICAL";

    } else if (failureRisk >= 30) {

        status = "WARNING";

    } else {

        status = "NORMAL";
    }


    lastData = {

        ...lastData,

        vibration,
        current,
        temperature,
        humidity,
        rpm,
        alignment,
        tension,

        health,
        failureRisk,
        status,

        motorA: obj.motorA ?? lastData.motorA,
        motorB: obj.motorB ?? lastData.motorB,
        relay: obj.relay ?? lastData.relay,

        ts: Date.now()
    };

    lastPacketAt = Date.now();

    broadcast({
        type: "sensor",
        data: lastData
    });
}


// ======================================================
// SERIAL PARSER
// ======================================================

function parseLine(line) {

    line = line.trim();

    if (!line) return;

    lastSerialLine = line;

    broadcast({
        type: "serialLine",
        line
    });


    // --------------------------------------------------
    // JSON DATA
    // --------------------------------------------------

    try {

        if (line.startsWith("{") && line.endsWith("}")) {

            const obj = JSON.parse(line);

            normalizeData(obj);

            return;
        }

    } catch (err) {

        console.log("JSON parse error:", err.message);
    }


    // --------------------------------------------------
    // TEXT DATA
    // --------------------------------------------------

    const obj = {};

    let m;


    m = line.match(
        /Temperature\s*:\s*(-?\d+(?:\.\d+)?)/i
    );

    if (m) {
        obj.temperature = Number(m[1]);
    }


    m = line.match(
        /Humidity\s*:\s*(-?\d+(?:\.\d+)?)/i
    );

    if (m) {
        obj.humidity = Number(m[1]);
    }


    m = line.match(
        /Current\s*:\s*(-?\d+(?:\.\d+)?)/i
    );

    if (m) {
        obj.current = Number(m[1]);
    }


    m = line.match(
        /RPM\s*:\s*(-?\d+(?:\.\d+)?)/i
    );

    if (m) {
        obj.rpm = Number(m[1]);
    }


    m = line.match(
        /Vibration\s*:\s*(DETECTED|NORMAL)/i
    );

    if (m) {

        obj.vibration =
            m[1].toUpperCase() === "DETECTED"
                ? 5
                : 0;
    }


    m = line.match(
        /Motor\s+A\s*:\s*(RUNNING|STOPPED)/i
    );

    if (m) {
        obj.motorA = m[1].toUpperCase();
    }


    m = line.match(
        /Motor\s+B\s*:\s*(RUNNING|STOPPED)/i
    );

    if (m) {
        obj.motorB = m[1].toUpperCase();
    }


    m = line.match(
        /Relay\s*:\s*(ON|OFF)/i
    );

    if (m) {
        obj.relay = m[1].toUpperCase();
    }


    if (Object.keys(obj).length > 0) {

        if (/Vibration\s*:/i.test(line)) {

            obj.status =
                obj.vibration > 0
                    ? "WARNING"
                    : undefined;
        }

        normalizeData(obj);
    }
}


// ======================================================
// SERIAL CONNECTION
// ======================================================

function connectSerial(path) {

    if (!path) return;


    if (serial) {

        try {
            serial.removeAllListeners();
        } catch (_) {}

        try {
            if (serial.isOpen) {
                serial.close();
            }
        } catch (_) {}

        serial = null;
    }


    serialBuffer = "";
    lastSerialError = "";


    try {

        const port = new SerialPort({
            path,
            baudRate: BAUD,
            autoOpen: false
        });

        serial = port;


        port.on("open", () => {

            broadcast({
                type: "serial",
                connected: true,
                path,
                baudRate: BAUD
            });

            console.log(
                `ESP32 connected: ${path} @ ${BAUD}`
            );
        });


        port.on("data", (chunk) => {

            serialBuffer += chunk.toString("utf8");

            const lines =
                serialBuffer.split(/\r?\n/);

            serialBuffer =
                lines.pop() || "";

            lines.forEach(parseLine);
        });


        port.on("error", (err) => {

            lastSerialError = err.message;

            broadcast({
                type: "serial",
                connected: false,
                path,
                error: err.message
            });

            console.error(
                `ESP32 serial error: ${err.message}`
            );
        });


        port.on("close", () => {

            broadcast({
                type: "serial",
                connected: false,
                path
            });
        });


        port.open((err) => {

            if (err) {

                lastSerialError = err.message;

                broadcast({
                    type: "serial",
                    connected: false,
                    path,
                    error: err.message
                });

                console.error(
                    `Could not open ${path}: ${err.message}`
                );
            }
        });

    } catch (err) {

        lastSerialError = err.message;

        broadcast({
            type: "serial",
            connected: false,
            path,
            error: err.message
        });
    }
}


// ======================================================
// STATUS API
// ======================================================

app.get("/api/status", async (req, res) => {

    let ports = [];

    try {
        ports = await SerialPort.list();
    } catch (_) {}


    res.json({

        serverTime: new Date().toISOString(),

        serialConnected:
            !!serial?.isOpen,

        serialPath:
            serial?.path || SERIAL_PATH,

        lastPacketAt,

        lastSerialLine,

        baudRate: BAUD,

        lastSerialError,

        ports: ports.map((p) => ({
            path: p.path,
            manufacturer: p.manufacturer,
            serialNumber: p.serialNumber
        })),

        roboflow: {
            configured:
                !!ROBOFLOW_API_KEY &&
                !!ROBOFLOW_PROJECT_ID,

            project:
                ROBOFLOW_PROJECT_ID || null,

            version:
                ROBOFLOW_VERSION
        }
    });
});


// ======================================================
// SENSOR DATA API
// ======================================================

app.get("/api/data", (req, res) => {

    res.json(lastData);
});


app.post("/api/data", (req, res) => {

    normalizeData(req.body || {});

    res.json({
        ok: true,
        data: lastData
    });
});


// ======================================================
// MANUAL SERIAL CONNECT
// ======================================================

app.post("/api/connect", (req, res) => {

    const path = req.body?.path;

    if (!path) {

        return res.status(400).json({
            ok: false,
            error: "Serial path required"
        });
    }


    if (serial?.isOpen) {

        serial.close();
    }

    serial = null;

    connectSerial(path);


    res.json({
        ok: true,
        path
    });
});


// ======================================================
// ROBOFLOW LIVE INFERENCE
// ======================================================

// ======================================================
// ROBOFLOW LIVE INFERENCE
// ======================================================

app.post("/api/infer", async (req, res) => {

    const startedAt = Date.now();

    try {

        if (!ROBOFLOW_API_KEY) {
            return res.status(500).json({
                ok: false,
                error: "ROBOFLOW_API_KEY missing in .env"
            });
        }

        if (!ROBOFLOW_PROJECT_ID) {
            return res.status(500).json({
                ok: false,
                error: "ROBOFLOW_PROJECT_ID missing in .env"
            });
        }

        let image = req.body?.image;

        if (!image) {
            return res.status(400).json({
                ok: false,
                error: "image is required"
            });
        }

        // Remove:
        // data:image/jpeg;base64,...
        if (image.includes(",")) {
            image = image.split(",")[1];
        }

        // --------------------------------------------------
        // CURRENT ROBOFLOW SERVERLESS HOSTED API
        // --------------------------------------------------

        const url =
            `https://serverless.roboflow.com/` +
            `${ROBOFLOW_PROJECT_ID}/` +
            `${ROBOFLOW_VERSION}`;

        console.log(
            `Roboflow request started: ${ROBOFLOW_PROJECT_ID}/${ROBOFLOW_VERSION}`
        );

        const response = await axios({
            method: "POST",
            url,

            params: {
                api_key: ROBOFLOW_API_KEY,

                // Lower confidence threshold so small
                // conveyor defects are not immediately filtered.
                confidence: 0.25
            },

            data: image,

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            timeout: 30000,

            maxContentLength: 20 * 1024 * 1024,
            maxBodyLength: 20 * 1024 * 1024
        });

        const result = response.data;

        const elapsed = Date.now() - startedAt;

        console.log(
            `Roboflow response received in ${elapsed} ms`
        );

        // --------------------------------------------------
        // PREDICTIONS
        // --------------------------------------------------

        const predictions =
            Array.isArray(result.predictions)
                ? result.predictions
                : [];

        console.log(
            `Roboflow predictions: ${predictions.length}`
        );

        // --------------------------------------------------
        // FIND BEST PREDICTION
        // --------------------------------------------------

        let best = null;

        for (const prediction of predictions) {

            const confidence =
                Number(prediction.confidence || 0);

            if (
                !best ||
                confidence >
                    Number(best.confidence || 0)
            ) {
                best = prediction;
            }
        }

        // --------------------------------------------------
        // DEFAULT DETECTION
        // --------------------------------------------------

        let detection = {
            label: "No detection",
            confidence: 0,
            severity: "Normal",
            points: null
        };

        // --------------------------------------------------
        // PROCESS BEST DETECTION
        // --------------------------------------------------

        if (best) {

            const confidence =
                Number(best.confidence || 0);

            let severity = "Warning";

            if (confidence >= 0.85) {
                severity = "Critical";
            }

            detection = {

                label:
                    best.class ||
                    best.label ||
                    "Damage",

                confidence,

                severity,

                x: best.x,
                y: best.y,
                width: best.width,
                height: best.height,

                // IMPORTANT:
                // Instance segmentation polygon
                points:
                    Array.isArray(best.points)
                        ? best.points
                        : null
            };

            console.log(
                `Detection: ${detection.label} | ` +
                `confidence: ${(confidence * 100).toFixed(1)}% | ` +
                `polygon points: ${
                    detection.points
                        ? detection.points.length
                        : 0
                }`
            );
        }

        // --------------------------------------------------
        // SAVE LATEST AI RESULT
        // --------------------------------------------------

        lastData.detection = detection;

        // --------------------------------------------------
        // UPDATE MACHINE STATUS
        // --------------------------------------------------

        if (best) {

            const label =
                String(
                    best.class ||
                    best.label ||
                    ""
                ).toLowerCase();

            if (
                label.includes("tear") ||
                label.includes("hole") ||
                label.includes("puncture") ||
                label.includes("damage")
            ) {

                lastData.status =
                    detection.severity === "Critical"
                        ? "CRITICAL"
                        : "WARNING";
            }
        }

        // --------------------------------------------------
        // SEND THROUGH WEBSOCKET
        // --------------------------------------------------

        broadcast({
            type: "detection",
            data: detection
        });

        // --------------------------------------------------
        // RESPONSE TO FRONTEND
        // --------------------------------------------------

        res.json({

            ok: true,

            inferenceTimeMs:
                Date.now() - startedAt,

            predictions,

            detection
        });

    } catch (err) {

        const elapsed =
            Date.now() - startedAt;

        console.error(
            "Roboflow inference error after",
            elapsed,
            "ms:"
        );

        if (err.response) {

            console.error(
                "Status:",
                err.response.status
            );

            console.error(
                "Response:",
                err.response.data
            );
        } else {

            console.error(
                err.message
            );
        }

        res.status(500).json({

            ok: false,

            error:
                err.response?.data ||
                err.message
        });
    }
});


// ======================================================
// WEBSOCKET
// ======================================================

wss.on("connection", (ws) => {

    ws.send(
        JSON.stringify({
            type: "sensor",
            data: lastData
        })
    );


    ws.send(
        JSON.stringify({
            type: "serial",
            connected:
                !!serial?.isOpen,

            path:
                serial?.path || SERIAL_PATH
        })
    );
});


// ======================================================
// LAN IP
// ======================================================

function getLanIPs() {

    const nets =
        os.networkInterfaces();

    const out = [];


    for (const name of Object.keys(nets)) {

        for (const n of nets[name] || []) {

            if (
                n.family === "IPv4" &&
                !n.internal
            ) {

                out.push(n.address);
            }
        }
    }


    return out;
}


// ======================================================
// START SERVER
// ======================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            `Dashboard: http://localhost:${PORT}`
        );

        getLanIPs().forEach((ip) => {

            console.log(
                `LAN:       http://${ip}:${PORT}`
            );
        });


        console.log(
            `Serial:    ${SERIAL_PATH} @ ${BAUD}`
        );


        if (
            ROBOFLOW_API_KEY &&
            ROBOFLOW_PROJECT_ID
        ) {

            console.log(
                `Roboflow:  ${ROBOFLOW_PROJECT_ID}/${ROBOFLOW_VERSION}`
            );

        } else {

            console.log(
                "Roboflow:  NOT CONFIGURED"
            );
        }


        connectSerial(SERIAL_PATH);
    }
);