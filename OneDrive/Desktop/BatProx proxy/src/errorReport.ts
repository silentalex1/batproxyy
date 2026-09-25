const seen = new Set<string>();
let started = false;

const NOISE = /ResizeObserver|Script error|Load failed|NetworkError when attempting|cancelled|AbortError|bare-mux|MessagePort|SharedWorker|wisp|epoxy|luminsdk|Grammarly|cdn-cgi|sentry|Failed to fetch dynamically imported/i;

function post(kind: string, message: string, stack: string) {
  const msg = String(message || '').replace(/\s+/g, ' ').trim();
  if (!msg || NOISE.test(msg)) return;
  const key = kind + '|' + msg.slice(0, 140);
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 60) return;
  let user = '';
  try { user = localStorage.getItem('batprox-user') || ''; } catch {}
  const body = JSON.stringify({
    kind,
    message: msg.slice(0, 400),
    stack: String(stack || '').slice(0, 1200),
    route: location.pathname,
    user
  });
  try {
    fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function reportError(message: string, stack?: string) {
  post('manual', message, stack || '');
}

export function startErrorReporting() {
  if (started) return;
  started = true;
  window.addEventListener('error', (e) => {
    const err = (e as ErrorEvent).error;
    post('error', (e as ErrorEvent).message || String(err || ''), (err && err.stack) || '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    post('rejection', (r && r.message) || String(r || ''), (r && r.stack) || '');
  });
}
