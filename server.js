const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT, host: "0.0.0.0" });

const roles = ["Piano1", "Piano2", "Perc1", "Perc2"];
const state = Object.fromEntries(
  roles.map(r => [r, { sx: 0, sy: 0, energy: 0, scene: "A", mode: "impulse", source: "none", connected: false }])
);

function broadcast() {
  const msg = JSON.stringify({ type: "state", roles: state });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "state", roles: state }));

  ws.on("message", raw => {
    try {
      const data = JSON.parse(raw);
      if (data.type === "update" && state[data.role]) {
        state[data.role] = {
          ...state[data.role],
          sx: Number(data.sx || 0),
          sy: Number(data.sy || 0),
          energy: Number(data.energy || 0),
          scene: data.scene || "A",
          mode: data.mode || "impulse",
          source: data.source || "phone",
          connected: true
        };
        broadcast();
      }
      if (data.type === "reset") {
        roles.forEach(r => state[r] = { sx: 0, sy: 0, energy: 0, scene: "A", mode: "impulse", source: "none", connected: false });
        broadcast();
      }
    } catch {}
  });
});

console.log(`WebSocket server running on port ${PORT}`);