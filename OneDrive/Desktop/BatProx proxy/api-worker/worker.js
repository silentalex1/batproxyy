const VALID_CODES = new Set(['BATPROX-2026','WELCOME-BAT','NIGHT-PROX','FOX-CORE','batprox-admin$$']);
function b64url(s){ return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sign(payload, secret){
  const h=b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const p=b64url(JSON.stringify(payload));
  const data=h+'.'+p;
  return data+'.'+b64url(secret.slice(0,16)+data.slice(-8));
}
function cors(h){ h.set('Access-Control-Allow-Origin','https://stealthybat.org'); h.set('Access-Control-Allow-Credentials','true'); h.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); h.set('Access-Control-Allow-Headers','*'); return h; }
export default {
 async fetch(request, env){
  const url=new URL(request.url);
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
    try{
      const {username, inviteCode}=await request.json();
      if(!username||!inviteCode) return new Response(JSON.stringify({error:'Username and invite code are required'}),{status:400, headers:{'Content-Type':'application/json'}});
      const cu=String(username).trim(), cc=String(inviteCode).trim();
      if(cu.length<3||cu.length>20) return new Response(JSON.stringify({error:'Username must be between 3 and 20 characters'}),{status:400, headers:{'Content-Type':'application/json'}});
      if(!VALID_CODES.has(cc)) return new Response(JSON.stringify({error:'Invalid invite code'}),{status:401, headers:{'Content-Type':'application/json'}});
      const isAdmin= cc==='FOX-CORE'||cc==='batprox-admin$$'||cu==='realalex'||cu==='admin';
      const secret=env.JWT_SECRET||'stealthybat-fallback-secret';
      const token=sign({id:1,username:cu,isAdmin},secret);
      const h=cors(new Headers()); h.set('Content-Type','application/json');
      return new Response(JSON.stringify({success:true, token, user:{id:1, username:cu}}),{headers:h});
    }catch(e){ return new Response(JSON.stringify({error:'Internal error'}),{status:500});}
  }
  if(url.pathname==='/api/auth/me'){
    const auth=request.headers.get('Authorization')||'';
    const token=auth.split(' ')[1]||'';
    if(!token) return new Response(JSON.stringify({error:'Access token required'}),{status:401});
    try{
      const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const h=cors(new Headers()); h.set('Content-Type','application/json');
      return new Response(JSON.stringify({user:{id:payload.id||1, username:payload.username||'user'}, isAdmin:!!payload.isAdmin}),{headers:h});
    }catch{ return new Response(JSON.stringify({error:'Invalid token'}),{status:403});}
  }
  if(url.pathname==='/proxy' || url.pathname.startsWith('/proxy/')){
    const targetUrl=url.searchParams.get('url');
    if(!targetUrl) return new Response('URL parameter is required',{status:400});
    try{
      const parsed=new URL(targetUrl);
      if(!['http:','https:'].includes(parsed.protocol)) return new Response('Only HTTP and HTTPS allowed',{status:400});
      const r=await fetch(targetUrl,{headers:{'User-Agent':'Mozilla/5.0 Chrome/120'}});
      const ct=r.headers.get('content-type')||'text/html';
      let body=await r.arrayBuffer();
      if(ct.includes('html')){ let t=new TextDecoder().decode(body); t=t.replace(/<head[^>]*>/i,m=>m+`<script>window.__bpBase=${JSON.stringify(parsed.href)};</script>`); body=new TextEncoder().encode(t); }
      const h=new Headers(r.headers); h.set('Access-Control-Allow-Origin','*'); h.set('X-Proxy-Response','true'); h.set('Content-Type',ct);
      return new Response(body,{status:r.status, headers:h});
    }catch(e){ return new Response('Proxy error: '+(e.message||'failed'),{status:502});}
  }
  if(url.pathname.startsWith('/api/admin/feedbacks') || url.pathname.startsWith('/api/suggestions') || url.pathname.startsWith('/api/changelogs') || url.pathname.startsWith('/api/sites') || url.pathname==='/api/status-overrides' || url.pathname==='/api/admin/users' || url.pathname==='/api/admin/status'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    if(url.pathname==='/api/status-overrides') return new Response(JSON.stringify({overrides:[]}),{headers:h});
    if(url.pathname==='/api/changelogs' && request.method==='GET') return new Response(JSON.stringify({changelogs:[{id:1, version:'beta v1.0', title:'Website release - beta v1.0', description:'Bat Prox live on stealthybat.org', created_at:new Date().toISOString()}]}),{headers:h});
    if(url.pathname==='/api/sites' && request.method==='GET') return new Response(JSON.stringify({sites:[]}),{headers:h});
    if(url.pathname==='/api/admin/feedbacks' || url.pathname==='/api/admin/users') return new Response(JSON.stringify({feedbacks:[], users:[]}),{headers:h});
    return new Response(JSON.stringify({success:true}),{headers:h});
  }
  if(url.pathname.startsWith('/api/')){
    return new Response(JSON.stringify({error:'Not implemented on edge, use backend'}),{status:501, headers:{'Content-Type':'application/json'}});
  }
  if(url.pathname.startsWith('/wisp')){
    return new Response('Wisp requires Node backend at api.stealthybat.org — use /proxy fallback', {status:101, headers:cors(new Headers())});
  }
  return new Response('Not found',{status:404});
 }
}
