export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy') || url.pathname.startsWith('/wisp') || url.pathname.startsWith('/baremux') || url.pathname.startsWith('/uv') || url.pathname.startsWith('/epoxy')) {
    const res = await context.next();
    res.headers.set('Access-Control-Allow-Origin', 'https://stealthybat.org');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', '*');
    return res;
  }
  return context.next();
}
