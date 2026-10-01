export async function onRequest(context:any){
  if(context.request.method==='OPTIONS') return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin': context.request.headers.get('Origin') || '*','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'*'}});
  const url=new URL(context.request.url);
  if(url.pathname.startsWith('/api/music/audius/') && (context.request.method==='GET'||context.request.method==='HEAD')){
    const rest=url.pathname.slice('/api/music/audius/'.length);
    const allow={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges'};
    if(!/^[A-Za-z0-9/_-]{1,160}$/.test(rest)) return new Response(JSON.stringify({error:'Bad path'}),{status:400, headers:{...allow,'Content-Type':'application/json'}});
    const qs=new URLSearchParams(url.search);
    qs.set('app_name','BatProx');
    const fwd:Record<string,string>={'User-Agent':'BatProx/1.0','Accept':context.request.headers.get('accept')||'*/*'};
    const range=context.request.headers.get('range');
    if(range) fwd['Range']=range;
    try{
      const r=await fetch('https://api.audius.co/v1/'+rest+'?'+qs.toString(),{method:context.request.method, headers:fwd, redirect:'follow'});
      const h=new Headers();
      for(const k of ['content-type','content-length','content-range','accept-ranges','cache-control']){ const v=r.headers.get(k); if(v) h.set(k,v); }
      for(const [k,v] of Object.entries(allow)) h.set(k,v);
      return new Response(r.body,{status:r.status>=500?424:r.status, headers:h});
    }catch{
      return new Response(JSON.stringify({error:'Music service unreachable'}),{status:424, headers:{...allow,'Content-Type':'application/json'}});
    }
  }
  const known=['/api/domains','/api/drops','/api/feedback-comments','/api/feedback-responses','/api/feedbacks','/api/fnad-scores','/api/generate','/api/login-report','/api/login-vote','/api/pw-reset','/api/status-overrides','/api/user','/api/votes','/api/errors','/api/ai','/api/auth','/api/admin','/api/account','/api/bridge','/api/sites','/api/check-blacklist','/api/user/settings','/api/status','/api/changelogs','/api/suggestions','/api/my-games','/api/ai','/api/recentgames','/api/gamestats','/api/presence','/api/search','/api/music'];
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
  const direct=['/api/domains','/api/drops','/api/feedback-comments','/api/feedback-responses','/api/feedbacks','/api/fnad-scores','/api/generate','/api/login-report','/api/login-vote','/api/pw-reset','/api/status-overrides','/api/user','/api/votes','/api/errors','/api/ai','/api/users','/api/presence','/api/gamestats','/api/recentgames','/api/chat','/api/notes','/api/feedback-response','/api/notifications','/api/admin','/api/account','/api/bridge','/api/sites','/api/status','/api/changelogs','/api/suggestions','/api/my-games','/api/ai','/api/search','/api/music'];
  const NEW_API='https://api-stealthybat.batprox-proxy.workers.dev';
  const backends=direct.some(k=>url.pathname===k||url.pathname.startsWith(k+'/'))?[NEW_API,'https://api.stealthybat.org','https://authlogin.stealthlybat.it.com']:[NEW_API,'https://authlogin.stealthlybat.it.com','https://api.stealthybat.org'];
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
      let allow=origin||'*';
      try{
        if(!origin||origin==='null') allow='*';
        else if(origin.indexOf('blob:')===0) allow=origin;
        else {
          const host=new URL(origin).hostname;
          if(host) allow=origin;
        }
      }catch{}
      h.set('Access-Control-Allow-Origin',allow);
      if(allow!=='*') h.set('Access-Control-Allow-Credentials','true');
      return new Response(body,{status:r.status, headers:h});
    }catch{}
  }
  return new Response(JSON.stringify({error:'Backend unreachable'}),{status:502, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin': context.request.headers.get('Origin') || '*'}});
}
