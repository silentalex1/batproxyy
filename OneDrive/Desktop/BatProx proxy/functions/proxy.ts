export async function onRequestGet(context: any) { return handle(context); }
export async function onRequestPost(context: any) { return handle(context); }
export async function onRequestOptions() {
  return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'}});
}
async function handle(context: any) {
  const backend = context.env?.BACKEND_URL || context.env?.API_URL || 'https://api.stealthybat.org';
  try {
    const url = new URL(context.request.url);
    const target = backend.replace(/\/$/,'') + '/proxy' + url.search;
    const r = await fetch(target, { method: context.request.method, headers: context.request.headers });
    if (r.ok || r.status < 500) {
      const body = await r.arrayBuffer();
      const h = new Headers(r.headers);
      h.set('Access-Control-Allow-Origin','*');
      h.set('X-Proxy-Response','true');
      return new Response(body, { status: r.status, headers: h });
    }
  } catch {}
  const url = new URL(context.request.url);
  let targetUrl = url.searchParams.get('url'); try{ const b64=decodeURIComponent(targetUrl); const dec=decodeURIComponent(escape(atob(b64))); if(/^https?:\/\//.test(dec)) targetUrl=dec; }catch{} try{ const dec2=decodeURIComponent(escape(atob(targetUrl))); if(/^https?:\/\//.test(dec2)) targetUrl=dec2; }catch{}
  if (!targetUrl || targetUrl.includes('&quot;')) return new Response('{}',{status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  if (targetUrl.includes('sentry.io')||targetUrl.includes('ingest')||targetUrl.includes('cdn-cgi/rum')||targetUrl.includes('/_/_/csp')||targetUrl.includes('/_/_/trace')) return new Response('{}',{status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'}});
  try {
    const parsed = new URL(targetUrl);
    if (!['http:','https:'].includes(parsed.protocol)) return new Response('Only HTTP and HTTPS allowed',{status:400});
    const hn = parsed.hostname.toLowerCase();
    if (hn==='localhost'||hn==='::1'||hn.includes('stealthybat.org')||hn.includes('stealthlybat.it.com')||/^127\.|^10\.|^192\.168\.|^169\.254\./.test(hn)||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hn)) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
    const ctl = new AbortController();
    const tmr = setTimeout(() => ctl.abort(), 10000);
    let r: Response;
    try { r = await fetch(targetUrl, { headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36','Accept': context.request.headers.get('accept')||'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}, redirect:'follow', signal: ctl.signal }); }
    finally { clearTimeout(tmr); }
    const ct = r.headers.get('content-type')||'application/octet-stream';
    let body: any = await r.arrayBuffer();
    if (body.byteLength===0) return new Response(body,{status:200, headers:{'Content-Type':ct,'Access-Control-Allow-Origin':'*','X-Proxy-Response':'true'}});
    if (body.byteLength>10*1024*1024) return new Response('',{status:200, headers:{'Content-Type':ct,'Access-Control-Allow-Origin':'*','X-Proxy-Response':'true'}});
    if (targetUrl.includes('Sentry')||targetUrl.includes('sentry')){const hb=new Headers();hb.set('Content-Type','application/javascript');hb.set('Access-Control-Allow-Origin','*');hb.set('X-Proxy-Response','true');return new Response('self.Sentry={init:function(){},captureException:function(){},captureMessage:function(){},captureEvent:function(){},addBreadcrumb:function(){},withScope:function(c){try{c({})}catch(e){}}};window.Sentry=self.Sentry;window.__SENTRY__={hub:{}};', {status:200, headers:hb});}
    if (ct.includes('html') || ct.includes('css') || ct.includes('javascript')) {
      let text = new TextDecoder().decode(body);
      if (text.includes('Keep your account safe')){const hb=new Headers();hb.set('Content-Type','application/javascript');hb.set('Access-Control-Allow-Origin','*');hb.set('X-Proxy-Response','true');return new Response('self.Sentry={init:function(){},captureException:function(){},captureMessage:function(){},captureEvent:function(){},addBreadcrumb:function(){},withScope:function(c){try{c({})}catch(e){}}};window.Sentry=self.Sentry;window.__SENTRY__={hub:{}};', {status:200, headers:hb});}
      if (ct.includes('html')) {
        const inject = `<script>window.Sentry={init:function(){},captureException:function(){},captureMessage:function(){},captureEvent:function(){},addBreadcrumb:function(){},withScope:function(c){try{c({})}catch(e){}}};window.__SENTRY__={hub:{}};window.GoogleAnalyticsEvents={trigger:function(){}};window.ga=function(){};try{var _lg=console.log;console.log=function(){var m=String(arguments[0]||'');if(/Keep your account safe|_______|rbxcdn/i.test(m))return;return _lg.apply(console,arguments);};}catch(e){}try{if(navigator.sendBeacon){var _sb=navigator.sendBeacon;navigator.sendBeacon=function(u,d){try{var su=String(u);if(su.indexOf('sentry')>-1||su.indexOf('ingest')>-1||su.indexOf('metrics.roblox.com')>-1||su.indexOf('bundle-metrics')>-1)return true;}catch(e){}return _sb.call(navigator,u,d);};}}catch(e){}window.__bpBase=${JSON.stringify(parsed.href)};</script>`;
        text=text.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,'');
        text=text.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,'');
        text=text.replace(/\s+integrity="[^"]*"/gi,'');
        text=text.replace(/\s+integrity='[^']*'/gi,'');
        text=text.replace(/<link[^>]+\brel=["']?preload["']?[^>]*>/gi, m=>m.replace(/\s+crossorigin(?:="[^"]*"|='[^']*'|=[^\s>]+)?/gi,''));
        const proxyAsset=(raw:string,b:string)=>{ if(!raw) return raw; const t=String(raw).trim(); if(!t||t.indexOf('&quot;')>-1||t.indexOf('&amp;')>-1||t.startsWith('data:')||t.startsWith('javascript:')||t.startsWith('mailto:')||t.startsWith('#')||t.startsWith('blob:')||t.startsWith('/proxy')||t.length>2000) return t; try{ const abs=new URL(t,b).href; try{return '/proxy?url='+encodeURIComponent(btoa(unescape(encodeURIComponent(abs))))}catch{return '/proxy?url='+encodeURIComponent(abs)};}catch{return t;}};
        const rewriteCss=(css:string,b:string)=>css.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>{ if(u.indexOf('&quot;')>-1||u.indexOf('data:')===0) return m; return 'url('+q+proxyAsset(u,b)+q+')';});
        let parts=text.split(/(<script[\s\S]*?<\/script>)/gi);
        for(let i=0;i<parts.length;i++){
          if(/^<script/i.test(parts[i])){
            const m=parts[i].match(/^<script([^>]*)>([\s\S]*?)<\/script>/i);
            if(m){
              let open='<script'+m[1]+'>';
              open=open.replace(/\s+integrity="[^"]*"/gi,'').replace(/\s+integrity='[^']*'/gi,'');
              open=open.replace(/(src|href)=(["'])([^"']+)\2/gi,(mm,a,q,u)=>a+'='+q+proxyAsset(u,parsed.href)+q);
              parts[i]=open+m[2]+'</script>';
            }
            continue;
          }
          parts[i]=parts[i].replace(/(src|href|action|poster|data-src|data-href)=(["'])([^"']+)\2/gi,(m,a,q,u)=>a+'='+q+proxyAsset(u,parsed.href)+q);
          parts[i]=rewriteCss(parts[i],parsed.href);
          parts[i]=parts[i].replace(/srcset=(["'])([^"']+)\1/gi,(m,q,v)=>{const ps=v.split(',').map(p=>{const b=p.trim().split(/\s+/);b[0]=proxyAsset(b[0],parsed.href);return b.join(' ');});return 'srcset='+q+ps.join(', ')+q;});
        }
        text=parts.join('');
        text = text.replace(/<head[^>]*>/i, (m)=>m+inject);
      }
      body = text;
    }
    const h = new Headers();
    h.set('Content-Type', ct);
    h.set('Access-Control-Allow-Origin','*');
    h.set('X-Proxy-Response','true');
    return new Response(body, { status: r.status < 500 ? r.status : 200, headers: h });
  } catch (e:any) {
    return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
  }
}
