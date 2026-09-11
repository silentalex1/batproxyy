importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  try {
    const u = event.request.url;
    if (u.includes('sentry.io') || u.includes('cdn-cgi/rum') || u.includes('/csp_report') || u.includes('/trace/trace')) {
      event.respondWith(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }));
      return;
    }
    if (u.includes('/uv/service/')) {
      try {
        const enc = u.split('/uv/service/')[1].split('?')[0].split('#')[0];
        if (enc && self.__uv$config && self.__uv$config.decodeUrl) {
          const dec = self.__uv$config.decodeUrl(enc);
          if (dec.includes('sentry.io') || dec.includes('ingest') || dec.includes('cdn-cgi') || (dec.includes('rbxcdn') && dec.toLowerCase().includes('sentry'))) {
            const isJs = dec.includes('.js');
            event.respondWith(new Response(isJs ? 'self.Sentry={init:function(){},captureException:function(){},captureMessage:function(){},captureEvent:function(){},addBreadcrumb:function(){},withScope:function(c){try{c({})}catch(e){}}};window.Sentry=self.Sentry;window.__SENTRY__={hub:{}};' : '{}', { status: 200, headers: { 'Content-Type': isJs ? 'application/javascript' : 'application/json', 'Access-Control-Allow-Origin': '*' } }));
            return;
          }
        }
      } catch {}
    }
  } catch {}
  let routed = false;
  try {
    routed = uv.route(event);
  } catch {
    routed = false;
  }
  if (routed) {
    event.respondWith((async () => {
      try {
        const res = await uv.fetch(event);
        if (res.status === 403 || res.status === 500 || res.status === 502 || res.status === 503) {
          try {
            const enc = event.request.url.split('/uv/service/')[1]?.split('?')[0]?.split('#')[0];
            if (enc && self.__uv$config && self.__uv$config.decodeUrl) {
              const dec = self.__uv$config.decodeUrl(enc);
              const alt = await fetch('/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(dec)))));
              if (alt.ok) return alt;
            }
          } catch {}
        }
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('javascript') && res.url && res.url.includes('uv/service/')) {
            const t = await res.clone().text().catch(() => '');
            if (t.includes('Keep your account safe')) {
              return new Response('self.Sentry={init:function(){},captureException:function(){},captureMessage:function(){},captureEvent:function(){},addBreadcrumb:function(){},withScope:function(c){try{c({})}catch(e){}}};window.Sentry=self.Sentry;window.__SENTRY__={hub:{}};', { status: 200, headers: { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' } });
            }
          }
        } catch {}
        return res;
      } catch {
        try {
          const enc = event.request.url.split('/uv/service/')[1]?.split('?')[0]?.split('#')[0];
          if (enc && self.__uv$config && self.__uv$config.decodeUrl) {
            const dec = self.__uv$config.decodeUrl(enc);
            return await fetch('/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(dec)))));
          }
        } catch {}
        return new Response('', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    })());
  }
});
