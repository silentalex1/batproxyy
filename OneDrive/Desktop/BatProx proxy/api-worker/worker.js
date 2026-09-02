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
      const body=await request.json();
      const username=body.username, inviteCode=body.inviteCode;
      if(!username||!inviteCode) return new Response(JSON.stringify({error:'Username and invite code are required'}),{status:400, headers:{'Content-Type':'application/json'}});
      const cu=String(username).trim(), cc=String(inviteCode).trim();
      if(cu.length<3||cu.length>20) return new Response(JSON.stringify({error:'Username must be between 3 and 20 characters'}),{status:400, headers:{'Content-Type':'application/json'}});
      try{
        const rawU=kv?await kv.get('users'):null;
        const users=rawU?JSON.parse(rawU||'[]'):[];
        const found=users.find(x=>x.username===cu);
        if(found){
          if(found.invite_code!==cc) return new Response(JSON.stringify({error:'Invite code does not match this account'}),{status:401, headers:{'Content-Type':'application/json'}});
        } else {
          if(!VALID_CODES.has(cc)) return new Response(JSON.stringify({error:'Invalid invite code'}),{status:401, headers:{'Content-Type':'application/json'}});
        }
      }catch{}
      const isAdmin= cc==='FOX-CORE'||cc==='batprox-admin$$'||cu==='realalex'||cu==='admin';
      const secret=env.JWT_SECRET||'stealthybat-fallback-secret';
      const token=sign({id:1,username:cu,isAdmin},secret);
      const h=cors(new Headers()); h.set('Content-Type','application/json');
      return new Response(JSON.stringify({success:true, token, user:{id:1, username:cu}}),{headers:h});
    }catch(e){ return new Response(JSON.stringify({error:'Login failed: '+(e.message||'unknown')}),{status:500, headers:{'Content-Type':'application/json'}});}
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
      const r=await fetch(targetUrl,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept':request.headers.get('accept')||'text/html,*/*','Accept-Language':'en-US,en;q=0.9'}});
      const ct=r.headers.get('content-type')||'text/html';
      let body=await r.arrayBuffer();
      const isText=/html|css|javascript|json|xml|svg|text\//i.test(ct);
      let text=isText?new TextDecoder().decode(body):null;
      if(text!==null && ct.includes('html')){
        const base=parsed.href;
        const proxyAsset=(raw, b)=>{ if(!raw) return raw; const t=String(raw).trim(); if(!t||t.startsWith('data:')||t.startsWith('javascript:')||t.startsWith('mailto:')||t.startsWith('#')||t.startsWith('blob:')||t.startsWith('/proxy')) return t; try{ const abs=new URL(t,b).href; return '/proxy?url='+encodeURIComponent(abs);}catch{return t;}};
        const rewriteCss=(css,b)=>css.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>'url('+q+proxyAsset(u,b)+q+')');
        text=text.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,'');
        text=text.replace(/(src|href|action|poster|data-src|data-href)=(["'])([^"']+)\2/gi,(m,a,q,u)=>a+'='+q+proxyAsset(u,base)+q);
        text=rewriteCss(text,base);
        text=text.replace(/srcset=(["'])([^"']+)\1/gi,(m,q,v)=>{ const parts=v.split(',').map(p=>{const b=p.trim().split(/\s+/); b[0]=proxyAsset(b[0],base); return b.join(' ');}); return 'srcset='+q+parts.join(', ')+q;});
        const inject=`<script>(function(){window.__bpBase=${JSON.stringify(base)};function p(u){try{if(!u||typeof u!=='string')return u;if(u.indexOf('data:')===0||u.indexOf('blob:')===0||u.indexOf('javascript:')===0||u.indexOf('about:')===0||u.indexOf('mailto:')===0||u.charAt(0)==='#')return u;if(u.indexOf('/proxy?url=')===0)return u;var a=new URL(u,window.__bpBase||document.baseURI);if(a.pathname==='/proxy'||a.pathname.indexOf('/proxy')===0||a.pathname.indexOf('/api')===0||a.pathname.indexOf('/wisp')===0||a.pathname.indexOf('/uv')===0||a.pathname.indexOf('/epoxy')===0||a.pathname.indexOf('/baremux')===0||a.pathname.indexOf('/site')===0)return a.href;var b=new URL(window.__bpBase||document.baseURI);if(a.origin===window.location.origin){return '/proxy?url='+encodeURIComponent(b.protocol+'//'+b.host+a.pathname+a.search+a.hash);}return '/proxy?url='+encodeURIComponent(a.href);}catch(e){return u;}}var of=window.fetch;window.fetch=function(i,n){try{if(typeof i==='string')return of(p(i),n);if(i&&typeof Request!=='undefined'&&i instanceof Request)return of(new Request(p(i.url),i),n);if(i&&i.url)return of(new Request(p(i.url),i),n);}catch(e){}return of(i,n);};var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);if(typeof a[1]==='string')a[1]=p(a[1]);return oo.apply(this,a);};var osa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{if(typeof v==='string'&&(n==='src'||n==='href'||n==='action')&&v.indexOf('data:')!==0&&v.indexOf('blob:')!==0&&v.indexOf('javascript:')!==0&&v.charAt(0)!=='#')v=p(v);}catch(e){}return osa.call(this,n,v);};})();<\/script>`;
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
      const h=new Headers(r.headers); h.delete('content-security-policy'); h.delete('content-security-policy-report-only'); h.delete('x-frame-options'); h.set('Access-Control-Allow-Origin','*'); h.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); h.set('Access-Control-Allow-Headers','*'); h.set('X-Proxy-Response','true'); h.set('Content-Type',ct);
      return new Response(body,{status:r.status, headers:h});
    }catch(e){ return new Response('Proxy error: '+(e.message||'failed'),{status:502, headers:cors(new Headers())});}
  }
  const kv=env.batprox_data;
  if(url.pathname==='/api/my-games' && request.method==='GET'){
    const h=cors(new Headers()); h.set('Content-Type','application/json'); h.set('Cache-Control','no-store');
    return new Response(JSON.stringify({games:[]}),{headers:h});
  }
  if(url.pathname==='/api/suggestions' && request.method==='POST'){
    const h=cors(new Headers()); h.set('Content-Type','application/json');
    try{
      const {content,userIdentifier,genre}=await request.json();
      const raw=kv?await kv.get('feedbacks'):null;
      let arr=raw?JSON.parse(raw):[];
      arr.push({id:arr.length+1, content:String(content).slice(0,1000), user_identifier:userIdentifier||'anonymous', genre:genre||'Feedback suggestions', submitted_at:new Date().toISOString(), status:'pending'});
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
      const {version,title,description}=await request.json();
      const raw=kv?await kv.get('changelogs'):null;
      let arr=raw?JSON.parse(raw):[{id:1, version:'beta v1.0', title:'Website release - beta v1.0', description:'Bat Prox live on stealthybat.org', created_at:new Date().toISOString()}];
      const id=arr.length?Math.max(...arr.map(x=>x.id))+1:1;
      arr.unshift({id, version:String(version).slice(0,30), title:String(title).slice(0,120), description:String(description).slice(0,2000), created_at:new Date().toISOString()});
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
