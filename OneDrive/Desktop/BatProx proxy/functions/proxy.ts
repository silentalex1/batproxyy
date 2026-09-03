export async function onRequestGet(context: any) { return handle(context); }
export async function onRequestPost(context: any) { return handle(context); }
export async function onRequestOptions() {
  return new Response(null,{status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'}});
}
async function handle(context: any) {
  const backend = context.env?.BACKEND_URL || context.env?.API_URL || 'https://api.stealthybat.org';
  try {
    const url = new URL(context.request.url);
    const target = backend.replace(/\/$/,'') + '/proxy' + url.search;
    const r = await fetch(target, { method: context.request.method, headers: context.request.headers });
    if (r.ok || r.status < 500) {
      const body = await r.arrayBuffer();
      const h = new Headers(r.headers);
      h.set('Access-Control-Allow-Origin','*');
      h.set('X-Proxy-Response','true');
      return new Response(body, { status: r.status, headers: h });
    }
  } catch {}
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return new Response('URL parameter is required',{status:400});
  try {
    const parsed = new URL(targetUrl);
    if (!['http:','https:'].includes(parsed.protocol)) return new Response('Only HTTP and HTTPS allowed',{status:400});
    const r = await fetch(targetUrl, { headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36','Accept': context.request.headers.get('accept')||'text/html,*/*'}, redirect:'follow' });
    const ct = r.headers.get('content-type')||'text/html';
    let body: any = await r.arrayBuffer();
    if (ct.includes('html') || ct.includes('css') || ct.includes('javascript')) {
      let text = new TextDecoder().decode(body);
      if (ct.includes('html')) {
        const inject = `<script>window.__bpBase=${JSON.stringify(parsed.href)};</script>`;
        text = text.replace(/<head[^>]*>/i, (m)=>m+inject);
      }
      body = text;
    }
    const h = new Headers();
    h.set('Content-Type', ct);
    h.set('Access-Control-Allow-Origin','*');
    h.set('X-Proxy-Response','true');
    return new Response(body, { status: r.status < 500 ? r.status : 200, headers: h });
  } catch (e:any) {
    return new Response('',{status:200, headers:{'Content-Type':'text/plain','Access-Control-Allow-Origin':'*'}});
  }
}
