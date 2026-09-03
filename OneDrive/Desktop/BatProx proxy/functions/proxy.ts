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
  if (!targetUrl || targetUrl.includes('&quot;')) return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
  try {
    const parsed = new URL(targetUrl);
    if (!['http:','https:'].includes(parsed.protocol)) return new Response('Only HTTP and HTTPS allowed',{status:400});
    const r = await fetch(targetUrl, { headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36','Accept': context.request.headers.get('accept')||'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}, redirect:'follow' });
    const ct = r.headers.get('content-type')||'application/octet-stream';
    let body: any = await r.arrayBuffer();
    if (body.byteLength===0) return new Response(body,{status:200, headers:{'Content-Type':ct,'Access-Control-Allow-Origin':'*','X-Proxy-Response':'true'}});
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
    return new Response('',{status:204, headers:{'Access-Control-Allow-Origin':'*'}});
  }
}
