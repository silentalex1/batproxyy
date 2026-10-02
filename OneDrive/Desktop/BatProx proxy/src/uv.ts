declare global {
  interface Window {
    BareMux: {
      BareMuxConnection: new (worker: string) => {
        getTransport: () => Promise<string>;
        setTransport: (path: string, args: unknown[]) => Promise<void>;
      };
    };
    __uv$config: {
      prefix: string;
      encodeUrl: (url: string) => string;
      decodeUrl: (url: string) => string;
    };
  }
}

let uvReady: Promise<void> | null = null;
let lastWisp = '';

function probeWisp(url: string, ms = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { if (ws && !ok) ws.close(); } catch {}
      try { if (ws && ok) ws.close(); } catch {}
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), ms);
    try {
      ws = new WebSocket(url);
      ws.onopen = () => finish(true);
      ws.onerror = () => finish(false);
      ws.onclose = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

export function activeWisp(): string {
  return lastWisp;
}

export function resetUltraviolet() {
  uvReady = null;
  lastWisp = '';
}

function waitForWorker(worker: ServiceWorker | null): Promise<void> {
  if (!worker || worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') done();
    });
  });
}

function normalizeTarget(targetUrl: string): string {
  const cleaned = targetUrl.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) return cleaned;
  try {
    const u = new URL(cleaned.includes('://') ? cleaned : 'https://' + cleaned);
    if (u.protocol === 'http:') u.protocol = 'https:';
    const host = u.hostname.toLowerCase();
    if (host === 'youtube.com' || host === 'www.youtube.com') {
      u.hostname = 'm.youtube.com';
      u.searchParams.delete('app');
    }
    return u.toString();
  } catch {
    return cleaned;
  }
}

export function getUvUrl(targetUrl: string): string {
  const ready = normalizeTarget(targetUrl);
  return window.__uv$config.prefix + window.__uv$config.encodeUrl(ready);
}

