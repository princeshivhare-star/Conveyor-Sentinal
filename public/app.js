const $ = id => document.getElementById(id);


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULTS = {
  vibration: 4,
  current: 15,
  temperature: 70,
  rpmMin: 1400,
  rpmMax: 1500,
  alignment: 3,
  tensionMin: 50,
  tensionMax: 80,
  sound: false,
  box: true,
  demoAI: false
};


/* =========================================================
   GLOBAL STATE
========================================================= */

let settings = {
  ...DEFAULTS,
  ...JSON.parse(
    localStorage.getItem('conveyorSettings') || '{}'
  )
};

// Always use REAL Roboflow / YOLO inference.
settings.demoAI = false;

let cameraStream = null;
let ws = null;
let latest = null;

let sampleHistory = [];

let alerts = JSON.parse(
  localStorage.getItem('conveyorAlerts') || '[]'
);

let logs = JSON.parse(
  localStorage.getItem('conveyorLogs') || '[]'
);

const trends = {
  vibration: [],
  current: [],
  temperature: []
};

let selectedSerialPath = '';
let connectingSerial = false;

let fpsTimer = null;

let inferenceBusy = false;
let inferenceTimer = null;
let lastPredictions = [];


/* =========================================================
   BASIC HELPERS
========================================================= */

function setText(id, value) {
  const el = $(id);

  if (el) {
    el.textContent = value;
  }
}


function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m])
  );
}


function now() {
  return new Date().toLocaleTimeString(
    'en-IN',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
  );
}


/* =========================================================
   LOGS + ALERTS
========================================================= */

function logEvent(event, details) {

  logs.unshift({
    time: now(),
    event,
    details
  });

  logs = logs.slice(0, 300);

  localStorage.setItem(
    'conveyorLogs',
    JSON.stringify(logs)
  );

  renderLogs();
}


function saveAlerts() {

  localStorage.setItem(
    'conveyorAlerts',
    JSON.stringify(alerts)
  );
}


function addAlert(
  type,
  message,
  severity = 'Info',
  value = '—',
  dedupe = false
) {

  if (
    dedupe &&
    alerts[0] &&
    alerts[0].message === message &&
    Date.now() - alerts[0].stamp < 15000
  ) {
    return;
  }

  alerts.unshift({
    time: now(),
    type,
    message,
    severity,
    value,
    stamp: Date.now()
  });

  alerts = alerts.slice(0, 100);

  saveAlerts();
  renderAlerts();

  logEvent(
    'Alert',
    `${type}: ${message}`
  );

  if (
    settings.sound &&
    severity === 'High'
  ) {
    beep();
  }
}


function beep() {

  try {

    const audioContext =
      new AudioContext();

    const oscillator =
      audioContext.createOscillator();

    oscillator.connect(
      audioContext.destination
    );

    oscillator.frequency.value = 800;

    oscillator.start();

    setTimeout(() => {

      oscillator.stop();
      audioContext.close();

    }, 150);

  } catch (e) {}
}


function renderAlerts() {

  const recent = $('alerts');
  const all = $('allAlerts');

  const rows = alerts
    .slice(0, 5)
    .map(a => `
      <tr>
        <td>${esc(a.time)}</td>

        <td>${esc(a.type)}</td>

        <td class="${a.severity === 'High' ? 'danger' : ''}">
          ${esc(a.message)}
        </td>

        <td class="${
          a.severity === 'High'
            ? 'danger'
            : a.severity === 'Medium'
              ? 'medium'
              : 'info'
        }">
          ${esc(a.severity)}
        </td>
      </tr>
    `)
    .join('');

  if (recent) {

    recent.innerHTML =
      rows ||
      '<tr><td colspan="4" class="empty">No alerts</td></tr>';

  }

  if (all) {

    all.innerHTML =
      alerts
        .map(a => `
          <tr>
            <td>${esc(a.time)}</td>

            <td>${esc(a.type)}</td>

            <td>${esc(a.message)}</td>

            <td class="${
              a.severity === 'High'
                ? 'danger'
                : a.severity === 'Medium'
                  ? 'medium'
                  : 'info'
            }">
              ${esc(a.severity)}
            </td>

            <td>${esc(a.value)}</td>
          </tr>
        `)
        .join('') ||
      '<tr><td colspan="5" class="empty">No alerts</td></tr>';
  }

  setText(
    'alertBadge',
    alerts.filter(
      a => a.severity === 'High'
    ).length
  );
}


function renderLogs() {

  const el = $('logsTable');

  if (!el) return;

  el.innerHTML =
    logs
      .map(l => `
        <tr>
          <td>${esc(l.time)}</td>
          <td>${esc(l.event)}</td>
          <td>${esc(l.details)}</td>
        </tr>
      `)
      .join('') ||
    '<tr><td colspan="3" class="empty">No logs</td></tr>';
}


/* =========================================================
   SENSOR TABLE
========================================================= */

function renderSensorTable() {

  const el = $('sensorTable');

  if (!el) return;

  el.innerHTML =
    sampleHistory
      .slice(0, 50)
      .map(d => `
        <tr>
          <td>${esc(d.time)}</td>

          <td>
            ${Number(d.vibration || 0).toFixed(1)} mm/s
          </td>

          <td>
            ${Number(d.current || 0).toFixed(1)} A
          </td>

          <td>
            ${Number(d.temperature || 0).toFixed(1)} °C
          </td>

          <td>
            ${Math.round(Number(d.rpm || 0))}
          </td>

          <td>
            ${Number(d.alignment || 0).toFixed(1)}°
          </td>

          <td>
            ${Number(d.tension || 0).toFixed(1)}%
          </td>

          <td>
            ${Math.round(Number(d.health || 0))}
          </td>

          <td>
            ${Math.round(Number(d.failureRisk || 0))}%
          </td>
        </tr>
      `)
      .join('') ||
    '<tr><td colspan="9" class="empty">Waiting for ESP32 readings…</td></tr>';

  setText(
    'sampleCount',
    sampleHistory.length
  );

  setText(
    'lastUpdate',
    sampleHistory[0]?.time || '--'
  );
}


