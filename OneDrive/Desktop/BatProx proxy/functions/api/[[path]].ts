export async function onRequest(context:any){
  if(context.request.method==='OPTIONS') return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin':'https://stealthybat.org','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'*'}});
  const url=new URL(context.request.url);
  const known=['/api/auth','/api/admin','/api/bridge','/api/sites','/api/check-blacklist','/api/user/settings','/api/status','/api/changelogs','/api/suggestions','/api/my-games','/api/ai','/api/recentgames','/api/gamestats','/api/presence','/api/search'];
  if(!known.some(k=>url.pathname===k||url.pathname.startsWith(k+'/'))){
    const ref=context.request.headers.get('referer')||'';
    const m=ref.match(/proxy\?url=([^&]+)/);
    if(m){
      try{
        const base=new URL(decodeURIComponent(m[1]));
        const target=base.origin+url.pathname+url.search;
        const r=await fetch(target,{method:context.request.method, headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36','Accept':context.request.headers.get('accept')||'*/*','Referer':base.origin+'/'}, redirect:'follow'});
        const body=await r.arrayBuffer();
        const h=new Headers(r.headers);
        for(const k of [...h.keys()]){ const lk=k.toLowerCase(); if(lk==='content-security-policy'||lk==='x-frame-options') h.delete(k); }
        h.set('Access-Control-Allow-Origin','*'); h.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); h.set('Access-Control-Allow-Headers','*');
        return new Response(body,{status:r.status<500?r.status:200, headers:h});
      }catch{}
    }
  }
  const direct=['/api/users','/api/presence','/api/gamestats','/api/recentgames','/api/chat','/api/notes','/api/feedback-response','/api/notifications','/api/admin','/api/bridge','/api/sites','/api/status','/api/changelogs','/api/suggestions','/api/my-games','/api/ai','/api/search'];
  const backends=direct.some(k=>url.pathname===k||url.pathname.startsWith(k+'/'))?['https://api.stealthybat.org','https://authlogin.stealthlybat.it.com']:['https://authlogin.stealthlybat.it.com','https://api.stealthybat.org'];
  const reqBody=context.request.method==='GET'||context.request.method==='HEAD'?undefined:await context.request.arrayBuffer();
  for(const backend of backends){
    try{
      const r=await fetch(backend+url.pathname+url.search,{method:context.request.method, headers:context.request.headers, body:reqBody});
      if(r.status>=500||r.status===404) continue;
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      if(url.pathname.startsWith('/api/auth') && !ct.includes('json') && !ct.includes('javascript')) continue;
      const body=await r.arrayBuffer();
      if(url.pathname.startsWith('/api/auth')){
        try{
          const t=new TextDecoder().decode(body);
          if(!/^\s*[\{\[]/.test(t)) continue;
        }catch{}
      }
      const h=new Headers(r.headers);
      const origin=context.request.headers.get('Origin')||'';
      let allow='https://stealthybat.org';
      try{
        if(!origin||origin==='null') allow='*';
        else if(origin.indexOf('blob:')===0) allow=origin;
        else {
          const host=new URL(origin).hostname;
          if(host==='stealthybat.org'||host.endsWith('.stealthybat.org')||host.endsWith('.workers.dev')||host.endsWith('.pages.dev')) allow=origin;
        }
      }catch{}
      h.set('Access-Control-Allow-Origin',allow);
      if(allow!=='*') h.set('Access-Control-Allow-Credentials','true');
      return new Response(body,{status:r.status, headers:h});
    }catch{}
  }
  return new Response(JSON.stringify({error:'Backend unreachable'}),{status:502, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
}