export function getSandboxUrl(targetUrl: string): string {
  const t = normalizeTarget(targetUrl);
  try { return '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(t)))); } catch { return '/proxy?url=' + encodeURIComponent(t); }
}

function tryDecodeTarget(v: string | null): string | null {
  if (!v) return v;
  try {
    const d = decodeURIComponent(v);
    if (/^https?:\/\//.test(d)) return d;
  } catch {}
  try {
    const b = atob(v);
    const d = decodeURIComponent(escape(b));
    if (/^https?:\/\//.test(d)) return d;
  } catch {}
  try {
    const b = atob(decodeURIComponent(v));
    const d = decodeURIComponent(escape(b));
    if (/^https?:\/\//.test(d)) return d;
  } catch {}
  return v;
}

export function decodeProxiedLocation(href: string): string | null {
  try {
    const parsed = new URL(href, window.location.origin);
    if (parsed.pathname === '/proxy') {
      return tryDecodeTarget(parsed.searchParams.get('url'));
    }
    const prefix = window.__uv$config?.prefix;
    if (prefix && parsed.pathname.startsWith(prefix) && window.__uv$config.decodeUrl) {
      return window.__uv$config.decodeUrl(parsed.pathname.slice(prefix.length) + parsed.search);
    }
  } catch {
    return null;
  }
  return null;
}

const WISP_KEY = 'bp-wisp-good';

function wispList(): string[] {
  const self = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/wisp/';
  const pub = [
    'wss://wisp.mercurywork.shop/wisp/',
    'wss://wisp.terbiumon.top/wisp/',
    'wss://gointerstellar.app/wisp/',
    'wss://phantom.lol/wisp/',
    'wss://nebulaproxy.io/wisp/'
  ];
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return isLocal ? [self, ...pub] : [...pub, self];
}

let connection: { setTransport: (path: string, args: unknown[]) => Promise<void> } | null = null;
let watchdog: number | null = null;

export function primeBareMux() {
  try {
    if (connection || !window.BareMux || typeof SharedWorker === 'undefined' || !('serviceWorker' in navigator)) return;
    connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
  } catch {}
}
let switching = false;
const failed = new Set<string>();

function firstOpen(urls: string[], ms: number): Promise<string> {
  return new Promise((resolve) => {
    if (!urls.length) { resolve(''); return; }
    let left = urls.length;
    let done = false;
    urls.forEach((u) => {
      probeWisp(u, ms).then((ok) => {
        left -= 1;
        if (ok && !done) { done = true; resolve(u); return; }
        if (!left && !done) resolve('');
      });
    });
  });
}

const BENCH_KEY = 'bp-wisp-bench';
const BENCH_TARGET = 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js';
const BENCH_EVERY = 6 * 3600 * 1000;
type BenchRow = { relay: string; ms: number };
let benchRunning = false;

function readBench(): { at: number; ranks: BenchRow[] } | null {
  try {
    const b = JSON.parse(localStorage.getItem(BENCH_KEY) || 'null');
    if (b && Array.isArray(b.ranks) && Number(b.at) > 0) return b;
  } catch {}
  return null;
}

function rankOf(relay: string, bench: { ranks: BenchRow[] } | null): number {
  const r = bench?.ranks.find((x) => x.relay === relay);
  if (!r) return 50000;
  return r.ms > 0 ? r.ms : 99999;
}

function rankedOpen(urls: string[], ms: number): Promise<string> {
  const bench = readBench();
  if (!bench) return firstOpen(urls, ms);
  const order = urls.slice().sort((a, b) => rankOf(a, bench) - rankOf(b, bench));
  return new Promise((resolve) => {
    if (!order.length) { resolve(''); return; }
    const seen = new Map<string, boolean>();
    let done = false;
    const check = () => {
      if (done) return;
      for (const u of order) {
        const ok = seen.get(u);
        if (ok === undefined) return;
        if (ok) { done = true; resolve(u); return; }
      }
      done = true;
      resolve('');
    };
    order.forEach((u) => { probeWisp(u, ms).then((ok) => { seen.set(u, ok); check(); }); });
  });
}

function scheduleBench() {
  const last = readBench();
  if (benchRunning || (last && Date.now() - last.at < BENCH_EVERY)) return;
  if (typeof Worker === 'undefined') return;
  benchRunning = true;
  window.setTimeout(() => {
    let w: Worker;
    try { w = new Worker('/bp-wisp-bench.js', { type: 'module' }); } catch { benchRunning = false; return; }
    const relays = wispList().filter((u) => !u.includes('://' + location.host + '/'));
    const stop = window.setTimeout(() => { try { w.terminate(); } catch {} benchRunning = false; }, 90000);
    w.onmessage = (e) => {
      if (!e.data || e.data.type !== 'done') return;
      window.clearTimeout(stop);
      try { w.terminate(); } catch {}
      benchRunning = false;
      const ranks = (Array.isArray(e.data.results) ? e.data.results : []) as BenchRow[];
      if (!ranks.length) return;
      try { localStorage.setItem(BENCH_KEY, JSON.stringify({ at: Date.now(), ranks })); } catch {}
      const best = ranks.filter((r) => r.ms > 0).sort((a, b) => a.ms - b.ms)[0];
      if (!best) return;
      try { localStorage.setItem(WISP_KEY, best.relay); } catch {}
      const cur = ranks.find((r) => r.relay === lastWisp);
      const curMs = cur ? cur.ms : -1;
      if (best.relay !== lastWisp && connection && !switching && (curMs <= 0 || best.ms * 2 < curMs)) {
        switching = true;
        connection.setTransport('/epoxy/index.mjs', [{ wisp: best.relay }]).then(() => { lastWisp = best.relay; }).catch(() => {}).finally(() => { switching = false; });
      }
    };
    w.onerror = () => { window.clearTimeout(stop); try { w.terminate(); } catch {} benchRunning = false; };
    w.postMessage({ relays, target: BENCH_TARGET });
  }, 6000);
}

async function pickTransport(skip = ''): Promise<boolean> {
  if (!connection) connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
  if (skip) failed.add(skip);
  const all = wispList();
  const self = all[all.length - 1];
  const pub = all.filter((u) => u !== self && !failed.has(u));
  let saved = '';
  try { saved = localStorage.getItem(WISP_KEY) || ''; } catch {}
  const selfProbe = failed.has(self) ? Promise.resolve(false) : probeWisp(self, 4000);
  const savedProbe = saved && pub.includes(saved) ? probeWisp(saved, 1800) : Promise.resolve(false);
  const others = rankedOpen(pub.filter((u) => u !== saved), 4000);
  let pick = (await savedProbe) ? saved : await others;
  if (!pick && (await selfProbe)) pick = self;
  if (!pick) {
    failed.clear();
    pick = await firstOpen(all, 4000);
  }
  if (!pick) return false;
  try {
    await connection.setTransport('/epoxy/index.mjs', [{ wisp: pick }]);
    lastWisp = pick;
    try { if (pick !== self) localStorage.setItem(WISP_KEY, pick); } catch {}
    return true;
  } catch {
    return false;
  }
}

export async function switchTransport(): Promise<boolean> {
  if (switching) return false;
  switching = true;
  try {
    try { if (localStorage.getItem(WISP_KEY) === lastWisp) localStorage.removeItem(WISP_KEY); } catch {}
    return await pickTransport(lastWisp);
  } finally {
    switching = false;
  }
}

function startWatchdog() {
  if (watchdog !== null) return;
  watchdog = window.setInterval(async () => {
    if (switching || !lastWisp || document.visibilityState !== 'visible') return;
    if (await probeWisp(lastWisp, 5000)) return;
    switching = true;
    try { await pickTransport(lastWisp); } finally { switching = false; }
  }, 20000);
}

async function ensureWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((r) => {
    const s = (r.active || r.waiting || r.installing)?.scriptURL || '';
    return !s.endsWith('/uv-sw.js');
  }).map((r) => r.unregister()));
  const reg = await navigator.serviceWorker.register('/uv-sw.js', { scope: '/' });
  reg.update().catch(() => {});
  await waitForWorker(reg.active || reg.installing || reg.waiting);
  if (!reg.active) await waitForWorker(reg.installing || reg.waiting);
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }
}

export function initUltraviolet(): Promise<void> {
  if (!uvReady) {
    uvReady = (async () => {
      if (!window.__uv$config || !window.BareMux) {
        throw new Error('Ultraviolet scripts failed to load');
      }
      if (typeof SharedWorker === 'undefined') {
        throw new Error('SharedWorker unavailable');
      }
      await ensureWorker();
      if (!(await pickTransport())) {
        const fallback = wispList()[0];
        if (!connection) connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
        await connection.setTransport('/epoxy/index.mjs', [{ wisp: fallback }]);
        lastWisp = fallback;
      }
      startWatchdog();
      scheduleBench();
    })().catch((err) => {
      uvReady = null;
      throw err;
    });
  }
  return uvReady;
}