/* =========================================================
   CLOCK
========================================================= */

function updateClock() {

  const d = new Date();

  setText(
    'date',
    d.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    )
  );

  setText(
    'time',
    d.toLocaleTimeString(
      'en-IN',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }
    )
  );
}


setInterval(
  updateClock,
  1000
);

updateClock();


/* =========================================================
   ESP32 CONNECTION
========================================================= */

function setConnection(ok) {

  const box = $('onlineBox');

  box?.classList.toggle(
    'off',
    !ok
  );

  setText(
    'onlineText',
    ok
      ? 'System Online'
      : 'System Offline'
  );

  setText(
    'connectionText',
    ok
      ? 'Connected to ESP32'
      : 'ESP32 disconnected'
  );

  setText(
    'sensorConnection',
    ok
      ? 'Online'
      : 'Offline'
  );

  setText(
    'serialState',
    ok
      ? 'Connected'
      : 'Disconnected'
  );
}


/* =========================================================
   SENSOR DATA
========================================================= */

function updateUI(d) {

  if (!d) return;

  latest = {
    ...d
  };

  const vals = {

    vibration:
      Number(d.vibration) || 0,

    current:
      Number(d.current) || 0,

    temperature:
      Number(d.temperature) || 0,

    rpm:
      Number(d.rpm) || 0,

    alignment:
      Number(d.alignment) || 0,

    tension:
      Number(d.tension) || 0
  };


  Object.entries(vals).forEach(
    ([key, value]) => {

      setText(
        key,

        key === 'rpm'
          ? Math.round(value)
          : value.toFixed(1)
      );

    }
  );


  let health =
    Number.isFinite(
      Number(d.health)
    )
      ? Number(d.health)
      : 100;


  let risk =
    Number.isFinite(
      Number(d.failureRisk)
    )
      ? Number(d.failureRisk)
      : 100 - health;


  health = Math.max(
    0,
    Math.min(100, health)
  );

  risk = Math.max(
    0,
    Math.min(100, risk)
  );


  setText(
    'health',
    Math.round(health)
  );


  setText(
    'risk',
    Math.round(risk) + '%'
  );


  const status =
    d.status ||
    (
      risk >= 60
        ? 'CRITICAL'
        : risk >= 25
          ? 'WARNING'
          : 'NORMAL'
    );


  setText(
    'status',
    status
  );


  const gauge =
    $('gauge');

  if (gauge) {

    const gaugeColor =
      status === 'NORMAL'
        ? '#20c879'
        : '#ffab00';

    gauge.style.background =
      `conic-gradient(${gaugeColor} 0 ${health}%,#193144 ${health}% 100%)`;
  }


  setText(
    'recommendation',

    risk >= 60
      ? 'Stop or inspect the conveyor immediately.'
      : risk >= 25
        ? 'Monitor closely and schedule inspection at the earliest.'
        : 'All monitored parameters are within configured limits.'
  );


  setText(
    'liveVibration',
    vals.vibration.toFixed(1) + ' mm/s'
  );

  setText(
    'liveCurrent',
    vals.current.toFixed(1) + ' A'
  );

  setText(
    'liveTemperature',
    vals.temperature.toFixed(1) + ' °C'
  );

  setText(
    'liveRpm',
    Math.round(vals.rpm) + ' rpm'
  );

  setText(
    'liveHealth',
    Math.round(health) + '/100'
  );

  setText(
    'liveRisk',
    Math.round(risk) + '%'
  );


  if (d.detection) {

    const rawConfidence =
      Number(d.detection.confidence);

    const confidence =
      rawConfidence > 1
        ? rawConfidence
        : rawConfidence * 100;

    setDetection(
      d.detection.label || 'Unknown',
      confidence,
      d.detection.severity || 'Normal',
      d.detection.description ||
        'Sensor/AI data received'
    );
  }


  const sample = {

    ...vals,

    health,

    failureRisk:
      risk,

    time:
      now(),

    stamp:
      Date.now()
  };


  sampleHistory.unshift(sample);

  sampleHistory =
    sampleHistory.slice(0, 300);


  localStorage.setItem(
    'conveyorSamples',
    JSON.stringify(sampleHistory)
  );


  trends.vibration.push(
    vals.vibration
  );

  trends.current.push(
    vals.current
  );

  trends.temperature.push(
    vals.temperature
  );


  Object.keys(trends).forEach(
    key => {

      while (
        trends[key].length > 60
      ) {
        trends[key].shift();
      }

    }
  );


  drawChart();

  renderSensorTable();

  checkThresholds(vals);
}


/* =========================================================
   THRESHOLD ALERTS
========================================================= */

