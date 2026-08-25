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

export function getUvUrl(targetUrl: string): string {
  return window.__uv$config.prefix + window.__uv$config.encodeUrl(targetUrl);
}

export function getSandboxUrl(targetUrl: string): string {
  return '/proxy?url=' + encodeURIComponent(targetUrl);
}

export function decodeProxiedLocation(href: string): string | null {
  try {
    const parsed = new URL(href, window.location.origin);
    if (parsed.pathname === '/proxy') {
      return parsed.searchParams.get('url');
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
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((reg) => !reg.scope.includes('/uv'))
          .map((reg) => reg.unregister())
      );
      await navigator.serviceWorker.register('/uv/sw.js', { scope: '/uv/' });
      await navigator.serviceWorker.ready;
      const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
      const wispUrl =
        (location.protocol === 'https:' ? 'wss' : 'ws') +
        '://' +
        location.host +
        '/wisp/';
      if ((await connection.getTransport()) !== '/epoxy/index.mjs') {
        await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
      }
    })().catch((err) => {
      uvReady = null;
      throw err;
    });
  }
  return uvReady;
}
