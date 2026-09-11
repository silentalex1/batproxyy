const BACKENDS = ['https://api.stealthybat.org', 'https://batproxyy.asdwwas233.workers.dev'];
async function relay(context: any, method: string, raw?: ArrayBuffer) {
  const search = new URL(context.request.url).search;
  for (const b of BACKENDS) {
    try {
      const r = await fetch(String(b).replace(/\/$/, '') + '/api/admin/code-request' + search, { method, headers: context.request.headers, body: raw });
      if (r.status >= 500 || r.status === 404) continue;
      const body = await r.arrayBuffer();
      const t = new TextDecoder().decode(body);
      if (!/^\s*[\{\[]/.test(t)) continue;
      const h = new Headers(r.headers);
      h.set('Content-Type', 'application/json');
      h.set('Cache-Control', 'no-store');
      h.set('Access-Control-Allow-Origin', '*');
      return new Response(body, { status: r.status, headers: h });
    } catch {}
  }
  return new Response(JSON.stringify({ success: false, error: 'Code request backend unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' } });
}
export async function onRequestGet(context: any) {
  return relay(context, 'GET');
}
export async function onRequestPost(context: any) {
  return relay(context, 'POST', await context.request.arrayBuffer());
}
