export async function onRequestGet(context:any){
  const url=new URL(context.request.url);
  const user=String(url.searchParams.get('user')||'').trim().slice(0,32);
  const origin=context.request.headers.get('Origin')||'*';
  const h=new Headers({'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'});
  return new Response(JSON.stringify({alwaysAllow:false}),{headers:h});
}
export async function onRequestPost(context:any){
  const origin=context.request.headers.get('Origin')||'*';
  const h=new Headers({'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'});
  try{
    const {alwaysAllow}=await context.request.json();
    return new Response(JSON.stringify({success:true,alwaysAllow:!!alwaysAllow}),{headers:h});
  }catch{ return new Response(JSON.stringify({error:'Invalid'}),{status:400,headers:h}); }
}
export async function onRequestOptions(context:any){
  const origin=context.request.headers.get('Origin')||'*';
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'}});
}