function checkThresholds(v) {

  if (
    v.vibration >
    settings.vibration
  ) {

    addAlert(
      'Vibration',
      `Vibration above ${settings.vibration} mm/s`,
      'Medium',
      v.vibration.toFixed(1) + ' mm/s',
      true
    );
  }


  if (
    v.current >
    settings.current
  ) {

    addAlert(
      'Motor Current',
      `Current above ${settings.current} A`,
      'High',
      v.current.toFixed(1) + ' A',
      true
    );
  }


  if (
    v.temperature >
    settings.temperature
  ) {

    addAlert(
      'Temperature',
      `Temperature above ${settings.temperature} °C`,
      'High',
      v.temperature.toFixed(1) + ' °C',
      true
    );
  }


  if (
    v.rpm < settings.rpmMin ||
    v.rpm > settings.rpmMax
  ) {

    addAlert(
      'RPM',
      `RPM outside ${settings.rpmMin}-${settings.rpmMax}`,
      'Medium',
      Math.round(v.rpm) + ' rpm',
      true
    );
  }


  if (
    v.alignment >
    settings.alignment
  ) {

    addAlert(
      'Alignment',
      `Belt alignment above ${settings.alignment}°`,
      'Medium',
      v.alignment.toFixed(1) + '°',
      true
    );
  }


  if (
    v.tension < settings.tensionMin ||
    v.tension > settings.tensionMax
  ) {

    addAlert(
      'Tension',
      `Belt tension outside ${settings.tensionMin}-${settings.tensionMax}%`,
      'Medium',
      v.tension.toFixed(1) + '%',
      true
    );
  }
}


/* =========================================================
   AI RESULT UI
========================================================= */

function setDetection(
  label,
  confidence,
  severity,
  description
) {

  confidence =
    Number(confidence) || 0;


  setText(
    'className',
    label
  );


  setText(
    'confidence',
    Math.round(confidence)
  );


  setText(
    'severity',
    severity
  );


  setText(
    'detectionDescription',
    description
  );


  setText(
    'aiClass',
    label
  );


  setText(
    'aiConfidence',
    Math.round(confidence) + '%'
  );


  setText(
    'aiSeverity',
    severity
  );


  setText(
    'aiLastScan',
    now()
  );


  setText(
    'aiMessage',
    description
  );


  setText(
    'aiState',

    label === 'No detection'
      ? 'AI STANDBY'
      : label === 'AI Error'
        ? 'AI ERROR'
        : 'AI DETECTION ACTIVE'
  );


  const normalized =
    Math.max(
      0,
      Math.min(100, confidence)
    ) / 100;


  setText(
    'cameraConfidence',
    normalized.toFixed(2)
  );


  setText(
    'liveConfidence',
    normalized.toFixed(2)
  );


  setText(
    'aiConfidenceBox',
    normalized.toFixed(2)
  );


  if (
    label !== 'No detection' &&
    label !== 'AI Error'
  ) {

    addAlert(
      'AI Detection',
      `${label} detected (${Math.round(confidence)}%)`,
      severity,
      Math.round(confidence) + '%',
      true
    );
  }
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connectWS() {

  try {

    ws =
      new WebSocket(
        (
          location.protocol === 'https:'
            ? 'wss://'
            : 'ws://'
        ) + location.host
      );


    ws.onopen = () => {

      logEvent(
        'WebSocket',
        'Dashboard connection established'
      );
    };


    ws.onmessage = event => {

      try {

        const message =
          JSON.parse(event.data);


        if (
          message.type === 'sensor'
        ) {

          updateUI(
            message.data
          );
        }


        if (
          message.type === 'serial'
        ) {

          setConnection(
            !!message.connected
          );
        }


        if (
          message.type === 'serialLine'
        ) {

          setText(
            'serialLastLine',
            message.line
          );
        }


        if (
          message.type === 'detection'
        ) {

          handleServerDetection(
            message.data
          );
        }

      } catch (error) {

        console.error(
          'WebSocket message error:',
          error
        );
      }
    };


    ws.onclose = () => {

      setConnection(false);

      setTimeout(
        connectWS,
        1500
      );
    };


    ws.onerror = () => {

      setConnection(false);
    };


  } catch (error) {

    setConnection(false);

    setTimeout(
      connectWS,
      1500
    );
  }
}


/* =========================================================
   SERVER DETECTION
========================================================= */

function handleServerDetection(data) {

  if (!data) return;


  if (data.predictions) {

    lastPredictions =
      data.predictions;


    drawPredictions(
      lastPredictions
    );


    if (
      lastPredictions.length === 0
    ) {

      setDetection(
        'No detection',
        0,
        'Normal',
        'No belt damage detected in the latest inspection.'
      );

      return;
    }


    const best =
      lastPredictions
        .slice()
        .sort(
          (a, b) => {

            const ca =
              Number(a.confidence || 0);

            const cb =
              Number(b.confidence || 0);

            return cb - ca;
          }
        )[0];


    const rawConfidence =
      Number(best.confidence || 0);


    const confidence =
      rawConfidence > 1
        ? rawConfidence
        : rawConfidence * 100;


    const label =
      best.class ||
      best.label ||
      'Unknown';


    const severity =
      severityForClass(
        label,
        confidence
      );


    setDetection(
      label,
      confidence,
      severity,
      `${lastPredictions.length} damage detection(s) found by YOLO.`
    );
  }
}


/* =========================================================
   SERIAL PORT
========================================================= */

async function connectSerialPath(
  path,
  silent = false
) {

  if (
    !path ||
    connectingSerial
  ) {
    return;
  }


  connectingSerial = true;

  selectedSerialPath =
    path;


  try {

    const response =
      await fetch(
        '/api/connect',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              path
            })
        }
      );


    const output =
      await response.json();


    if (!response.ok) {

      throw new Error(
        output.error ||
        'Connection failed'
      );
    }


    setText(
      'serialState',
      'Connecting...'
    );


    if (!silent) {

      logEvent(
        'ESP32',
        'Connecting to ' + path
      );
    }


  } catch (error) {

    setConnection(false);


    if (!silent) {

      alert(
        'Could not connect to ESP32: ' +
        error.message
      );
    }

  } finally {

    connectingSerial = false;
  }
}


