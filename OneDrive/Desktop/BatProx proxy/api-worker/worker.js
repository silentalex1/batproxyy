const VALID_CODES = new Set(['BATPROX-2026','WELCOME-BAT','NIGHT-PROX','FOX-CORE','batprox-admin$$']);
function b64url(s){ return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sign(payload, secret){
  const h=b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const p=b64url(JSON.stringify(payload));
  const data=h+'.'+p;
  return data+'.'+b64url(secret.slice(0,16)+data.slice(-8));
}
function cors(h){ h.set('Access-Control-Allow-Origin','https://stealthybat.org'); h.set('Access-Control-Allow-Credentials','true'); h.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); h.set('Access-Control-Allow-Headers','*'); return h; }
function b64urlBytes(buf){ const b=new Uint8Array(buf); let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function hmacKey(secret){ return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']); }
async function hmacSign(payload, secret){
  const h=b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const p=b64url(JSON.stringify(payload));
  const data=h+'.'+p;
  const sig=await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(data));
  return data+'.'+b64urlBytes(sig);
}
async function hmacVerify(token, secret){
  try{
    const parts=token.split('.');
    if(parts.length!==3) return null;
    const ok=await crypto.subtle.verify('HMAC', await hmacKey(secret), Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)), new TextEncoder().encode(parts[0]+'.'+parts[1]));
    if(!ok) return null;
    return JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
  }catch{ return null; }
}
const RL_MAP=new Map();
function rl(key, limit, winMs){
  const now=Date.now();
  let arr=RL_MAP.get(key)||[];
  arr=arr.filter(t=>now-t<winMs);
  if(arr.length>=limit) return false;
  arr.push(now);
  if(RL_MAP.size>2000) RL_MAP.clear();
  RL_MAP.set(key, arr);
  return true;
}
function blockedHost(host){
  const h=String(host||'').toLowerCase().replace(/\.$/,'');
  if(!h) return true;
  if(h==='localhost'||h==='::1'||h==='[::1]'||h==='0.0.0.0') return true;
  if(h.includes('stealthybat.org')||h.includes('stealthlybat.it.com')) return true;
  if(/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)) return true;
  const m=h.match(/^172\.(1[6-9]|2[0-9]|3[01])\./);
  if(m) return true;
  if(/^[0-9a-f:]+$/.test(h)&&(h.startsWith('fe80')||h.startsWith('fc')||h.startsWith('fd'))) return true;
  return false;
}
 export default {
  async fetch(request, env){
   const url=new URL(request.url);
   const rawKv=env.batprox_data;
   const kv=rawKv?{
     get: async (k)=>{
       try{
         if(env.batprox){
           try{ const r=await env.batprox.prepare('SELECT v FROM kvstore WHERE k=?').bind(k).first(); if(r&&r.v!==undefined&&r.v!==null) return r.v; }catch{}
         }
       }catch{}
       try{ return await rawKv.get(k); }catch{ return null; }
     },
     put: async (k,v)=>{
       const s=typeof v==='string'?v:JSON.stringify(v);
       if(env.batprox){
         try{ await env.batprox.prepare('INSERT INTO kvstore (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k,s).run(); return; }catch{}
       }
       await rawKv.put(k,s);
     }
   }:rawKv;
   const getIP=()=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'unknown';
   if(request.method==='OPTIONS'){
    return new Response(null,{status:204, headers:cors(new Headers())});
  }
  if(url.pathname==='/' ){
    return new Response(JSON.stringify({message:'StealthyBat backend — not hello world', docs:'https://stealthybat.org/api-status/docs', health:'/health'}),{headers:{'Content-Type':'application/json',...Object.fromEntries(cors(new Headers()))}});
  }
  if(url.pathname==='/health'){
    return new Response(JSON.stringify({status:'StealthyBat API online — backend is handling accounts & proxy', domain:'api.stealthybat.org', timestamp:new Date().toISOString()}),{headers:{'Content-Type':'application/json',...Object.fromEntries(cors(new Headers()))}});
  }
  if(url.pathname==='/api/auth/login' && request.method==='POST'){
    const jh=()=>{ const hb=cors(new Headers()); hb.set('Content-Type','application/json'); return hb; };
    try{
      const body=await request.json();
      const username=body.username, inviteCode=body.inviteCode;
      if(!username||!inviteCode) return new Response(JSON.stringify({success:false, error:'Username and invite code are required'}),{status:200, headers:jh()});
      const cu=String(username).trim(), cc=String(inviteCode).trim();
      if(cu.length<3||cu.length>20) return new Response(JSON.stringify({success:false, error:'Username must be between 3 and 20 characters'}),{status:200, headers:jh()});
      try{
        const rawU=kv?await kv.get('users'):null;
        const users=rawU?JSON.parse(rawU||'[]'):[];
        const found=users.find(x=>x.username===cu);
        if(found){
          if(found.invite_code!==cc) return new Response(JSON.stringify({success:false, error:'Invite code does not match this account'}),{status:200, headers:jh()});
        } else {
          if(!VALID_CODES.has(cc)) return new Response(JSON.stringify({success:false, error:'Invalid invite code'}),{status:200, headers:jh()});
        }
      }catch{}
      const isAdmin= cc==='FOX-CORE'||cc==='batprox-admin$$'||cu==='realalex'||cu==='admin';
      try{
        const raw=kv?await kv.get('users'):null;
        let arr=raw?JSON.parse(raw||'[]'):[];
        let u=arr.find(x=>x.username===cu);
        if(u){ u.lastIp=getIP(); u.lastLogin=new Date().toISOString(); if(kv) await kv.put('users', JSON.stringify(arr));}
      }catch{}
      const blRaw=kv?await kv.get('blacklist_users'):null;
      const blUsers=blRaw?JSON.parse(blRaw):[];
      const blIpsRaw=kv?await kv.get('blacklist_ips'):null;
      const blIps=blIpsRaw?JSON.parse(blIpsRaw):[];
      const ip=getIP();
      const now2=Date.now();
      const blFiltered=blIps.filter(x=> typeof x==='string' ? true : (!x.expiresAt || new Date(x.expiresAt).getTime()>now2));
      const ipBanned=blFiltered.some(x=> typeof x==='string' ? false : (x.ip===ip && x.username===cu));
      if(blUsers.includes(cu) || ipBanned){
        const h=cors(new Headers()); h.set('Content-Type','application/json');
        return new Response(JSON.stringify({success:false, error:'You are banned from using this site.', banned:true}),{status:200, headers:h});
      }
      const secret=env.JWT_SECRET||'stealthybat-fallback-secret';
      let isAdminUser=isAdmin;
      try{ const rawA=kv?await kv.get('users'):null; const arrA=rawA?JSON.parse(rawA||'[]'):[]; const fa=arrA.find(x=>x.username===cu); if(fa&&fa.admin===true) isAdminUser=true; }catch{}
      const token=await hmacSign({id:1,username:cu,isAdmin:isAdminUser,exp:Math.floor(Date.now()/1000)+86400},secret);
      const h=cors(new Headers()); h.set('Content-Type','application/json');
      return new Response(JSON.stringify({success:true, token, user:{id:1, username:cu}}),{headers:h});
    }catch(e){ return new Response(JSON.stringify({success:false, error:'Login failed: '+(e.message||'unknown')}),{status:200, headers:jh()});}
  }
  if(url.pathname==='/api/auth/me'){
    const auth=request.headers.get('Authorization')||'';
    const token=auth.split(' ')[1]||'';
    if(!token) return new Response(JSON.stringify({error:'Access token required'}),{status:401});
    try{
      const secret=env.JWT_SECRET||'stealthybat-fallback-secret';
      let payload=await hmacVerify(token, secret);
      if(!payload){
        try{
          const legacy=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
          const expect=sign({id:legacy.id||1, username:legacy.username, isAdmin:!!legacy.isAdmin}, secret);
          if(expect===token) payload=legacy;
        }catch{}
      }
      if(!payload) return new Response(JSON.stringify({error:'Invalid token'}),{status:403});
      if(payload.exp && payload.exp < Math.floor(Date.now()/1000)) return new Response(JSON.stringify({error:'Token expired'}),{status:403});
      let rank='user';
      try{ const rawU=kv?await kv.get('users'):null; const arr=rawU?JSON.parse(rawU||'[]'):[]; const f=arr.find(x=>x.username===payload.username); if(f&&f.rank) rank=f.rank; }catch{}
      const h=cors(new Headers()); h.set('Content-Type','application/json');
      return new Response(JSON.stringify({user:{id:payload.id||1, username:payload.username||'user'}, isAdmin:!!payload.isAdmin, rank, isMod:rank==='moderator'||!!payload.isAdmin}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid token'}),{status:403});}
  }
  if(url.pathname.includes('/csp_report') || url.pathname.includes('/storage_report') || url.pathname.includes('/logClientError') || url.pathname.includes('/trace/trace')){
    return new Response(null,{status:204, headers:cors(new Headers())});
  }
  if(url.pathname==='/proxy' || url.pathname.startsWith('/proxy/')){
    const targetUrl=url.searchParams.get('url');
    if(!targetUrl) return new Response('URL parameter is required',{status:400});
    try{
      const parsed=new URL(targetUrl);
      if(!['http:','https:'].includes(parsed.protocol)) return new Response('Only HTTP and HTTPS allowed',{status:400});
      if(targetUrl.includes('sentry.io')||targetUrl.includes('ingest')||targetUrl.includes('cdn-cgi/rum')||targetUrl.includes('/_/_/csp_report')||targetUrl.includes('/_/_/trace')||targetUrl.includes('&quot;')) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
      let fUrl=targetUrl;
      try{ fUrl=decodeURIComponent(targetUrl).replace(/&quot;/g,'').replace(/&amp;/g,'&').trim(); if(fUrl!==targetUrl) try{ new URL(fUrl); }catch{ fUrl=targetUrl; } }catch{}
      if(fUrl.includes('stealthybat.org')||fUrl.includes('stealthlybat.it.com')||fUrl.includes('banned.stealthybat.org')) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
      if(!rl('proxy:'+getIP(), 600, 60000)) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
      try{ if(blockedHost(new URL(fUrl).hostname)) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}}); }catch{ return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}}); }
      const fwdCt=request.headers.get('content-type');
      const fwdBody=(request.method==='GET'||request.method==='HEAD')?undefined:await request.arrayBuffer().catch(()=>undefined);
      const fwdH={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept':request.headers.get('accept')||'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-US,en;q=0.9','Referer':parsed.origin+'/'};
      if(fwdCt) fwdH['Content-Type']=fwdCt;
      const pctl=new AbortController();
      const ptimer=setTimeout(()=>pctl.abort(), 10000);
      let r;
      try{ r=await fetch(fUrl,{method:request.method, headers:fwdH, body:fwdBody, redirect:'follow', signal:pctl.signal}); }
      finally{ clearTimeout(ptimer); }
      const ct=r.headers.get('content-type')||'text/html';
      let body=await r.arrayBuffer();
      if(body.byteLength>10*1024*1024) return new Response('',{status:200, headers:{'Content-Type':ct,'Access-Control-Allow-Origin':'*','X-Proxy-Response':'true'}});
      const base = r.url ? new URL(r.url).href : parsed.href;
      const isText=/html|css|javascript|json|xml|svg|text\//i.test(ct);
      let text=isText?new TextDecoder().decode(body):null;
      if(text!==null && ct.includes('html')){
        const proxyAsset=(raw, b)=>{ if(!raw) return raw; const t=String(raw).trim(); if(!t||t.indexOf('&quot;')>-1||t.indexOf('&amp;')>-1||t.startsWith('data:')||t.startsWith('javascript:')||t.startsWith('mailto:')||t.startsWith('#')||t.startsWith('blob:')||t.startsWith('/proxy')||t.length>2000) return t; try{ const abs=new URL(t,b).href; return '/proxy?url='+encodeURIComponent(abs);}catch{return t;}};
        const rewriteCss=(css,b)=>css.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>{ if(u.indexOf('&quot;')>-1||u.indexOf('data:')===0) return m; return 'url('+q+proxyAsset(u,b)+q+')';});
        text=text.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,'');
        text=text.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,'');
        text=text.replace(/\s+integrity="[^"]*"/gi,'');
        text=text.replace(/\s+integrity='[^']*'/gi,'');
        text=text.replace(/(src|href|action|poster|data-src|data-href)=(["'])([^"']+)\2/gi,(m,a,q,u)=>a+'='+q+proxyAsset(u,base)+q);
        text=rewriteCss(text,base);
        text=text.replace(/srcset=(["'])([^"']+)\1/gi,(m,q,v)=>{ const parts=v.split(',').map(p=>{const b=p.trim().split(/\s+/); b[0]=proxyAsset(b[0],base); return b.join(' ');}); return 'srcset='+q+parts.join(', ')+q;});
        const inject=`<script>(function(){window.__bpBase=${JSON.stringify(base)};var PASSES=['proxy','api/auth','api/admin','api/suggestions','api/my-games','api/ai','api/status','api/changelogs','api/sites','api/check-blacklist','api/user/settings','wisp','uv','epoxy','baremux','site'];function p(u){try{if(!u||typeof u!=='string')return u;if(u.indexOf('stealthybat.org')>-1||u.indexOf('stealthlybat.it.com')>-1)return u;if(u.charAt(0)==='#'||u.indexOf('data:')===0||u.indexOf('blob:')===0||u.indexOf('javascript:')===0||u.indexOf('mailto:')===0)return u;if(u.indexOf('about:')===0)return u;if(u.indexOf('/proxy?url=')===0)return u;var a=new URL(u,window.__bpBase||document.baseURI);if(a.hostname.indexOf('stealthybat.org')>-1||a.hostname.indexOf('stealthlybat.it.com')>-1)return u;for(var i=0;i<PASSES.length;i++){if(a.pathname==='/' + PASSES[i]||a.pathname.indexOf('/' + PASSES[i]+'/')===0)return a.pathname+a.search+a.hash;}var b=new URL(window.__bpBase||document.baseURI);if(a.origin===window.location.origin)return '/proxy?url='+encodeURIComponent(b.protocol+'//'+b.host+a.pathname+a.search+a.hash);return '/proxy?url='+encodeURIComponent(a.href);}catch(e){return u;}}function stayIn(e){try{var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var t=a.target||'';if(t==='_blank'||t==='_new'){e.preventDefault();e.stopPropagation();a.target='_self';a.href=p(a.href);return;}}catch(x){}}document.addEventListener('click',stayIn,true);document.addEventListener('auxclick',stayIn,true);setInterval(function(){try{var as=document.querySelectorAll('a[target="_blank"],a[target="_new"]');for(var i=0;i<as.length;i++){as[i].target='_self';as[i].href=p(as[i].href);}}catch(e){}},1200);var ow=window.open;window.open=function(u,f,feats){try{if(typeof u==='string'){return null;}}catch(e){}return ow(u,f,feats);};var of=window.fetch;window.fetch=function(i,n){try{var u=typeof i==='string'?i:(i&&i.url?i.url:null);if(!u)return of(i,n);if(u==='about:blank'||u==='about:srcdoc'||u.indexOf('about:blank')===0||u.indexOf('about:srcdoc')===0)return Promise.resolve(new Response('',{status:200,headers:{'Content-Type':'text/html'}}));if(u.indexOf('sentry.io')>-1||u.indexOf('cdn-cgi')>-1||u.indexOf('/_/_/')>-1||u.indexOf('ingest.sentry.io')>-1||u.indexOf('passkey')>-1||u.indexOf('StartAuthentication')>-1||u.indexOf('accounts.google.com/gsi')>-1||u.indexOf('fedcm')>-1||u.indexOf('FedCM')>-1)return Promise.resolve(new Response('',{status:200,headers:{'Content-Type':'text/plain'}}));if(typeof i==='string')return of(p(i),n);if(i&&typeof Request!=='undefined'&&i instanceof Request)return of(new Request(p(i.url),i),n);if(i&&i.url)return of(new Request(p(i.url),i),n);}catch(e){}return of(i,n);};var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);if(typeof a[1]==='string'){if(a[1].indexOf('sentry.io')>-1||a[1].indexOf('cdn-cgi')>-1||a[1].indexOf('/_/_/')>-1||a[1].indexOf('ingest.')>-1||a[1].indexOf('passkey')>-1||a[1].indexOf('StartAuthentication')>-1||a[1].indexOf('accounts.google.com/gsi')>-1||a[1].indexOf('fedcm')>-1){a[1]='data:text/plain,';}else a[1]=p(a[1]);}return oo.apply(this,a);};(function(){function hk(pr,pp){try{var dd=Object.getOwnPropertyDescriptor(pr,pp);if(!dd||!dd.get||!dd.set)return;Object.defineProperty(pr,pp,{get:dd.get,set:function(v){try{if(typeof v==='string'&&v.indexOf('data:')!==0&&v.indexOf('blob:')!==0&&v.indexOf('javascript:')!==0&&v.indexOf('about:')!==0&&v.charAt(0)!=='#'&&v.indexOf('/proxy?url=')!==0)v=p(v);}catch(e){}return dd.set.call(this,v);},configurable:true});}catch(e){}}try{hk(HTMLScriptElement.prototype,'src');hk(HTMLLinkElement.prototype,'href');hk(HTMLImageElement.prototype,'src');hk(HTMLMediaElement.prototype,'src');hk(HTMLSourceElement.prototype,'src');hk(HTMLIFrameElement.prototype,'src');hk(HTMLElement.prototype,'src');}catch(e){}})();var osa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{if(typeof v==='string'&&(n==='src'||n==='href'||n==='action')&&v.indexOf('data:')!==0&&v.indexOf('blob:')!==0&&v.indexOf('javascript:')!==0&&v.indexOf('about:')!==0&&v.charAt(0)!=='#')v=p(v);}catch(e){}return osa.call(this,n,v);};var ael=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,fn,opts){try{if(t==='unload'||t==='beforeunload'||t==='pagehide')return;}catch(e){}return ael.call(this,t,fn,opts);};document.addEventListener('keydown',function(e){try{var tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT'||tg.isContentEditable))return;var s=JSON.parse(localStorage.getItem('batprox-settings')||'{}');if(!s.panicKey)return;if(['Control','Shift','Alt','Meta'].indexOf(e.key)>-1)return;var c=(e.ctrlKey?'Ctrl+':'')+(e.altKey?'Alt+':'')+(e.shiftKey?'Shift+':'')+e.key;if(c.toLowerCase()!==String(s.panicKey).toLowerCase()&&e.key.toLowerCase()!==String(s.panicKey).toLowerCase())return;e.preventDefault();e.stopPropagation();var d=s.panicUrl||'https://www.google.com/';try{window.parent.postMessage({type:'bp-parent',redirect:d},'*');}catch(x){}try{if(window.top&&window.top!==window)window.top.location.href=d;}catch(x){}}catch(x){}},true);window.addEventListener('unhandledrejection',function(e){e.preventDefault();},{capture:true});window.addEventListener('error',function(e){if(e&&e.message&&(e.message.indexOf('Failed to fetch')>-1||e.message.indexOf('ERR_NAME_NOT_RESOLVED')>-1||e.message.indexOf('ERR_FAILED')>-1||e.message.indexOf('net::')>-1||e.message.indexOf('WebSocket')>-1||e.message.indexOf('CORS')>-1||e.message.indexOf('AngularJS')>-1||e.message.indexOf('ApolloClient')>-1||e.message.indexOf('PurchaseDialog')>-1||e.message.indexOf('Sentry')>-1||e.message.indexOf('RealTime')>-1||e.message.indexOf('SignalR')>-1||e.message.indexOf('cdn-cgi')>-1||e.message.indexOf('sentry')>-1||e.message.indexOf('OW is not defined')))e.preventDefault();},{capture:true});(function(){var _w=console.warn,_e=console.error;console.warn=function(){var m=String(arguments[0]||'');if(/AngularJS|ApolloClient|PurchaseDialog|RealTime|SignalR|Sentry|cdn-cgi|bare-mux|preload|OTS|Failed to decode|AnalyticsTrackingStore|GSI_LOGGER|FedCM|fedcm|One Tap|passkey|StartAuthentication|pointer-lock|allowfullscreen|Unrecognized feature/i.test(m))return;return _w.apply(console,arguments);};console.error=function(){var m=String(arguments[0]||'');if(/AngularJS|ApolloClient|PurchaseDialog|RealTime|SignalR|Sentry|cdn-cgi|bare-mux|MessagePort|SharedWorker|preload|OTS|Failed to decode|Failed to fetch initial|AnalyticsTrackingStore|GSI_LOGGER|FedCM|fedcm|passkey|StartAuthentication|pointer-lock|allowfullscreen|Unrecognized feature|Failed to load|ERR_NAME_NOT_RESOLVED|ERR_FAILED|net::/i.test(m))return;return _e.apply(console,arguments);};})();(function(){var OWS=window.WebSocket;if(!OWS)return;window.WebSocket=function(u,pt){try{if(typeof u==='string'&&(u.indexOf('realtime.roblox.com')>-1||u.indexOf('sentry.io')>-1||u.indexOf('signalr')>-1)){var m=new EventTarget();setTimeout(function(){m.dispatchEvent(new CloseEvent('close'));if(m.onclose)m.onclose({});},50);m.send=function(){};m.close=function(){};m.readyState=3;return m;}}catch(x){}return new OWS(u,pt);};window.WebSocket.prototype=OWS.prototype;})();})();<\/script>`;
        const headOpen=text.match(/<head[^>]*>/i);
        if(headOpen) text=text.replace(headOpen[0], headOpen[0]+inject);
        else if(text.includes('</head>')) text=text.replace('</head>', inject+'</head>');
        else text=inject+text;
        body=new TextEncoder().encode(text);
      } else if(text!==null && ct.includes('css')){
        const proxyAsset=(raw,b)=>{ if(!raw) return raw; const t=String(raw).trim(); if(!t||t.startsWith('data:')) return t; try{return '/proxy?url='+encodeURIComponent(new URL(t,b).href);}catch{return t;}};
        text=text.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>'url('+q+proxyAsset(u,parsed.href)+q+')');
        body=new TextEncoder().encode(text);
      }
      if(text!==null && text.indexOf('Bad Worker Origin')>-1) { const hb=new Headers(); hb.set('Content-Type','application/javascript'); hb.set('Access-Control-Allow-Origin','*'); hb.set('X-Proxy-Response','true'); return new Response('/* blocked */',{status:200, headers:hb}); }
      if(r.status===400 && text!==null && /javascript/i.test(ct)) { const hb=new Headers(); hb.set('Content-Type','application/javascript'); hb.set('Access-Control-Allow-Origin','*'); hb.set('X-Proxy-Response','true'); return new Response('/* blocked */',{status:200, headers:hb}); }
      if(r.status===400 && text===null && fUrl.endsWith('.js')) { const hb=new Headers(); hb.set('Content-Type','application/javascript'); hb.set('Access-Control-Allow-Origin','*'); hb.set('X-Proxy-Response','true'); return new Response('/* blocked */',{status:200, headers:hb}); }
      const h=new Headers(r.headers); for(const k of [...h.keys()]){ const lk=k.toLowerCase(); if(lk==='content-security-policy'||lk==='content-security-policy-report-only'||lk==='x-frame-options'||lk==='x-content-type-options') h.delete(k); } h.delete('content-security-policy'); h.delete('x-frame-options'); h.set('Access-Control-Allow-Origin','*'); h.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); h.set('Access-Control-Allow-Headers','*'); h.set('X-Frame-Options','ALLOWALL'); h.set('X-Proxy-Response','true');
      if(text===null){ const ext=fUrl.split('?')[0].split('.').pop().toLowerCase(); const map={js:'application/javascript',mjs:'application/javascript',css:'text/css',woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf',svg:'image/svg+xml',json:'application/json',wasm:'application/wasm'}; if(map[ext] && !ct.includes(map[ext])) h.set('Content-Type', map[ext]); else h.set('Content-Type', ct); }
      else h.set('Content-Type', ct);
      const s=r.status<500?r.status:200;
      if(text===null && (s===404||s===204) && body.byteLength<500) return new Response(body,{status:200, headers:h});
      return new Response(body,{status:s, headers:h});
    }catch(e){ return new Response('',{status:200, headers:cors(new Headers())});}
  }
  if(url.pathname==='/api/check-blacklist' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const ip=getIP();
    const username=url.searchParams.get('user')||'';
    const blRaw=kv?await kv.get('blacklist_ips'):null;
    const bl=blRaw?JSON.parse(blRaw):[];
    const blUsersRaw=kv?await kv.get('blacklist_users'):null;
    const blUsersList=blUsersRaw?JSON.parse(blUsersRaw):[];
    if(username && blUsersList.includes(username)) return new Response(JSON.stringify({banned:true, ip}),{headers:h});
    const now=Date.now();
    const filtered=bl.filter(x=> typeof x==='string' ? false : (!x.expiresAt || new Date(x.expiresAt).getTime()>now));
    const isBanned=filtered.some(x=> x.ip===ip && (!x.username || x.username===username));
    return new Response(JSON.stringify({banned:isBanned, ip}),{headers:h});
  }
  if(url.pathname==='/api/my-games' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    return new Response(JSON.stringify({games:[]}),{headers:h});
  }
  if(url.pathname==='/api/suggestions' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {content,userIdentifier,genre,title}=await request.json();
      const raw=kv?await kv.get('feedbacks'):null;
      let arr=raw?JSON.parse(raw):[];
      arr.push({id:arr.length+1, title:String(title||'').slice(0,80), content:String(content).slice(0,1000), user_identifier:userIdentifier||'anonymous', genre:genre||'Feedback suggestions', submitted_at:new Date().toISOString(), status:'pending'});
      if(kv) await kv.put('feedbacks', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, id:arr.length}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/ai/chat' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const apiKey=env.OPENROUTER_API_KEY;
    if(apiKey){
      try{
        const formData=await request.formData().catch(()=>null);
        let message='';
        if(formData) message=String(formData.get('message')||'');
        else { const j=await request.json().catch(()=>({})); message=String(j.message||''); }
        const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey,'HTTP-Referer':'https://stealthybat.org','X-Title':'Bat Prox'}, body:JSON.stringify({model:'stealth/ox-alpha', messages:[{role:'user', content:message||'hi'}]})});
        const d=await r.text();
        return new Response(d,{status:r.status, headers:h});
      }catch(e){ return new Response(JSON.stringify({response:'AI temporarily unavailable'}),{headers:h});}
    }
    return new Response(JSON.stringify({response:'AI service active — configure OPENROUTER_API_KEY for full responses'}),{headers:h});
  }
  if(url.pathname==='/api/admin/create-user' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,inviteCode}=await request.json();
      const cu=String(username||'').trim(), cc=String(inviteCode||'').trim();
      if(!cu||!cc) return new Response(JSON.stringify({error:'Username and invite code required'}),{status:400, headers:h});
      if(cu.length<3||cu.length>20) return new Response(JSON.stringify({error:'Username must be 3-20 characters'}),{status:400, headers:h});
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      if(arr.find(x=>x.username===cu)) return new Response(JSON.stringify({error:'Username already exists'}),{status:409, headers:h});
      arr.push({id:arr.length+1, username:cu, invite_code:cc, created_at:new Date().toISOString()});
      if(kv) await kv.put('users', JSON.stringify(arr));
      VALID_CODES.add(cc);
      return new Response(JSON.stringify({success:true, id:arr.length}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/remove-due' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username,removeAt,inviteCode}=await request.json();
      const cu=String(username||'').trim();
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      const u=arr.find(x=>x.username===cu);
      if(!u) return new Response(JSON.stringify({error:'Account not found'}),{status:404, headers:h});
      if(String(inviteCode||'').trim()!==u.invite_code) return new Response(JSON.stringify({error:'Invalid quick-access code'}),{status:403, headers:h});
      u.removeAt=String(removeAt||'').trim();
      if(kv) await kv.put('users', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/temp-remove' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username,days}=await request.json();
      const cu=String(username||'').trim();
      const d=parseInt(days,10);
      if(!d||d<1) return new Response(JSON.stringify({error:'Invalid days'}),{status:400, headers:h});
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      const u=arr.find(x=>x.username===cu);
      if(!u) return new Response(JSON.stringify({error:'Account not found'}),{status:404, headers:h});
      const ip=u.lastIp||getIP();
      const rawB=kv?await kv.get('blacklist_ips'):null;
      let bl=rawB?JSON.parse(rawB):[];
      const expiresAt=new Date(Date.now()+d*24*60*60*1000).toISOString();
      bl=bl.filter(x=> (typeof x==='string'?x:x.ip)!==ip);
      bl.push({ip, expiresAt, username:cu});
      if(kv) await kv.put('blacklist_ips', JSON.stringify(bl));
      return new Response(JSON.stringify({success:true, expiresAt}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/remove-user' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username}=await request.json();
      const cu=String(username||'').trim();
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      arr=arr.filter(x=>x.username!==cu);
      if(kv) await kv.put('users', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/pay-later' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username,payLater}=await request.json();
      const cu=String(username||'').trim();
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      const u=arr.find(x=>x.username===cu);
      if(!u) return new Response(JSON.stringify({error:'Account not found'}),{status:404, headers:h});
      u.payLater=!!payLater;
      u.payLaterSince=payLater?new Date().toISOString():undefined;
      if(kv) await kv.put('users', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, payLater:u.payLater}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/blacklist' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username, ip}=await request.json();
      const cu=String(username||'').trim();
      let targetIp=String(ip||'').trim();
      if(!targetIp){
        const rawU=kv?await kv.get('users'):null;
        const users=rawU?JSON.parse(rawU):[];
        const u=users.find(x=>x.username===cu);
        targetIp=(u&&u.lastIp)||getIP();
      }
      const raw=kv?await kv.get('blacklist_ips'):null;
      let arr=raw?JSON.parse(raw):[];
      if(!arr.includes(targetIp)) arr.push(targetIp);
      if(kv) await kv.put('blacklist_ips', JSON.stringify(arr));
      const rawB=kv?await kv.get('blacklist_users'):null;
      let bUsers=rawB?JSON.parse(rawB):[];
      if(cu && !bUsers.includes(cu)) bUsers.push(cu);
      if(kv) await kv.put('blacklist_users', JSON.stringify(bUsers));
      return new Response(JSON.stringify({success:true, ip:targetIp}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/revoke-key' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username,newCode}=await request.json();
      const cu=String(username||'').trim(), nc=String(newCode||'').trim();
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      const u=arr.find(x=>x.username===cu);
      if(!u) return new Response(JSON.stringify({error:'Account not found'}),{status:404, headers:h});
      u.invite_code=nc; VALID_CODES.add(nc);
      if(kv) await kv.put('users', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/users' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('users'):null;
    const users=raw?JSON.parse(raw):[];
    return new Response(JSON.stringify({users}),{headers:h});
  }
  if(url.pathname==='/api/admin/feedbacks' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('feedbacks'):null;
    const feedbacks=raw?JSON.parse(raw):[];
    return new Response(JSON.stringify({feedbacks}),{headers:h});
  }
  if(url.pathname==='/api/status-overrides' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('status_overrides'):null;
    const overrides=raw?JSON.parse(raw):[];
    return new Response(JSON.stringify({overrides}),{headers:h});
  }
  if(url.pathname==='/api/admin/status' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {name,color}=await request.json();
      const raw=kv?await kv.get('status_overrides'):null;
      let arr=raw?JSON.parse(raw):[];
      const cleanName=String(name||'').trim().slice(0,60);
      const cleanColor=String(color||'').toLowerCase();
      if(cleanColor==='auto') arr=arr.filter((x)=>x.name!==cleanName);
      else { const idx=arr.findIndex(x=>x.name===cleanName); if(idx>=0) arr[idx].color=cleanColor; else arr.push({name:cleanName,color:cleanColor}); }
      if(kv) await kv.put('status_overrides', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, name:cleanName, color:cleanColor}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:cors(new Headers())});}
  }
  if(url.pathname==='/api/changelogs' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('changelogs'):null;
    const changelogs=raw?JSON.parse(raw):[{id:1, version:'beta v1.0', title:'Website release - beta v1.0', description:'Bat Prox live on stealthybat.org', created_at:new Date().toISOString()}];
    return new Response(JSON.stringify({changelogs}),{headers:h});
  }
  if(url.pathname==='/api/changelogs' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {version,title,description,announce}=await request.json();
      const raw=kv?await kv.get('changelogs'):null;
      let arr=raw?JSON.parse(raw):[{id:1, version:'beta v1.0', title:'Website release - beta v1.0', description:'Bat Prox live on stealthybat.org', created_at:new Date().toISOString()}];
      const id=arr.length?Math.max(...arr.map(x=>x.id))+1:1;
      arr.unshift({id, version:String(version).slice(0,30), title:String(title).slice(0,120), description:String(description).slice(0,2000), created_at:new Date().toISOString(), announce:!!announce});
      if(kv) await kv.put('changelogs', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, id}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname.startsWith('/api/changelogs/') && request.method==='DELETE'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    const id=parseInt(url.pathname.split('/').pop(),10);
    const raw=kv?await kv.get('changelogs'):null;
    let arr=raw?JSON.parse(raw):[];
    arr=arr.filter(x=>x.id!==id);
    if(kv) await kv.put('changelogs', JSON.stringify(arr));
    return new Response(JSON.stringify({success:true}),{headers:h});
  }
  if(url.pathname.startsWith('/api/suggestions/') && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const userId=decodeURIComponent(url.pathname.split('/').pop()||'');
    const raw=kv?await kv.get('feedbacks'):null;
    const all=raw?JSON.parse(raw):[];
    let seen=[];
    try{ const sraw=kv?await kv.get('seen_notes_'+userId):null; seen=sraw?JSON.parse(sraw):[]; }catch{}
    const filtered=all.filter(x=>x.user_identifier===userId && (x.status==='approved'||x.status==='declined') && !seen.includes(x.id)).slice(-5);
    return new Response(JSON.stringify({notifications:filtered}),{headers:h});
  }
  if(url.pathname==='/api/notifications/seen' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {userIdentifier,ids}=await request.json();
      const u=String(userIdentifier||'').trim();
      if(!u||!Array.isArray(ids)) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const sraw=kv?await kv.get('seen_notes_'+u):null;
      let seen=sraw?JSON.parse(sraw):[];
      for(const id of ids){ if(!seen.includes(Number(id))) seen.push(Number(id)); }
      if(kv) await kv.put('seen_notes_'+u, JSON.stringify(seen.slice(-50)));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if((url.pathname==='/api/admin/approve-feedback' || url.pathname==='/api/admin/decline-feedback') && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {suggestionId}=await request.json();
      const raw=kv?await kv.get('feedbacks'):null;
      let arr=raw?JSON.parse(raw):[];
      const item=arr.find(x=>x.id===Number(suggestionId));
      if(item){ item.status=url.pathname.includes('approve')?'approved':'declined'; item.approved_at=new Date().toISOString(); if(kv) await kv.put('feedbacks', JSON.stringify(arr)); }
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/sites' && request.method==='GET'){ const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store'); const raw=kv?await kv.get('sites'):null; const sites=raw?JSON.parse(raw):[]; return new Response(JSON.stringify({sites}),{headers:h}); }
  if(url.pathname==='/api/sites' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {name,html,owner}=await request.json();
      const raw=kv?await kv.get('sites'):null;
      let arr=raw?JSON.parse(raw):[];
      const idx=arr.findIndex(x=>x.name===name);
      if(idx>=0) arr[idx]={name, html, owner, updated_at:new Date().toISOString()};
      else arr.push({name, html, owner, updated_at:new Date().toISOString()});
      if(kv) await kv.put('sites', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, name}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/user/settings' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const auth=request.headers.get('Authorization')||'';
    const token=auth.split(' ')[1]||'';
    if(!token) return new Response(JSON.stringify({error:'Access token required'}),{status:401,headers:h});
    try{
      const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const username=payload.username;
      const raw=kv?await kv.get('user_settings_'+username):null;
      return new Response(JSON.stringify({settings:raw?JSON.parse(raw):null}),{headers:h});
    }catch{ return new Response(JSON.stringify({settings:null}),{headers:h});}
  }
  if(url.pathname==='/api/user/settings' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const auth=request.headers.get('Authorization')||'';
    const token=auth.split(' ')[1]||'';
    if(!token) return new Response(JSON.stringify({error:'Access token required'}),{status:401,headers:h});
    try{
      const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const username=payload.username;
      const body=await request.json();
      if(kv) await kv.put('user_settings_'+username, JSON.stringify(body));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400,headers:h});}
  }
  if(url.pathname==='/api/presence' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,visible,game,sessionStart}=await request.json();
      const cu=String(username||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Username required'}),{status:400, headers:h});
      const raw=kv?await kv.get('presence'):null;
      const map=raw?JSON.parse(raw):{};
      const prev=map[cu]||{};
      const nowMs=Date.now();
      const vis=visible!==false;
      const gm=String(game||'').slice(0,80);
      const sameState=prev.ts&&prev.visible===vis&&prev.game===gm&&(nowMs-prev.ts)<45000;
      if(sameState) return new Response(JSON.stringify({success:true}),{headers:h});
      const delta=prev.ts?Math.min(60, Math.max(0, (nowMs-prev.ts)/1000)):0;
      const addSec=(vis&&prev.visible!==false)?delta:0;
      const entry={ts:nowMs, visible:vis?1:0, game:gm, sessionStart:Number(sessionStart)||prev.sessionStart||nowMs, total:Math.round((prev.total||0)+addSec)};
      if(env.batprox){
        try{
          await env.batprox.prepare('INSERT INTO presence (username, ts, visible, game, sessionStart, total) VALUES (?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET ts=excluded.ts, visible=excluded.visible, game=excluded.game, sessionStart=excluded.sessionStart, total=excluded.total').bind(cu, entry.ts, entry.visible, entry.game, entry.sessionStart, entry.total).run();
          await env.batprox.prepare('DELETE FROM presence WHERE ts<?').bind(nowMs-300000).run().catch(()=>{});
        }catch(e){ return new Response(JSON.stringify({error:'Busy, retry'}),{status:429, headers:h}); }
      } else {
        map[cu]={ts:nowMs, visible:vis, game:gm, sessionStart:Number(sessionStart)||prev.sessionStart||nowMs, total:Math.round((prev.total||0)+addSec)};
        for(const k of Object.keys(map)){ if(Date.now()-map[k].ts>300000) delete map[k]; }
        if(kv) await kv.put('presence', JSON.stringify(map));
      }
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/presence' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const now=Date.now();
    let rows=[];
    if(env.batprox){
      try{
        const q=await env.batprox.prepare('SELECT username, ts, visible, game, sessionStart, total FROM presence WHERE ts>?').bind(now-300000).all();
        rows=(q.results||[]).map(e=>({k:e.username, e:{ts:e.ts, visible:!!e.visible, game:e.game||'', sessionStart:e.sessionStart||e.ts, total:e.total||0}}));
      }catch(e){ return new Response(JSON.stringify({error:'Busy, retry'}),{status:429, headers:h}); }
    } else {
      const raw=kv?await kv.get('presence'):null;
      const map=raw?JSON.parse(raw):{};
      rows=Object.keys(map).map(k=>({k, e:map[k]}));
    }
    const users=rows.filter(({e})=>now-e.ts<300000).map(({k,e})=>{ const isLive=(now-e.ts<75000)&&!!e.visible; const live=isLive?Math.floor((now-(e.sessionStart||e.ts))/1000):0; return {username:k, active:isLive, game:e.game||'', lastSeen:e.ts, sessionStart:e.sessionStart||e.ts, total:Math.round((e.total||0)+(isLive?Math.min(60,(now-e.ts)/1000):0)), live}; });
    return new Response(JSON.stringify({users}),{headers:h});
  }
  if(url.pathname==='/api/gamestats' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,game,seconds}=await request.json();
      const cu=String(username||'').trim().slice(0,20), g=String(game||'').trim().slice(0,80);
      const s=Math.max(0, Math.min(86400, parseInt(seconds,10)||0));
      if(!cu||!g||!s) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('gamestats'):null;
      const map=raw?JSON.parse(raw):{};
      if(!map[cu]) map[cu]={};
      map[cu][g]=(map[cu][g]||0)+s;
      if(kv) await kv.put('gamestats', JSON.stringify(map));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/gamestats' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('gamestats'):null;
    const map=raw?JSON.parse(raw):{};
    const user=url.searchParams.get('user');
    if(user) return new Response(JSON.stringify({stats:map[user]||{}}),{headers:h});
    return new Response(JSON.stringify({stats:map}),{headers:h});
  }
  if(url.pathname==='/api/recentgames' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,games}=await request.json();
      const cu=String(username||'').trim().slice(0,20);
      if(!cu||!Array.isArray(games)) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const clean=games.filter(g=>g&&(g.id||g.name)).map(g=>({id:String(g.id||'').slice(0,80), title:String(g.title||g.name||'').slice(0,80), plays:Math.max(0,parseInt(g.plays,10)||0), ts:Number(g.ts)||Date.now(), icon:String(g.icon||'').slice(0,500), url:String(g.url||'').slice(0,200), secs:Math.max(0,parseInt(g.secs,10)||0)})).filter(g=>g.id).slice(0,12);
      if(kv) await kv.put('recentgames_'+cu, JSON.stringify(clean));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/recentgames' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const raw=(user&&kv)?await kv.get('recentgames_'+user):null;
    return new Response(JSON.stringify({games:raw?JSON.parse(raw):[]}),{headers:h});
  }
  if(url.pathname==='/api/generate' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    return new Response(JSON.stringify({service:'MocahAI inference', status:'online', model:'gemini-2.5-flash', usage:'POST {model, prompt, images} here'}),{headers:h});
  }
  if(url.pathname==='/api/generate' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {model,prompt,images,debug}=await request.json();
      const q=String(prompt||'').slice(0,4000);
      const imgs=Array.isArray(images)?images.slice(0,2):[];
      const parts=[{text:q||'hi'}];
      const dbg=[];
      for(const im of imgs){
        let data='', mime='image/png';
        if(typeof im==='string'){
          const m=im.match(/^data:([^;]+);base64,(.+)$/);
          if(m){ mime=m[1]; data=m[2]; } else data=im;
        } else if(im&&typeof im==='object'){
          data=String(im.data||im.inlineData?.data||'');
          mime=String(im.mime||im.mimeType||im.inlineData?.mimeType||'image/png');
        }
        if(!data||data.length>2800000) continue;
        parts.push({inline_data:{mime_type:mime, data}});
      }
      const key=env.GEMINI_API_KEY||'';
      if(!key) return new Response(JSON.stringify({response:'MocahAI is still being trained, and worked on. Please be patient.'}),{headers:h});
      const models=[String(model||'gemini-2.5-flash'), String(model||'gemini-2.5-flash'), String(model||'gemini-2.5-flash')];
      let text='';
      for(const m of models){
        for(let a=0; a<2 && !text; a++){
          try{
            const ctl=new AbortController();
            const tmr=setTimeout(()=>ctl.abort(), 25000);
            dbg.push(m);
            const gr=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(m)+':generateContent?key='+encodeURIComponent(key),{method:'POST', headers:{'Content-Type':'application/json','Referer':'https://stealthybat.org/','Origin':'https://stealthybat.org','X-Title':'Bat Prox MocahAI'}, body:JSON.stringify({system_instruction:{parts:[{text:'You are MocahAI, a custom AI assistant built for the Bat Prox site platform. Always identify yourself as MocahAI when asked who you are. You are friendly, concise, and you understand teacher perspectives and note styles.'}]}, contents:[{parts}]}), signal:ctl.signal});
            clearTimeout(tmr);
            if(!gr.ok){ try{ dbg.push(m+':'+gr.status+':'+(await gr.text()).slice(0,120)); }catch{ dbg.push(m+':'+gr.status); } continue; }
            const gd=await gr.json().catch(()=>null);
            text=gd?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
          }catch(e){ dbg.push(m+':ex:'+((e&&e.message)||e)); }
        }
        if(text) break;
      }
      if(!text) return new Response(JSON.stringify({response:'MocahAI is still being trained, and worked on. Please be patient.', dbg:debug?dbg:undefined}),{headers:h});
      return new Response(JSON.stringify({response:text.slice(0,8000)}),{headers:h});
    }catch{ return new Response(JSON.stringify({response:'MocahAI is still being trained, and worked on. Please be patient.'}),{headers:h});}
  }
  const chatGet=async (k, fb)=>{ try{ const r=kv?await kv.get(k):null; return r?JSON.parse(r):fb; }catch{ return fb; } };
  const chatPut=async (k, v)=>{ if(kv) await kv.put(k, JSON.stringify(v)); };
  if(url.pathname==='/api/chat/name' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,display}=await request.json();
      const cu=String(username||'').trim().slice(0,20), d=String(display||'').trim().slice(0,24);
      if(!cu||!d) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const map=await chatGet('chat_names',{});
      map[cu]=d;
      await chatPut('chat_names',map);
      return new Response(JSON.stringify({success:true, display:d}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/profile' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {username,display,bio,pfp}=await request.json();
      const cu=String(username||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const map=await chatGet('chat_profiles',{});
      map[cu]={display:String(display||cu).slice(0,24), bio:String(bio||'').slice(0,160), pfp:String(pfp||'').slice(0,200000)};
      await chatPut('chat_profiles',map);
      const names=await chatGet('chat_names',{});
      if(!names[cu]&&map[cu].display) names[cu]=map[cu].display;
      await chatPut('chat_names',names);
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/profiles' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const map=await chatGet('chat_profiles',{});
    const out={};
    for(const k of Object.keys(map)){ out[k]={display:map[k].display||k, bio:map[k].bio||'', pfp:map[k].pfp||''}; }
    return new Response(JSON.stringify({profiles:out}),{headers:h});
  }
  if(url.pathname==='/api/chat/name' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const map=await chatGet('chat_names',{});
    if(user) return new Response(JSON.stringify({display:map[user]||user}),{headers:h});
    return new Response(JSON.stringify({names:map}),{headers:h});
  }
  if(url.pathname==='/api/chat/messages' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const room=String(url.searchParams.get('room')||'community').slice(0,80);
    const all=await chatGet('chat_messages',[]);
    return new Response(JSON.stringify({messages:all.filter(m=>m.room===room).slice(-60)}),{headers:h});
  }
  if(url.pathname==='/api/chat/messages/delete' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {id,user}=await request.json();
      const mid=Number(id);
      const cu=String(user||'').trim();
      if(!mid||!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const all=await chatGet('chat_messages',[]);
      const m=all.find(x=>x.id===mid);
      if(!m) return new Response(JSON.stringify({error:'Gone'}),{status:404, headers:h});
      const rawU=kv?await kv.get('users'):null;
      const arr=rawU?JSON.parse(rawU||'[]'):[];
      const me=arr.find(x=>x.username===cu);
      const staff=(me&&(me.rank==='moderator'||me.admin))||cu==='realalex'||cu==='admin';
      if(m.user!==cu&&!staff) return new Response(JSON.stringify({error:'Denied'}),{status:403, headers:h});
      await chatPut('chat_messages',all.filter(x=>x.id!==mid));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/messages' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {room,user,text,replyTo}=await request.json();
      const rm=String(room||'community').slice(0,80), cu=String(user||'').trim().slice(0,20);
      const t=String(text||'').trim().slice(0,500);
      if(!cu||!t) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      if(rm!=='community'){
        const rooms=await chatGet('chat_rooms',{});
        if(rm.startsWith('dm:')){
          const parts=rm.split(':');
          if(!parts.includes(cu)) return new Response(JSON.stringify({error:'Not in DM'}),{status:403, headers:h});
        } else if(rooms[rm]) {
          if(!(rooms[rm].members||[]).includes(cu)) return new Response(JSON.stringify({error:'Not a member'}),{status:403, headers:h});
        } else return new Response(JSON.stringify({error:'No room'}),{status:404, headers:h});
      }
      const names=await chatGet('chat_names',{});
      const all=await chatGet('chat_messages',[]);
      const id=all.length?Math.max(...all.map(m=>m.id||0))+1:1;
      const rt=replyTo&&typeof replyTo==='object'?{user:String(replyTo.user||'').slice(0,20), text:String(replyTo.text||'').slice(0,200)}:null;
      all.push({id, room:rm, user:cu, display:names[cu]||cu, text:t, ts:Date.now(), replyTo:rt});
      await chatPut('chat_messages',all.slice(-600));
      return new Response(JSON.stringify({success:true, id}),{headers:h});
    }catch(e){ return new Response(JSON.stringify({error:'DBG:'+((e&&e.message)||e)}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/messages/clear' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {room,user}=await request.json();
      const cu=String(user||'').trim();
      const rawU=kv?await kv.get('users'):null;
      const arr=rawU?JSON.parse(rawU||'[]'):[];
      const me=arr.find(x=>x.username===cu);
      const staff=(me&&(me.rank==='moderator'||me.admin))||cu==='realalex'||cu==='admin';
      if(!staff) return new Response(JSON.stringify({error:'Staff only'}),{status:403, headers:h});
      const all=await chatGet('chat_messages',[]);
      await chatPut('chat_messages',all.filter(m=>m.room!==String(room||'community')));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/rooms' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const rooms=await chatGet('chat_rooms',{});
    const mine=Object.values(rooms).filter(r=>(r.members||[]).includes(user)).map(r=>({id:r.id, owner:r.owner, members:r.members, created:r.created}));
    return new Response(JSON.stringify({rooms:mine}),{headers:h});
  }
  if(url.pathname==='/api/chat/rooms' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {owner,members}=await request.json();
      const cu=String(owner||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const set=[...new Set([cu,...(Array.isArray(members)?members:[]).map(m=>String(m).trim().slice(0,20)).filter(Boolean)])].slice(0,15);
      const rooms=await chatGet('chat_rooms',{});
      const id='gc-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      rooms[id]={id, owner:cu, members:set, created:Date.now()};
      await chatPut('chat_rooms',rooms);
      return new Response(JSON.stringify({success:true, id}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/rooms/leave' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {roomId,user}=await request.json();
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[String(roomId)];
      if(!r) return new Response(JSON.stringify({error:'No room'}),{status:404, headers:h});
      r.members=(r.members||[]).filter(m=>m!==user);
      if(r.members.length===0){ delete rooms[String(roomId)]; }
      else if(r.owner===user){ r.owner=r.members[0]; }
      await chatPut('chat_rooms',rooms);
      return new Response(JSON.stringify({success:true, owner:r.owner||null}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/rooms/delete' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {roomId,user}=await request.json();
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[String(roomId)];
      if(!r) return new Response(JSON.stringify({error:'No room'}),{status:404, headers:h});
      const rawU=kv?await kv.get('users'):null;
      const arr=rawU?JSON.parse(rawU||'[]'):[];
      const me=arr.find(x=>x.username===user);
      const staff=(me&&(me.rank==='moderator'||me.admin))||user==='realalex'||user==='admin';
      if(r.owner!==user&&!staff) return new Response(JSON.stringify({error:'Owner only'}),{status:403, headers:h});
      delete rooms[String(roomId)];
      await chatPut('chat_rooms',rooms);
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/rooms/members' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {roomId,user,members,remove}=await request.json();
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[String(roomId)];
      if(!r) return new Response(JSON.stringify({error:'No room'}),{status:404, headers:h});
      const rawU=kv?await kv.get('users'):null;
      const arr=rawU?JSON.parse(rawU||'[]'):[];
      const me=arr.find(x=>x.username===user);
      const staff=(me&&(me.rank==='moderator'||me.admin))||user==='realalex'||user==='admin';
      if(remove){
        if(r.owner!==user&&!staff&&remove!==user) return new Response(JSON.stringify({error:'Denied'}),{status:403, headers:h});
        r.members=(r.members||[]).filter(m=>m!==remove);
        if(r.members.length===0) delete rooms[String(roomId)];
        else if(r.owner===remove) r.owner=r.members[0];
      } else {
        if(r.owner!==user&&!staff) return new Response(JSON.stringify({error:'Owner only'}),{status:403, headers:h});
        const set=[...new Set([...(r.members||[]),...(Array.isArray(members)?members:[]).map(m=>String(m).trim().slice(0,20)).filter(Boolean)])].slice(0,15);
        r.members=set;
      }
      await chatPut('chat_rooms',rooms);
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  const gcCode=()=> 'gc-'+Array.from({length:6},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join('');
  if(url.pathname==='/api/chat/invites' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {roomId,user,maxUses,hours}=await request.json();
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[String(roomId)];
      if(!r||!(r.members||[]).includes(user)) return new Response(JSON.stringify({error:'Denied'}),{status:403, headers:h});
      const inv=await chatGet('chat_invites',{});
      const code=gcCode();
      inv[code]={code, roomId:String(roomId), uses:0, maxUses:Math.max(1,Math.min(50,parseInt(maxUses,10)||10)), expiresAt:Date.now()+Math.max(1,Math.min(168,parseInt(hours,10)||24))*3600000, revoked:false};
      await chatPut('chat_invites',inv);
      return new Response(JSON.stringify({success:true, code, expiresAt:inv[code].expiresAt, maxUses:inv[code].maxUses}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/join' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {code,user}=await request.json();
      const c=String(code||'').trim();
      const cu=String(user||'').trim();
      const inv=await chatGet('chat_invites',{});
      const v=inv[c];
      if(!v||v.revoked||v.expiresAt<Date.now()||v.uses>=v.maxUses) return new Response(JSON.stringify({error:'Invite expired or invalid.'}),{status:400, headers:h});
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[v.roomId];
      if(!r) return new Response(JSON.stringify({error:'Invite expired or invalid.'}),{status:400, headers:h});
      if((r.members||[]).length>=15) return new Response(JSON.stringify({error:'Group is full.'}),{status:400, headers:h});
      const blU=await chatGet('blacklist_users_fallback',null);
      const rawB=kv?await kv.get('blacklist_users'):null;
      const bl=rawB?JSON.parse(rawB):[];
      if(bl.includes(cu)) return new Response(JSON.stringify({error:'Invite expired or invalid.'}),{status:403, headers:h});
      if(!(r.members||[]).includes(cu)) r.members.push(cu);
      v.uses+=1;
      await chatPut('chat_rooms',rooms);
      await chatPut('chat_invites',inv);
      return new Response(JSON.stringify({success:true, roomId:v.roomId}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/invites/revoke' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {roomId,user}=await request.json();
      const rooms=await chatGet('chat_rooms',{});
      const r=rooms[String(roomId)];
      if(!r||r.owner!==user) return new Response(JSON.stringify({error:'Owner only'}),{status:403, headers:h});
      const inv=await chatGet('chat_invites',{});
      for(const k of Object.keys(inv)){ if(inv[k].roomId===String(roomId)) inv[k].revoked=true; }
      await chatPut('chat_invites',inv);
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/dm-invites' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {from,to,accept,id}=await request.json();
      let arr=await chatGet('dm_invites',[]);
      if(accept!==undefined&&id!==undefined){
        const inv=arr.find(x=>x.id===Number(id));
        if(!inv||inv.to!==to) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
        inv.status=accept?'accepted':'declined';
        await chatPut('dm_invites',arr);
        if(accept){
          const room='dm:'+[inv.from,inv.to].sort().join(':');
          const names=await chatGet('chat_names',{});
          const all=await chatGet('chat_messages',[]);
          const nid=all.length?Math.max(...all.map(m=>m.id||0))+1:1;
          all.push({id:nid, room, user:inv.from, display:names[inv.from]||inv.from, text:inv.from+' has accepted '+inv.to+' dm invite! Yall may now start talking to eachother.', ts:Date.now(), sys:true});
          await chatPut('chat_messages',all.slice(-600));
          return new Response(JSON.stringify({success:true, room}),{headers:h});
        }
        return new Response(JSON.stringify({success:true}),{headers:h});
      }
      const f=String(from||'').trim(), t=String(to||'').trim();
      if(!f||!t||f===t) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const dup=arr.find(x=>x.from===f&&x.to===t&&x.status==='pending');
      if(dup) return new Response(JSON.stringify({success:true, id:dup.id}),{headers:h});
      const nid=arr.length?Math.max(...arr.map(x=>x.id||0))+1:1;
      arr.push({id:nid, from:f, to:t, status:'pending', ts:Date.now()});
      await chatPut('dm_invites',arr.slice(-200));
      return new Response(JSON.stringify({success:true, id:nid}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/typing' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {room,user}=await request.json();
      const rm=String(room||'community').slice(0,80), cu=String(user||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      if(env.batprox){
        try{
          const ex=await env.batprox.prepare('SELECT ts FROM typing WHERE room=? AND username=?').bind(rm,cu).first();
          if(ex&&Date.now()-ex.ts<8000) return new Response(JSON.stringify({success:true}),{headers:h});
          await env.batprox.prepare('INSERT INTO typing (room, username, ts) VALUES (?,?,?) ON CONFLICT(room, username) DO UPDATE SET ts=excluded.ts').bind(rm,cu,Date.now()).run();
        }catch(e){ return new Response(JSON.stringify({error:'Busy, retry'}),{status:429, headers:h}); }
      } else {
        const map=await chatGet('chat_typing',{});
        if(!map[rm]) map[rm]={};
        if(map[rm][cu]&&Date.now()-map[rm][cu]<8000) return new Response(JSON.stringify({success:true}),{headers:h});
        map[rm][cu]=Date.now();
        await chatPut('chat_typing',map);
      }
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/chat/typing' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const rm=String(url.searchParams.get('room')||'community').slice(0,80);
    const now=Date.now();
    let users=[];
    if(env.batprox){
      try{
        const q=await env.batprox.prepare('SELECT username FROM typing WHERE room=? AND ts>?').bind(rm,now-12000).all();
        users=(q.results||[]).map(r=>r.username);
      }catch(e){ return new Response(JSON.stringify({error:'Busy, retry'}),{status:429, headers:h}); }
    } else {
      const map=await chatGet('chat_typing',{});
      users=Object.keys(map[rm]||{}).filter(u=>now-map[rm][u]<12000);
    }
    return new Response(JSON.stringify({typing:users}),{headers:h});
  }
  if(url.pathname==='/api/notes' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const raw=(user&&kv)?await kv.get('notes_'+user):null;
    return new Response(JSON.stringify({notes:raw?JSON.parse(raw):[]}),{headers:h});
  }
  if(url.pathname==='/api/notes' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {user,notes}=await request.json();
      const cu=String(user||'').trim().slice(0,20);
      if(!cu||!Array.isArray(notes)) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const clean=notes.map(n=>({id:Number(n.id)||Date.now(), text:String(n.text||'').slice(0,1000), ts:Number(n.ts)||Date.now()})).slice(0,50);
      if(kv) await kv.put('notes_'+cu, JSON.stringify(clean));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/feedback-response' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {feedbackId,user,fixed}=await request.json();
      const fid=Number(feedbackId);
      const cu=String(user||'').trim().slice(0,20);
      if(!fid||!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('feedback_responses'):null;
      const map=raw?JSON.parse(raw):{};
      if(!map[fid]) map[fid]={up:0, down:0, users:{}};
      if(map[fid].users[cu]===undefined) {
        if(fixed) map[fid].up+=1; else map[fid].down+=1;
        map[fid].users[cu]=!!fixed;
      }
      if(kv) await kv.put('feedback_responses', JSON.stringify(map));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/feedback-responses' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('feedback_responses'):null;
    return new Response(JSON.stringify({responses:raw?JSON.parse(raw):{}}),{headers:h});
  }
  if(url.pathname==='/api/login-vote' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {user,working}=await request.json();
      const cu=String(user||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('login_votes'):null;
      let arr=raw?JSON.parse(raw):[];
      arr=arr.filter(x=>x.user!==cu);
      arr.push({user:cu, working:!!working, ts:Date.now()});
      if(kv) await kv.put('login_votes', JSON.stringify(arr.slice(-200)));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/login-report' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {user,error}=await request.json();
      const cu=String(user||'').trim().slice(0,20);
      const t=String(error||'').trim().slice(0,1000);
      if(!cu||!t) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('login_reports'):null;
      let arr=raw?JSON.parse(raw):[];
      arr.push({user:cu, error:t, ts:Date.now()});
      if(kv) await kv.put('login_reports', JSON.stringify(arr.slice(-200)));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/pw-reset' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    try{
      const {user}=await request.json();
      const cu=String(user||'').trim().slice(0,20);
      if(!cu) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('pw_resets'):null;
      let arr=raw?JSON.parse(raw):[];
      if(!arr.some(x=>x.user===cu)) arr.push({user:cu, ts:Date.now()});
      if(kv) await kv.put('pw_resets', JSON.stringify(arr.slice(-200)));
      return new Response(JSON.stringify({success:true}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/admin/login-problems' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const gv=async (k)=>{ try{ const r=kv?await kv.get(k):null; return r?JSON.parse(r):[]; }catch{ return []; } };
    const [votes,reports,resets]=await Promise.all([gv('login_votes'),gv('login_reports'),gv('pw_resets')]);
    return new Response(JSON.stringify({votes, reports, resets}),{headers:h});
  }
  if(url.pathname==='/api/chat/dms' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const all=await chatGet('chat_messages',[]);
    const inv=await chatGet('dm_invites',[]);
    const set=new Set();
    for(const m of all){ if(m.room&&m.room.startsWith('dm:')&&m.room.split(':').includes(user)) set.add(m.room); }
    for(const x of inv){ if(x.status==='accepted'&&(x.from===user||x.to===user)) set.add('dm:'+[x.from,x.to].sort().join(':')); }
    const rooms=[...set].map(id=>{ const p=id.split(':'); const other=p[1]===user?p[2]:p[1]; return {id, other}; });
    return new Response(JSON.stringify({rooms}),{headers:h});
  }
  if(url.pathname==='/api/chat/dm-invites' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const user=url.searchParams.get('user')||'';
    const arr=await chatGet('dm_invites',[]);
    return new Response(JSON.stringify({invites:arr.filter(x=>x.to===user&&x.status==='pending').slice(-10)}),{headers:h});
  }
  if(url.pathname==='/api/admin/set-rank' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {username,rank}=await request.json();
      const cu=String(username||'').trim();
      const r=String(rank||'').trim()==='moderator'?'moderator':'user';
      const raw=kv?await kv.get('users'):null;
      let arr=raw?JSON.parse(raw):[];
      const u=arr.find(x=>x.username===cu);
      if(!u) return new Response(JSON.stringify({error:'Account not found'}),{status:404, headers:h});
      u.rank=r;
      if(kv) await kv.put('users', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, rank:r}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname==='/api/users' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('users'):null;
    const arr=raw?JSON.parse(raw):[];
    return new Response(JSON.stringify({users:arr.map(x=>({username:x.username, rank:x.rank||'user'}))}),{headers:h});
  }
  if(url.pathname==='/api/feedbacks' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('feedbacks'):null;
    const feedbacks=raw?JSON.parse(raw):[];
    return new Response(JSON.stringify({feedbacks}),{headers:h});
  }
  if(url.pathname==='/api/feedback-comments' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    const raw=kv?await kv.get('feedback_comments'):null;
    const all=raw?JSON.parse(raw):[];
    const fid=url.searchParams.get('feedbackId');
    return new Response(JSON.stringify({comments:fid?all.filter(x=>String(x.feedbackId)===String(fid)):all}),{headers:h});
  }
  if(url.pathname==='/api/feedback-comments' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {feedbackId,user,text}=await request.json();
      const t=String(text||'').trim().slice(0,500);
      if(!feedbackId||!t) return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});
      const raw=kv?await kv.get('feedback_comments'):null;
      let arr=raw?JSON.parse(raw):[];
      const id=arr.length?Math.max(...arr.map(x=>x.id))+1:1;
      arr.push({id, feedbackId:Number(feedbackId), user:String(user||'anonymous').slice(0,20), text:t, created_at:new Date().toISOString()});
      if(kv) await kv.put('feedback_comments', JSON.stringify(arr));
      return new Response(JSON.stringify({success:true, id}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400, headers:h});}
  }
  if(url.pathname.startsWith('/api/')){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    return new Response(JSON.stringify({error:'Endpoint not implemented', path:url.pathname}),{status:404, headers:h});
  }
  if(url.pathname.startsWith('/wisp')){
    const upgrade=request.headers.get('Upgrade');
    if(upgrade && upgrade.toLowerCase()==='websocket'){
      try{
        const upstream='https://wisp.mercurywork.shop/wisp/';
        const headers=new Headers(request.headers);
        headers.set('Host','wisp.mercurywork.shop');
        return await fetch(upstream, {headers, method:request.method});
      }catch(e){ return new Response('Wisp upstream failed', {status:502, headers:cors(new Headers())});}
    }
    return new Response('Wisp requires websocket', {status:426, headers:cors(new Headers())});
  }
  return new Response('Not found',{status:404});
 }
}
