export async function onRequestGet(context: any) {
  const backend = context.env?.BACKEND_URL || context.env?.API_URL || 'https://authlogin.stealthlybat.it.com';
  const url = backend.replace(/\/$/,'') + '/api/auth/me';
  const auth = context.request.headers.get('Authorization') || '';
  try {
    const r = await fetch(url, { headers:{'Authorization': auth}});
    const data = await r.text();
    if (r.ok || r.status===401 || r.status===403) return new Response(data, { status: r.status, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
  } catch {}
  const token = auth.split(' ')[1] || '';
  if (!token) return new Response(JSON.stringify({error:'Access token required'}),{status:401, headers:{'Content-Type':'application/json'}});
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return new Response(JSON.stringify({user:{id:payload.id||1, username:payload.username||'user'}, isAdmin: !!payload.isAdmin}),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://stealthybat.org'}});
  } catch {
    return new Response(JSON.stringify({error:'Invalid token'}),{status:403, headers:{'Content-Type':'application/json'}});
  }
}
export async function onRequestOptions() {
  return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin':'https://stealthybat.org','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'*'}});
}
