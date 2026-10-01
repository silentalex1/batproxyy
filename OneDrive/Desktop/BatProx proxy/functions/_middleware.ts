export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/wisp')) return context.next();
  if (url.pathname.startsWith('/assets/')) {
    const res = await context.next();
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return res;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy')) {
    const res = await context.next();
    res.headers.set('Access-Control-Allow-Origin', 'https://stealthybat.org');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', '*');
    return res;
  }
  return context.next();
}