async function loadPorts(
  autoConnect = true
) {

  try {

    const response =
      await fetch(
        '/api/status'
      );


    const status =
      await response.json();


    const ports =
      status.ports || [];


    const html =
      ports.length
        ? ports
            .map(
              port => `
                <option value="${esc(port.path)}">
                  ${esc(port.path)}
                  ${
                    port.manufacturer
                      ? ' — ' +
                        esc(port.manufacturer)
                      : ''
                  }
                </option>
              `
            )
            .join('')

        : '<option value="">No serial ports found</option>';


    const portSelect =
      $('portSelect');


    if (portSelect) {

      portSelect.innerHTML =
        html;
    }


    /*
     * IMPORTANT:
     * If server already has COM7 open,
     * DO NOT call /api/connect again.
     */

    if (status.serialConnected) {

      setConnection(true);

      selectedSerialPath =
        status.serialPath ||
        selectedSerialPath;


      if (
        selectedSerialPath &&
        portSelect
      ) {

        portSelect.value =
          selectedSerialPath;
      }

      return;
    }


    setConnection(false);


    /*
     * Initial connection only.
     * Prefer COM7 because that is the
     * configured ESP32 port.
     */

    if (
      autoConnect &&
      ports.length
    ) {

      const preferred =
        ports.find(
          p =>
            p.path ===
            selectedSerialPath
        ) ||

        ports.find(
          p =>
            p.path ===
            'COM7'
        ) ||

        ports[0];


      if (portSelect) {

        portSelect.value =
          preferred.path;
      }


      await connectSerialPath(
        preferred.path,
        true
      );
    }


  } catch (error) {

    const portSelect =
      $('portSelect');


    if (portSelect) {

      portSelect.innerHTML =
        '<option value="">Server unavailable</option>';
    }


    setConnection(false);
  }
}


$('portSelect')?.addEventListener(
  'change',
  () => {

    const path =
      $('portSelect').value;


    if (path) {

      connectSerialPath(
        path
      );
    }
  }
);


if ($('connectBtn')) {

  $('connectBtn').onclick =
    () =>
      connectSerialPath(
        $('portSelect').value
      );
}


/* =========================================================
   CAMERA
========================================================= */

async function listCameras(
  selects = [
    'cameraSelect',
    'liveCameraSelect'
  ]
) {

  try {

    /*
     * Ask browser for camera permission
     * first so device labels become available.
     */

    const temporaryStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video: true,
          audio: false
        }
      );


    temporaryStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );


    const devices =
      await navigator.mediaDevices.enumerateDevices();


    const cameras =
      devices.filter(
        device =>
          device.kind ===
          'videoinput'
      );


    selects.forEach(
      id => {

        const select =
          $(id);


        if (!select) return;


        select.innerHTML =
          cameras.length

            ? cameras
                .map(
                  (camera, index) => `
                    <option value="${esc(camera.deviceId)}">
                      ${esc(
                        camera.label ||
                        'USB Camera ' +
                        (index + 1)
                      )}
                    </option>
                  `
                )
                .join('')

            : '<option value="">No camera found</option>';
      }
    );


    setText(
      'cameraState',
      cameras.length +
      ' camera(s) detected'
    );


  } catch (error) {

    setText(
      'cameraState',
      'Camera permission required'
    );


    console.error(
      'Camera listing error:',
      error
    );
  }
}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

  try {

    stopCamera(false);


    const cameraSelect =
      $('cameraSelect');


    const deviceId =
      cameraSelect?.value || '';


    cameraStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video: {

            deviceId:
              deviceId
                ? { exact: deviceId }
                : undefined,

            width: {
              ideal: 1280
            },

            height: {
              ideal: 720
            },

            frameRate: {
              ideal: 30,
              max: 30
            }
          },

          audio: false
        }
      );


    const videoIds = [
      'camera',
      'liveCamera',
      'aiCamera'
    ];


    videoIds.forEach(
      id => {

        const video =
          $(id);


        if (!video) return;


        video.srcObject =
          cameraStream;


        video.muted = true;


        video.setAttribute(
          'playsinline',
          ''
        );


        video.style.display =
          'block';


        video.play().catch(
          () => {}
        );
      }
    );


    const wrappers = [
      'cameraWrap',
      'liveCameraWrap',
      'aiCameraWrap'
    ];


    wrappers.forEach(
      id =>
        $(id)?.classList.add(
          'active'
        )
    );


    setText(
      'cameraState',
      'Camera connected'
    );


    logEvent(
      'Camera',
      'USB webcam started'
    );


    startFPS();


    /*
     * Start REAL YOLO inference.
     */

    startLiveInference();


  } catch (error) {

    setText(
      'cameraState',
      'Camera failed: ' +
      error.name
    );


    console.error(
      'Camera start error:',
      error
    );


    alert(
      'Camera could not start.\n\n' +
      error.name +
      ': ' +
      error.message +
      '\n\nMake sure the webcam is connected and not being used by another application.'
    );
  }
}


/* =========================================================
   STOP CAMERA
========================================================= */

function stopCamera(
  log = true
) {

  stopLiveInference();

  clearDetectionOverlays();


  if (cameraStream) {

    cameraStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );


    cameraStream = null;
  }


  [
    'camera',
    'liveCamera',
    'aiCamera'
  ].forEach(
    id => {

      const video =
        $(id);


      if (!video) return;


      video.pause();

      video.srcObject =
        null;
    }
  );


  [
    'cameraWrap',
    'liveCameraWrap',
    'aiCameraWrap'
  ].forEach(
    id =>
      $(id)?.classList.remove(
        'active'
      )
  );


  if (log) {

    setText(
      'cameraState',
      'Camera stopped'
    );


    logEvent(
      'Camera',
      'USB webcam stopped'
    );
  }
}


/* =========================================================
   CAMERA FPS
========================================================= */

