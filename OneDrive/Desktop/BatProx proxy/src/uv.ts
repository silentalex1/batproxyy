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

export function initUltraviolet(): Promise<void> {
  if (!uvReady) {
    uvReady = (async () => {
      if (!window.__uv$config || !window.BareMux) {
        throw new Error('Ultraviolet scripts failed to load');
      }
      if (typeof SharedWorker === 'undefined') {
        throw new Error('SharedWorker unavailable');
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      const reg = await navigator.serviceWorker.register('/uv-sw.js', { scope: '/' });
      await reg.update();
      await waitForWorker(reg.active || reg.installing || reg.waiting);
      if (!reg.active) {
        await waitForWorker(reg.installing || reg.waiting);
      }
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 1500);
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }
      const wispUrls = [
        'wss://wisp.mercurywork.shop/wisp/',
        'wss://anura.terbium.work/wisp/',
        'wss://wisp.run.place/wisp/',
        'wss://wisp.terbiumon.top/wisp/',
        'wss://wisp.whimsy.run/wisp/'
      ];
      const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
      let connected = false;
      for (const wispUrl of wispUrls) {
        if (!(await probeWisp(wispUrl))) continue;
        try {
          await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
          lastWisp = wispUrl;
          connected = true;
          break;
        } catch {}
      }
      if (!connected) {
        for (const wispUrl of wispUrls) {
          try {
            await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
            lastWisp = wispUrl;
            connected = true;
            break;
          } catch {}
        }
      }
      if (!connected) throw new Error('Transport unavailable');
    })().catch((err) => {
      uvReady = null;
      throw err;
    });
  }
  return uvReady;
}
