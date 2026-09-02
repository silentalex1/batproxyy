export async function onRequest(context:any){
  const url=new URL(context.request.url);
  const target='https://authlogin.stealthlybat.it.com'+url.pathname+url.search;
  try{
    const r=await fetch(target,{method:context.request.method, headers:context.request.headers, body:context.request.method==='GET'||context.request.method==='HEAD'?undefined:await context.request.arrayBuffer()});
    const body=await r.arrayBuffer();
    const h=new Headers(r.headers);
    h.set('Access-Control-Allow-Origin','https://stealthybat.org');
    h.set('Access-Control-Allow-Credentials','true');
    return new Response(body,{status:r.status, headers:h});
  }catch(e:any){
    return new Response(JSON.stringify({error:'Backend unreachable'}),{status:502, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
  }
}