function startFPS() {

  clearInterval(
    fpsTimer
  );


  let frames = 0;


  function countFrames() {

    if (cameraStream) {
      frames++;
    }


    requestAnimationFrame(
      countFrames
    );
  }


  requestAnimationFrame(
    countFrames
  );


  fpsTimer =
    setInterval(
      () => {

        setText(
          'fps',
          frames
        );


        setText(
          'liveFps',
          frames
        );


        frames = 0;

      },
      1000
    );
}


/* =========================================================
   REAL YOLO / ROBOFLOW INFERENCE
========================================================= */

function getActiveVideo() {

  if (
    $('view-ai')?.classList.contains(
      'active-view'
    ) &&

    $('aiCamera')?.readyState >= 2
  ) {

    return $('aiCamera');
  }


  if (
    $('view-live')?.classList.contains(
      'active-view'
    ) &&

    $('liveCamera')?.readyState >= 2
  ) {

    return $('liveCamera');
  }


  return $('camera');
}


function getOverlayCanvas() {

  if (
    $('view-ai')?.classList.contains(
      'active-view'
    )
  ) {

    return $('aiCameraOverlay');
  }


  if (
    $('view-live')?.classList.contains(
      'active-view'
    )
  ) {

    return $('liveCameraOverlay');
  }


  return $('cameraOverlay');
}


/* =========================================================
   CLEAR AI OVERLAYS
========================================================= */

function clearDetectionOverlays() {

  lastPredictions = [];


  [
    'cameraOverlay',
    'liveCameraOverlay',
    'aiCameraOverlay'
  ].forEach(
    id => {

      const canvas =
        $(id);


      if (!canvas) return;


      const ctx =
        canvas.getContext('2d');


      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  );
}


/* =========================================================
   AI SEVERITY
========================================================= */

function severityForClass(
  label,
  confidence
) {

  const name =
    String(label || '')
      .toLowerCase();


  if (
    name.includes('tear') ||
    name.includes('hole')
  ) {

    return 'High';
  }


  if (
    name.includes('damage')
  ) {

    return 'Medium';
  }


  if (
    confidence >= 80
  ) {

    return 'High';
  }


  if (
    confidence >= 50
  ) {

    return 'Medium';
  }


  return 'Low';
}


/* =========================================================
   DRAW AI PREDICTIONS
   SUPPORTS INSTANCE SEGMENTATION POLYGONS
========================================================= */

function drawPredictions(
  predictions
) {

  const video =
    getActiveVideo();


  const canvas =
    getOverlayCanvas();


  if (
    !video ||
    !canvas
  ) {
    return;
  }


  const rect =
    video.getBoundingClientRect();


  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    Math.max(
      1,
      Math.round(
        rect.width * dpr
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        rect.height * dpr
      )
    );


  canvas.style.width =
    `${rect.width}px`;


  canvas.style.height =
    `${rect.height}px`;


  const ctx =
    canvas.getContext('2d');


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );


  if (!settings.box) {
    return;
  }


  const sourceWidth =
    video.videoWidth ||
    1280;


  const sourceHeight =
    video.videoHeight ||
    720;


  const scaleX =
    rect.width /
    sourceWidth;


  const scaleY =
    rect.height /
    sourceHeight;


  /*
   * Convert Roboflow polygon formats
   * into [{x,y}, ...]
   */

  function getPoints(
    prediction
  ) {

    const raw =
      prediction.points ||
      prediction.polygon ||
      prediction.mask;


    if (
      !Array.isArray(raw) ||
      raw.length < 3
    ) {

      return [];
    }


    return raw
      .map(point => {

        if (
          Array.isArray(point)
        ) {

          return {
            x:
              Number(point[0]) || 0,

            y:
              Number(point[1]) || 0
          };
        }


        return {
          x:
            Number(point?.x) || 0,

          y:
            Number(point?.y) || 0
        };
      })
      .filter(
        point =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
      );
  }


  predictions.forEach(
    prediction => {

      const confidenceRaw =
        Number(
          prediction.confidence || 0
        );


      /*
       * Accept both 0–1 and 0–100
       * confidence formats.
       */

      const confidence =
        confidenceRaw > 1
          ? confidenceRaw / 100
          : confidenceRaw;


      /*
       * Ignore very low-confidence
       * detections.
       */

      if (
        confidence < 0.25
      ) {

        return;
      }


      const label =
        prediction.class ||
        prediction.label ||
        'Unknown';


      const points =
        getPoints(
          prediction
        );


      const percent =
        Math.round(
          Math.max(
            0,
            Math.min(
              1,
              confidence
            )
          ) * 100
        );


      /*
       * =====================================================
       * INSTANCE SEGMENTATION
       * =====================================================
       *
       * If Roboflow returns polygon points,
       * draw the ACTUAL damage contour.
       */

      if (
        points.length >= 3
      ) {

        ctx.beginPath();


        points.forEach(
          (point, index) => {

            const x =
              point.x *
              scaleX;


            const y =
              point.y *
              scaleY;


            if (index === 0) {

              ctx.moveTo(
                x,
                y
              );

            } else {

              ctx.lineTo(
                x,
                y
              );
            }
          }
        );


        ctx.closePath();


        /*
         * Transparent fill so the
         * belt remains visible.
         */

        ctx.fillStyle =
          'rgba(255, 63, 72, 0.20)';

        ctx.fill();


        ctx.lineWidth = 3;

        ctx.strokeStyle =
          '#ff3f48';

        ctx.stroke();


        /*
         * Calculate label position
         * from polygon bounds.
         */

        const xs =
          points.map(
            p =>
              p.x *
              scaleX
          );


        const ys =
          points.map(
            p =>
              p.y *
              scaleY
          );


        const left =
          Math.min(...xs);


        const top =
          Math.min(...ys);


        const text =
          `${label} ${percent}%`;


        ctx.font =
          'bold 15px Segoe UI';


        const textWidth =
          ctx.measureText(
            text
          ).width + 14;


        const labelY =
          Math.max(
            0,
            top - 28
          );


        ctx.fillStyle =
          '#ff3f48';


        ctx.fillRect(
          left,
          labelY,
          textWidth,
          28
        );


        ctx.fillStyle =
          '#ffffff';


        ctx.fillText(
          text,
          left + 7,
          Math.max(
            19,
            top - 9
          )
        );


        return;
      }


      /*
       * =====================================================
       * FALLBACK BOUNDING BOX
       * =====================================================
       *
       * Used only when segmentation
       * points are not returned.
       */

      const x =
        Number(
          prediction.x || 0
        );


      const y =
        Number(
          prediction.y || 0
        );


      const width =
        Number(
          prediction.width || 0
        );


      const height =
        Number(
          prediction.height || 0
        );


      if (
        width <= 0 ||
        height <= 0
      ) {

        return;
      }


      const left =
        (
          x -
          width / 2
        ) *
        scaleX;


      const top =
        (
          y -
          height / 2
        ) *
        scaleY;


      const boxWidth =
        width *
        scaleX;


      const boxHeight =
        height *
        scaleY;


      ctx.lineWidth = 3;

      ctx.strokeStyle =
        '#ff3f48';


      ctx.strokeRect(
        left,
        top,
        boxWidth,
        boxHeight
      );


      const text =
        `${label} ${percent}%`;


      ctx.font =
        'bold 15px Segoe UI';


      const textWidth =
        ctx.measureText(
          text
        ).width + 14;


      const labelY =
        Math.max(
          0,
          top - 28
        );


      ctx.fillStyle =
        '#ff3f48';


      ctx.fillRect(
        left,
        labelY,
        textWidth,
        28
      );


      ctx.fillStyle =
        '#ffffff';


      ctx.fillText(
        text,
        left + 7,
        Math.max(
          19,
          top - 9
        )
      );
    }
  );
}


