import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = process.env.CF_ACCOUNT || "a74d06ef1a32cc4d76ab4566ba1b22ee";
const PROJECT = process.env.CF_PAGES_PROJECT || "stealthybat";
const WORKER = process.env.CF_WORKER || "api-stealthybat";
const API = "https://api.cloudflare.com/client/v4";

const domain = String(process.argv[2] || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
  console.error("usage: node tools/connect-domain.mjs <domain>");
  process.exit(1);
}

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    const raw = readFileSync(join(homedir(), ".wrangler", "config", "default.toml"), "utf8");
    const m = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  return "";
}

const TOK = token();
if (!TOK) {
  console.error("No Cloudflare credential found. Run: npx wrangler login");
  process.exit(1);
}

const cf = async (path, init = {}) => {
  const r = await fetch(API + path, {
    ...init,
    headers: { Authorization: "Bearer " + TOK, "Content-Type": "application/json", ...(init.headers || {}) }
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.success !== false, status: r.status, data: d, errors: (d.errors || []).map(e => e.message) };
};

const step = (n, msg) => console.log(`[${n}] ${msg}`);
const good = msg => console.log(`    ok    ${msg}`);
const warn = msg => console.log(`    note  ${msg}`);
const bad = msg => console.log(`    FAIL  ${msg}`);

console.log(`\nConnecting ${domain}\n`);

step(1, "Finding the zone in Cloudflare");
const zr = await cf(`/zones?name=${encodeURIComponent(domain)}`);
const zone = (zr.data.result || []).find(z => z.account && z.account.id === ACCOUNT) || (zr.data.result || [])[0];
if (!zone) {
  bad(`${domain} is not in this Cloudflare account yet.`);
  console.log(`\n  Add it first: dashboard > Add a Site > ${domain}, then point your`);
  console.log(`  registrar nameservers at the pair Cloudflare gives you. Re-run this after.\n`);
  process.exit(1);
}
good(`zone ${zone.id} status=${zone.status}`);
if (zone.status !== "active") warn(`zone is "${zone.status}". Nameservers may still be propagating: ${(zone.name_servers || []).join(", ")}`);

step(2, "Attaching the site to Pages");
for (const host of [domain, `www.${domain}`]) {
  const r = await cf(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: host })
  });
  if (r.ok) good(`${host} added (${r.data.result?.status || "pending"})`);
  else if (r.errors.join(" ").toLowerCase().includes("already")) good(`${host} already attached`);
  else bad(`${host}: ${r.errors.join(", ") || r.status}`);
}

step(3, "Attaching api." + domain + " to the worker");
const wr = await cf(`/accounts/${ACCOUNT}/workers/domains`, {
  method: "PUT",
  body: JSON.stringify({ environment: "production", hostname: `api.${domain}`, service: WORKER, zone_id: zone.id })
});
if (wr.ok) good(`api.${domain} -> ${WORKER}`);
else bad(`api.${domain}: ${wr.errors.join(", ") || wr.status}`);

step(4, "Adding the domain to the API allowlist");
const bridge = process.env.BRIDGE_TOKEN || "";
if (!bridge) {
  warn("BRIDGE_TOKEN not set, skipping. Run with BRIDGE_TOKEN=... to register it,");
  warn("or the new domain will be blocked by CORS.");
} else {
  const targets = [`https://api.${domain}`, "https://api.stealthybat.org", "https://api-stealthybat.batprox-proxy.workers.dev"];
  let done = false;
  for (const base of targets) {
    try {
      const r = await fetch(base + "/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-token": bridge },
        body: JSON.stringify({ add: domain })
      });
      const d = await r.json().catch(() => ({}));
      if (d.success) { good(`allowlist now: ${d.domains.join(", ")}`); done = true; break; }
    } catch {}
  }
  if (!done) bad("could not reach the API to register the domain");
}

step(5, "Checking it responds");
await new Promise(r => setTimeout(r, 4000));
for (const u of [`https://${domain}/`, `https://api.${domain}/api/admin/users`]) {
  try {
    const r = await fetch(u, { redirect: "follow" });
    console.log(`    ${r.status === 200 ? "ok   " : "wait "} ${u} -> ${r.status}`);
  } catch {
    console.log(`    wait  ${u} -> not resolving yet`);
  }
}

console.log(`\nDone. Accounts and data are untouched: they live in the worker's D1 store,`);
console.log(`which every domain shares. Users keep their logins and invite codes.`);
console.log(`They will need to sign in once on the new domain, since the session token`);
console.log(`is stored per origin by the browser.\n`);
