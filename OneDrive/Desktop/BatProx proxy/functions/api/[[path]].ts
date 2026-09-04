export async function onRequest(context:any){
  if(context.request.method==='OPTIONS') return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin':'https://stealthybat.org','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'*'}});
  const url=new URL(context.request.url);
  const known=['/api/auth','/api/admin','/api/sites','/api/check-blacklist','/api/user/settings','/api/status','/api/changelogs','/api/suggestions','/api/my-games','/api/ai'];
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
  const backends=['https://authlogin.stealthlybat.it.com','https://api.stealthybat.org'];
  const reqBody=context.request.method==='GET'||context.request.method==='HEAD'?undefined:await context.request.arrayBuffer();
  const isLogin=url.pathname==='/api/auth/login';
  for(const backend of backends){
    try{
      const r=await fetch(backend+url.pathname+url.search,{method:context.request.method, headers:context.request.headers, body:reqBody});
      if(r.status>=500||r.status===404) continue;
      const body=await r.arrayBuffer();
      const h=new Headers(r.headers);
      h.set('Access-Control-Allow-Origin','https://stealthybat.org');
      h.set('Access-Control-Allow-Credentials','true');
      if(isLogin){
        let data=null;
        try{ data=JSON.parse(new TextDecoder().decode(body)); }catch{ data=null; }
        return new Response(JSON.stringify({ok:r.ok, status:r.status, data}),{status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org','Access-Control-Allow-Credentials':'true'}});
      }
      return new Response(body,{status:r.status, headers:h});
    }catch{}
  }
  if(isLogin) return new Response(JSON.stringify({ok:false, status:0, data:{success:false, error:'Backend unreachable'}}),{status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
  return new Response(JSON.stringify({error:'Backend unreachable'}),{status:502, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
}
