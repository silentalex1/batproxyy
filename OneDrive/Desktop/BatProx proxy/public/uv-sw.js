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

let bpReminders = [];
let bpTimer = null;
function bpDayStamp(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
async function bpTick(){
  if(!bpReminders.length) return;
  const now=new Date(); const today=bpDayStamp(now);
  for(const r of bpReminders){
    if(r.lastFired===today) continue;
    const due = now.getHours() > r.hh || (now.getHours()===r.hh && now.getMinutes() >= r.mm);
    if(!due) continue;
    const mins = now.getHours()*60+now.getMinutes()-(r.hh*60+r.mm);
    if(mins>120) continue;
    r.lastFired=today;
    try{ await self.registration.showNotification('Reminder', { body:r.text, tag:'bp-reminder-'+r.id, icon:'/favicon.ico', badge:'/favicon.ico', data:{ url:'/dashboard' } }); }catch{}
  }
}
function bpSchedule(){
  if(bpTimer) clearInterval(bpTimer);
  bpTimer=setInterval(bpTick, 25000);
  bpTick();
}
self.addEventListener('message', (event)=>{
  const d=event.data||{};
  if(d.type==='bp-sync-reminders'){ bpReminders=Array.isArray(d.reminders)?d.reminders:[]; bpSchedule(); }
  if(d.type==='bp-reminder' && d.body){
    event.waitUntil(self.registration.showNotification(d.title||'Reminder', { body:d.body, tag:d.tag||'bp-reminder', icon:'/favicon.ico', badge:'/favicon.ico', data:{ url:'/dashboard' } }));
  }
});
self.addEventListener('notificationclick', (event)=>{
  event.notification.close();
  const url=(event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil((async()=>{
    const all=await clients.matchAll({ type:'window', includeUncontrolled:true });
    for(const c of all){ try{ if(c.url.includes(self.location.origin)){ await c.focus(); try{ c.postMessage({type:'bp-check-reminders'});}catch{} return; } }catch{} }
    await clients.openWindow(url);
  })());
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
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await uv.fetch(event);
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
        }
      }
      if (event.request.mode === 'navigate') {
        return new Response(bpRetryPage(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('', { status: 502, statusText: 'Proxy transport unavailable' });
    })());
  }
});

function bpRetryPage() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Reconnecting</title><style>html,body{margin:0;height:100%;background:#07070b;color:#e5e5f0;font-family:system-ui,sans-serif}body{display:flex;align-items:center;justify-content:center}.c{text-align:center}.s{width:34px;height:34px;border:3px solid #7c3aed;border-top-color:transparent;border-radius:50%;margin:0 auto 14px;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}p{margin:4px 0;font-size:14px}.m{color:#8b8ba0;font-size:12px}</style></head><body><div class="c"><div class="s"></div><p>Reconnecting to the proxy</p><p class="m">This page will reload on its own.</p></div><script>setTimeout(function(){location.reload()},2500)<\/script></body></html>';
}