/* =========================================================
   RUN REAL DETECTION
========================================================= */

async function runRealDetection() {

  if (inferenceBusy) {
    return;
  }


  if (!cameraStream) {

    setDetection(
      'No detection',
      0,
      'Normal',
      'Start the webcam before running AI inspection.'
    );

    return;
  }


  const video =
    getActiveVideo();


  if (
    !video ||
    video.readyState < 2
  ) {

    setDetection(
      'No detection',
      0,
      'Normal',
      'Camera frame is not ready yet.'
    );

    return;
  }


  inferenceBusy = true;


  try {

    /*
     * Create a frame canvas.
     */

    const canvas =
      document.createElement(
        'canvas'
      );


    const width =
      video.videoWidth ||
      1280;


    const height =
      video.videoHeight ||
      720;


    canvas.width =
      width;


    canvas.height =
      height;


    const ctx =
      canvas.getContext('2d');


    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );


    /*
     * High-quality JPEG.
     *
     * Better preservation of small tears,
     * holes and cracks than aggressive compression.
     */

    const image =
      canvas.toDataURL(
        'image/jpeg',
        0.82
      );


    const response =
      await fetch(
        '/api/infer',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              image
            })
        }
      );


    if (!response.ok) {

      const text =
        await response.text();


      throw new Error(
        text ||
        `HTTP ${response.status}`
      );
    }


    const result =
      await response.json();


    const predictions =
      Array.isArray(
        result.predictions
      )
        ? result.predictions
        : [];


    lastPredictions =
      predictions;


    drawPredictions(
      predictions
    );


    /*
     * No damage.
     */

    if (
      predictions.length === 0
    ) {

      setDetection(
        'No detection',
        0,
        'Normal',
        'No belt damage detected in the latest inspection.'
      );

      return;
    }


    /*
     * Select highest-confidence
     * detection.
     */

    const best =
      predictions
        .slice()
        .sort(
          (a, b) => {

            const ca =
              Number(
                a.confidence || 0
              );

            const cb =
              Number(
                b.confidence || 0
              );

            return cb - ca;
          }
        )[0];


    const rawConfidence =
      Number(
        best.confidence || 0
      );


    const confidence =
      rawConfidence > 1
        ? rawConfidence
        : rawConfidence * 100;


    const label =
      best.class ||
      best.label ||
      'Unknown';


    const severity =
      severityForClass(
        label,
        confidence
      );


    setDetection(
      label,
      confidence,
      severity,
      `${predictions.length} damage detection(s) found by YOLO.`
    );


    logEvent(
      'AI Detection',
      `${label} detected at ${Math.round(confidence)}% confidence`
    );


  } catch (error) {

    console.error(
      'AI inference error:',
      error
    );


    setDetection(
      'AI Error',
      0,
      'High',
      'Roboflow inference failed: ' +
      error.message
    );


    logEvent(
      'AI Error',
      error.message
    );


  } finally {

    inferenceBusy =
      false;
  }
}


/* =========================================================
   LIVE AI LOOP
========================================================= */
let liveInferenceRunning = false;


async function fastInferenceLoop() {

  if (!cameraStream) {
    liveInferenceRunning = false;
    return;
  }

  if (inferenceBusy) {
    requestAnimationFrame(fastInferenceLoop);
    return;
  }

  await runRealDetection();

  if (cameraStream) {
    setTimeout(
      fastInferenceLoop,
      100
    );
  } else {
    liveInferenceRunning = false;
  }
}

function startLiveInference() {
  if (liveInferenceRunning) {
    return;
  }

  liveInferenceRunning = true;

  /*
   * Start immediately.
   * No fixed 1-second interval.
   */

  fastInferenceLoop();

}


