import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const API = process.env.BATPROX_API || "https://api.stealthybat.org";
const TOKEN = process.env.BRIDGE_TOKEN || "";
const MODEL = process.env.BATPROX_MODEL || "batprox-ai";
const OLLAMA = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const PORT = Number(process.env.AGENT_PORT || 11434);

if (!TOKEN) {
  console.error("BRIDGE_TOKEN is not set. Run: set BRIDGE_TOKEN=your-token");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function pin() {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "ok" }], stream: false, keep_alive: -1 })
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  await r.json();
}

async function resident() {
  try {
    const r = await fetch(`${OLLAMA}/api/ps`);
    const d = await r.json();
    return (d.models || []).some((m) => m.name.startsWith(MODEL));
  } catch {
    return false;
  }
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    const cf = spawn("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${PORT}`], { shell: true });
    let done = false;
    const scan = (buf) => {
      const text = String(buf);
      const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !done) {
        done = true;
        resolve({ url: m[0], proc: cf });
      }
    };
    cf.stdout.on("data", scan);
    cf.stderr.on("data", scan);
    cf.on("error", (e) => !done && (done = true, reject(e)));
    cf.on("exit", (c) => !done && (done = true, reject(new Error(`cloudflared exited ${c}`))));
    setTimeout(() => !done && (done = true, reject(new Error("tunnel timeout"))), 45000);
  });
}

async function register(origin) {
  const r = await fetch(`${API}/api/ai/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-token": TOKEN },
    body: JSON.stringify({ origin, model: MODEL, host: process.env.COMPUTERNAME || "pc" })
  });
  const d = await r.json().catch(() => ({}));
  if (!d.success) throw new Error(d.error || `register ${r.status}`);
  return d;
}

log(`model ${MODEL} -> ollama ${OLLAMA}`);
log("loading model into memory (first time can take ~60s)..");
const t0 = Date.now();
await pin();
log(`model resident after ${((Date.now() - t0) / 1000).toFixed(1)}s`);

log("opening tunnel..");
const { url, proc } = await startTunnel();
log(`tunnel  ${url}`);

await register(url);
log(`registered with ${API}`);
log("agent running - keep this window open");

const bye = () => { try { proc.kill(); } catch {} process.exit(0); };
process.on("SIGINT", bye);
process.on("SIGTERM", bye);

while (true) {
  await sleep(60000);
  try {
    if (!(await resident())) {
      log("model fell out of memory, reloading..");
      await pin();
    }
    await register(url);
  } catch (e) {
    log("heartbeat failed:", e.message);
  }
}
