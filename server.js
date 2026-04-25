const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT, host: "0.0.0.0" });

const roles = ["Piano1", "Piano2", "Perc1", "Perc2"];

const defaultState = {
  sx: 0,
  sy: 0,
  energy: 0,
  tiltX: 0,
  tiltY: 0,
  scene: "A",
  mode: "impulse",
  source: "none",
  connected: false,
  lastSeen: 0
};

let state = Object.fromEntries(
  roles.map(role => [role, { ...defaultState }])
);

function now() {
  return Date.now();
}

function broadcast() {
  const msg = JSON.stringify({
    type: "state",
    roles: state,
    serverTime: now()
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function touchRole(role, source = "unknown") {
  if (!state[role]) return;

  state[role] = {
    ...state[role],
    source,
    connected: true,
    lastSeen: now()
  };
}

function updateRole(data) {
  const role = data.role;
  if (!state[role]) return;

  state[role] = {
    ...state[role],
    sx: Number(data.sx ?? state[role].sx ?? 0),
    sy: Number(data.sy ?? state[role].sy ?? 0),
    energy: Number(data.energy ?? state[role].energy ?? 0),
    tiltX: Number(data.tiltX ?? state[role].tiltX ?? 0),
    tiltY: Number(data.tiltY ?? state[role].tiltY ?? 0),
    scene: data.scene || state[role].scene || "A",
    mode: data.mode || state[role].mode || "impulse",
    source: data.source || state[role].source || "unknown",
    connected: true,
    lastSeen: now()
  };
}

wss.on("connection", ws => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.send(JSON.stringify({
    type: "state",
    roles: state,
    serverTime: now()
  }));

  ws.on("message", raw => {
    try {
      const data = JSON.parse(raw);

      if (data.type === "update") {
        updateRole(data);
        broadcast();
      }

      if (data.type === "hello") {
        touchRole(data.role, data.source || "unknown");
        broadcast();
      }

      if (data.type === "heartbeat") {
        touchRole(data.role, data.source || "unknown");
        broadcast();
      }

      if (data.type === "reset") {
        state = Object.fromEntries(
          roles.map(role => [role, { ...defaultState }])
        );
        broadcast();
      }
    } catch (e) {
      console.log("Invalid message:", e);
    }
  });
});

// WebSocket keepalive for connected browser/bridge sockets
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
}, 15000);

// Role timeout + gentle decay
setInterval(() => {
  const t = now();

  for (const role of roles) {
    const r = state[role];

    if (r.connected && t - r.lastSeen > 6000) {
      state[role] = {
        ...r,
        connected: false,
        sx: r.sx * 0.85,
        sy: r.sy * 0.85,
        energy: r.energy * 0.85
      };
    }
  }

  broadcast();
}, 1000);

console.log(`WebSocket server running on port ${PORT}`);