function stopLiveInference() {

  liveInferenceRunning = false;

  clearInterval(
    inferenceTimer
  );

  inferenceTimer = null;
}


/* =========================================================
   CAMERA BUTTONS
========================================================= */

$('startCamera')?.addEventListener(
  'click',
  startCamera
);


$('stopCamera')?.addEventListener(
  'click',
  () =>
    stopCamera()
);


$('liveStart')?.addEventListener(
  'click',
  startCamera
);


$('liveStop')?.addEventListener(
  'click',
  () =>
    stopCamera()
);


$('aiStart')?.addEventListener(
  'click',
  startCamera
);


$('aiStop')?.addEventListener(
  'click',
  () =>
    stopCamera()
);


$('runDetection')?.addEventListener(
  'click',
  runRealDetection
);


/* =========================================================
   CAMERA DEVICE CHANGES
========================================================= */

if (
  navigator.mediaDevices
) {

  navigator.mediaDevices.addEventListener(
    'devicechange',
    () =>
      listCameras()
  );
}


/* =========================================================
   NAVIGATION
========================================================= */

const VALID_VIEWS =
  new Set([
    'dashboard',
    'live',
    'sensors',
    'ai',
    'alerts',
    'logs',
    'settings'
  ]);


function showView(name) {

  name =
    String(name || '')
      .toLowerCase();


  if (
    !VALID_VIEWS.has(name)
  ) {

    return;
  }


  document
    .querySelectorAll('.view')
    .forEach(
      view => {

        view.classList.remove(
          'active-view'
        );


        view.setAttribute(
          'aria-hidden',
          'true'
        );
      }
    );


  const target =
    $('view-' + name);


  if (target) {

    target.classList.add(
      'active-view'
    );


    target.setAttribute(
      'aria-hidden',
      'false'
    );
  }


  document
    .querySelectorAll(
      '.nav[data-view]'
    )
    .forEach(
      nav => {

        const active =
          nav.dataset.view ===
          name;


        nav.classList.toggle(
          'active',
          active
        );


        nav.setAttribute(
          'aria-current',
          active
            ? 'page'
            : 'false'
        );
      }
    );


  try {

    history.replaceState(
      null,
      '',
      '#' + name
    );

  } catch (e) {}


  /*
   * Make sure active page gets
   * the same camera stream.
   */

  if (
    name === 'live' &&
    cameraStream
  ) {

    syncCamera(
      'liveCamera'
    );
  }


  if (
    name === 'ai' &&
    cameraStream
  ) {

    syncCamera(
      'aiCamera'
    );
  }


  if (
    name === 'dashboard' &&
    cameraStream
  ) {

    syncCamera(
      'camera'
    );
  }


  if (
    name === 'sensors'
  ) {

    renderSensorTable();
  }


  if (
    name === 'alerts'
  ) {

    renderAlerts();
  }


  if (
    name === 'logs'
  ) {

    renderLogs();
  }


  if (
    name === 'settings'
  ) {

    loadSettingsUI();
  }


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   CAMERA SYNC
========================================================= */

function syncCamera(id) {

  const video =
    $(id);


  if (
    video &&
    cameraStream
  ) {

    video.srcObject =
      cameraStream;


    video.muted = true;


    video.setAttribute(
      'playsinline',
      ''
    );


    video.play().catch(
      () => {}
    );
  }
}


/* =========================================================
   NAVIGATION CLICK HANDLER
========================================================= */

document.addEventListener(
  'click',
  event => {

    const item =
      event.target.closest(
        '[data-view]'
      );


    if (!item) return;


    const view =
      item.dataset.view;


    if (
      !VALID_VIEWS.has(view)
    ) {

      return;
    }


    event.preventDefault();

    event.stopPropagation();


    showView(view);
  }
);


/* =========================================================
   BROWSER HISTORY
========================================================= */

window.addEventListener(
  'popstate',
  () => {

    showView(
      location.hash.replace(
        '#',
        ''
      ) || 'dashboard'
    );
  }
);


window.addEventListener(
  'hashchange',
  () => {

    showView(
      location.hash.replace(
        '#',
        ''
      ) || 'dashboard'
    );
  }
);


/* =========================================================
   SETTINGS
========================================================= */

function loadSettingsUI() {

  [
    'vibration',
    'current',
    'temperature',
    'rpmMin',
    'rpmMax',
    'alignment',
    'tensionMin',
    'tensionMax'
  ].forEach(
    key => {

      const id =
        'set' +
        key.charAt(0).toUpperCase() +
        key.slice(1);


      const element =
        $(id);


      if (element) {

        element.value =
          settings[key];
      }
    }
  );


  if (
    $('setSound')
  ) {

    $('setSound').checked =
      settings.sound;
  }


  if (
    $('setBox')
  ) {

    $('setBox').checked =
      settings.box;
  }


  /*
   * Demo AI is permanently disabled.
   */

  if (
    $('setDemoAI')
  ) {

    $('setDemoAI').checked =
      false;

    $('setDemoAI').disabled =
      true;
  }
}


$('saveSettings')?.addEventListener(
  'click',
  () => {

    settings = {

      vibration:
        Number(
          $('setVibration').value
        ),

      current:
        Number(
          $('setCurrent').value
        ),

      temperature:
        Number(
          $('setTemperature').value
        ),

      rpmMin:
        Number(
          $('setRpmMin').value
        ),

      rpmMax:
        Number(
          $('setRpmMax').value
        ),

      alignment:
        Number(
          $('setAlignment').value
        ),

      tensionMin:
        Number(
          $('setTensionMin').value
        ),

      tensionMax:
        Number(
          $('setTensionMax').value
        ),

      sound:
        $('setSound').checked,

      box:
        $('setBox').checked,

      /*
       * REAL AI:
       * Demo remains OFF.
       */

      demoAI:
        false
    };


    localStorage.setItem(
      'conveyorSettings',
      JSON.stringify(settings)
    );


    loadSettingsUI();


    logEvent(
      'Settings',
      'Monitoring settings saved'
    );


    alert(
      'Settings saved successfully.'
    );
  }
);


$('resetSettings')?.addEventListener(
  'click',
  () => {

    settings = {
      ...DEFAULTS
    };


    localStorage.setItem(
      'conveyorSettings',
      JSON.stringify(settings)
    );


    loadSettingsUI();


    logEvent(
      'Settings',
      'Defaults restored'
    );
  }
);


/* =========================================================
   CLEAR ALERTS
========================================================= */

$('clearAlerts')?.addEventListener(
  'click',
  () => {

    alerts = [];


    saveAlerts();

    renderAlerts();


    logEvent(
      'Alerts',
      'All alerts cleared'
    );
  }
);


/* =========================================================
   CLEAR LOGS
========================================================= */

$('clearLogs')?.addEventListener(
  'click',
  () => {

    logs = [];


    localStorage.removeItem(
      'conveyorLogs'
    );


    renderLogs();
  }
);


/* =========================================================
   EXPORT SENSOR DATA
========================================================= */

$('exportSensors')?.addEventListener(
  'click',
  () => {

    const header =
      'Time,Vibration,Current,Temperature,RPM,Alignment,Tension,Health,Risk\n';


    const body =
      sampleHistory
        .map(
          d =>
            `${d.time},${d.vibration},${d.current},${d.temperature},${d.rpm},${d.alignment},${d.tension},${d.health},${d.failureRisk}`
        )
        .join('\n');


    const blob =
      new Blob(
        [
          header + body
        ],
        {
          type:
            'text/csv'
        }
      );


    const anchor =
      document.createElement(
        'a'
      );


    anchor.href =
      URL.createObjectURL(
        blob
      );


    anchor.download =
      'conveyor-sensor-data.csv';


    anchor.click();


    URL.revokeObjectURL(
      anchor.href
    );


    logEvent(
      'Export',
      'Sensor CSV exported'
    );
  }
);


/* =========================================================
   SENSOR TREND CHART
========================================================= */

function drawChart() {

  const canvas =
    $('chart');


  if (!canvas) return;


  const rect =
    canvas.getBoundingClientRect();


  const ratio =
    devicePixelRatio || 1;


  canvas.width =
    Math.max(
      300,
      rect.width * ratio
    );


  canvas.height =
    Math.max(
      160,
      rect.height * ratio
    );


  const ctx =
    canvas.getContext('2d');


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  const width =
    rect.width;


  const height =
    rect.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  ctx.font =
    '12px Segoe UI';


  ctx.strokeStyle =
    '#20394b';


  ctx.fillStyle =
    '#9eb0c3';


  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const y =
      12 +
      i *
      (height - 35) /
      4;


    ctx.beginPath();


    ctx.moveTo(
      45,
      y
    );


    ctx.lineTo(
      width - 10,
      y
    );


    ctx.stroke();


    ctx.fillText(
      String(
        100 -
        i * 25
      ),
      8,
      y + 4
    );
  }


  const series = [

    [
      'vibration',
      '#f24b4f',
      0,
      10
    ],

    [
      'current',
      '#3ca7ff',
      0,
      20
    ],

    [
      'temperature',
      '#32c675',
      0,
      100
    ]
  ];


  series.forEach(
    ([key, color, min, max]) => {

      const values =
        trends[key];


      if (
        values.length < 2
      ) {

        return;
      }


      ctx.strokeStyle =
        color;


      ctx.lineWidth = 2;


      ctx.beginPath();


      values.forEach(
        (value, index) => {

          const x =
            45 +
            index *
            (width - 58) /
            Math.max(
              59,
              values.length - 1
            );


          const y =
            12 +
            (
              1 -
              (
                Math.min(
                  max,
                  Math.max(
                    min,
                    value
                  )
                ) -
                min
              ) /
              (max - min)
            ) *
            (height - 35);


          if (index) {

            ctx.lineTo(
              x,
              y
            );

          } else {

            ctx.moveTo(
              x,
              y
            );
          }
        }
      );


      ctx.stroke();
    }
  );
}


