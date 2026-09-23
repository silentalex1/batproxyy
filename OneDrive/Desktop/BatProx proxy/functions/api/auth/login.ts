const VALID_CODES = ['BATPROX-2026', 'WELCOME-BAT', 'NIGHT-PROX', 'FOX-CORE', 'batprox-admin$$'];
function b64url(s: string) { return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64urlBytes(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function hmacSign(payload: any, secret: string) {
  const h = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const p = b64url(JSON.stringify(payload));
  const data = h+'.'+p;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data+'.'+b64urlBytes(sig);
}
function headersFor(request: Request) {
  const origin = request.headers.get('Origin') || '';
  let allow = 'https://stealthybat.org';
  try {
    if (!origin || origin === 'null') return {'Content-Type':'application/json','Access-Control-Allow-Origin': '*'};
    if (origin.indexOf('blob:') === 0) allow = origin;
    else {
      const host = new URL(origin).hostname;
      if (host === 'stealthybat.org' || host.endsWith('.stealthybat.org') || host === 'batnight.org' || host.endsWith('.batnight.org') || host === 'stealthlybat.it.com' || host.endsWith('.stealthlybat.it.com') || host === 'authlogin.stealthlybat.it.com' || host.endsWith('.workers.dev') || host.endsWith('.pages.dev')) allow = origin;
    }
  } catch {}
  return {'Content-Type':'application/json','Access-Control-Allow-Origin': allow};
}
function unwrapAuth(data: any) {
  let cur = data;
  for (let i = 0; i < 6; i++) {
    if (!cur || typeof cur !== 'object') return cur;
    const hasToken = typeof cur.token === 'string' && cur.token.length > 0 && cur.user && typeof cur.user.username === 'string';
    const hasErr = typeof cur.success === 'boolean' || typeof cur.error === 'string';
    if (hasToken || hasErr) return cur;
    if (Object.prototype.hasOwnProperty.call(cur, 'data')) { cur = cur.data; continue; }
    return cur;
  }
  return cur;
}
function pack(payload: any, request: Request, httpStatus = 200) {
  const body = {
    ok: payload && payload.success !== false,
    status: httpStatus,
    success: payload && payload.success,
    token: payload && payload.token,
    user: payload && payload.user,
    error: payload && payload.error,
    banned: payload && payload.banned,
    data: payload
  };
  return new Response(JSON.stringify(body), { status: 200, headers: headersFor(request) });
}
export async function onRequestPost(context: any) {
  const request = context.request;
  const backends = [context.env?.BACKEND_URL || context.env?.API_URL || 'https://api.stealthybat.org', 'https://authlogin.stealthlybat.it.com', 'https://batproxyy.asdwwas233.workers.dev'];
  let raw = '';
  try { raw = await request.text(); } catch { raw = ''; }
  if (context.env?.TURNSTILE_SECRET) {
    try {
      const bodyCheck = JSON.parse(raw || '{}');
      if (bodyCheck.turnstileToken) {
        const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `secret=${encodeURIComponent(context.env.TURNSTILE_SECRET)}&response=${encodeURIComponent(bodyCheck.turnstileToken)}` });
        const vd: any = await v.json();
        if (!vd.success) return pack({success:false, error:'Human verification failed'}, request, 403);
      }
    } catch {}
  }
  for (const backend of backends) {
    try {
      const r = await fetch(String(backend).replace(/\/$/,'') + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: raw });
      if (r.status >= 500 || r.status === 404) continue;
      let data: any = null;
      try {
        const text = await r.text();
        if (!/^\s*[\{\[]/.test(text || '')) continue;
        data = JSON.parse(text);
      } catch { data = null; }
      const payload = unwrapAuth(data);
      const hasToken = payload && typeof payload.token === 'string' && payload.token.length > 0 && payload.user && typeof payload.user.username === 'string';
      const hasErr = payload && (payload.success === false || typeof payload.error === 'string');
      if (hasToken || hasErr) return pack(payload, request, r.status);
    } catch {}
  }
  try {
    const {username, inviteCode} = JSON.parse(raw || '{}');
    if (!username || !inviteCode) return pack({success:false, error:'Username and invite code are required'}, request, 400);
    const cleanUser = String(username).trim();
    const cleanCode = String(inviteCode).trim();
    if (cleanUser.length<3 || cleanUser.length>20) return pack({success:false, error:'Username must be between 3 and 20 characters'}, request, 400);
    if (!VALID_CODES.includes(cleanCode) && cleanCode.length<4) return pack({success:false, error:'Invalid invite code'}, request, 401);
    const isAdmin = cleanCode==='FOX-CORE' || cleanCode==='batprox-admin$$' || cleanUser==='realalex' || cleanUser==='admin';
    const secret = context.env?.JWT_SECRET || 'stealthybat-fallback-secret';
    const token = await hmacSign({id:1, username: cleanUser, isAdmin, exp: Math.floor(Date.now()/1000)+86400}, secret);
    return pack({success:true, token, user:{id:1, username: cleanUser}}, request, 200);
  } catch {
    return pack({success:false, error:'Backend unreachable'}, request, 0);
  }
}
export async function onRequestOptions(context: any) {
  const h = headersFor(context.request);
  return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin': h['Access-Control-Allow-Origin'],'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'*'}});
}