window.addEventListener(
  'resize',
  drawChart
);


/* =========================================================
   RESTORE DATA + INITIALIZE
========================================================= */

try {

  sampleHistory =
    JSON.parse(
      localStorage.getItem(
        'conveyorSamples'
      ) || '[]'
    );


  sampleHistory
    .slice()
    .reverse()
    .forEach(
      d => {

        trends.vibration.push(
          d.vibration
        );


        trends.current.push(
          d.current
        );


        trends.temperature.push(
          d.temperature
        );
      }
    );


  Object.keys(trends).forEach(
    key => {

      trends[key] =
        trends[key].slice(-60);
    }
  );


} catch (error) {

  sampleHistory = [];
}


/* =========================================================
   INITIAL UI
========================================================= */

renderAlerts();

renderLogs();

renderSensorTable();

loadSettingsUI();

listCameras();


/*
 * Connect to ESP32 ONCE at startup.
 *
 * IMPORTANT:
 * There is intentionally NO
 *
 * setInterval(() => loadPorts(true), 5000)
 *
 * here.
 *
 * Repeatedly reopening COM7 can cause:
 * "Opening COM7: Access denied"
 */

loadPorts(true);


connectWS();

drawChart();


showView(
  location.hash.replace(
    '#',
    ''
  ) || 'dashboard'
);