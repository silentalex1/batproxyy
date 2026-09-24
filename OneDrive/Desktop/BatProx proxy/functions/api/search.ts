function xmlText(s: string) { return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'"); }
function escHtml(s: string) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function collectSearch(q: string) {
  const items: Array<{ title: string; link: string; desc: string }> = [];
  const seen = new Set<string>();
  const add = (title: string, link: string, desc: string) => {
    if (!link || !title) return;
    let href = String(link).trim();
    try { href = new URL(href).href; } catch { return; }
    if (!/^https?:/i.test(href)) return;
    if (seen.has(href)) return;
    seen.add(href);
    items.push({ title: xmlText(title).replace(/<[^>]+>/g, '').trim(), link: href, desc: xmlText(desc).replace(/<[^>]+>/g, '').trim() });
  };
  try {
    const r = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&format=rss', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
    const t = await r.text();
    const re = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const block = m[1];
      add((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '', (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '', (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '');
    }
  } catch {}
  if (items.length < 3) {
    try {
      const r = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html' } });
      const t = await r.text();
      const re = /<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) add(m[2], m[1], '');
    } catch {}
  }
  return items.slice(0, 12);
}
function searchPage(engine: string, q: string, items: Array<{ title: string; link: string; desc: string }>) {
  const names: Record<string, string> = { batnight: 'BatNight Engine', scry: 'Scry engine', scremjet: 'Scremjet', google: 'Google', ddg: 'DuckDuckGo', ask: 'Ask', yahoo: 'Yahoo' };
  const name = names[engine] || 'BatNight Engine';
  const accent = engine === 'scry' ? '#22d3ee' : engine === 'scremjet' ? '#fb923c' : engine === 'google' ? '#60a5fa' : engine === 'yahoo' ? '#a78bfa' : '#c084fc';
  const rows = items.map((it) => {
    return '<a class="hit" href="#" data-go="' + escHtml(it.link) + '"><div class="t">' + escHtml(it.title || it.link) + '</div><div class="u">' + escHtml(it.link) + '</div>' + (it.desc ? '<div class="d">' + escHtml(it.desc) + '</div>' : '') + '</a>';
  }).join('');
  const empty = (!q) ? '<p class="empty">Type a search.</p>' : (items.length ? '' : '<p class="empty">No results. Try another query.</p>');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escHtml(name) + '</title><style>html,body{margin:0;background:#07070b;color:#f5f5f5;font-family:system-ui,sans-serif}body{padding:20px 18px 40px}.bar{display:flex;gap:10px;align-items:center;margin:0 auto 22px;max-width:860px}h1{font-size:18px;margin:0 8px 0 0;color:' + accent + ';white-space:nowrap}form{flex:1;display:flex;gap:8px}input{flex:1;border:1px solid #ffffff22;background:#12121a;color:#fff;border-radius:999px;padding:10px 16px;font-size:14px;outline:none}button{border:0;background:' + accent + ';color:#0b0b10;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}.list{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:10px}.hit{display:block;text-decoration:none;color:inherit;background:#0f0f16;border:1px solid #ffffff12;border-radius:16px;padding:14px 16px}.hit:hover{border-color:' + accent + '66}.t{font-size:16px;font-weight:650;color:#fff}.u{font-size:12px;color:' + accent + ';margin:4px 0;word-break:break-all}.d{font-size:13px;color:#c4c4d4;line-height:1.45}.empty{max-width:860px;margin:24px auto;color:#9ca3af;text-align:center}</style></head><body><div class="bar"><h1>' + escHtml(name) + '</h1><form method="GET" action="/api/search"><input type="hidden" name="engine" value="' + escHtml(engine) + '"><input name="q" value="' + escHtml(q) + '" autofocus><button type="submit">Search</button></form></div><div class="list">' + rows + empty + '</div><script>(function(){document.addEventListener("click",function(e){var t=e.target;var a=t&&t.closest?t.closest("a.hit"):null;if(!a)return;e.preventDefault();e.stopPropagation();var u=a.getAttribute("data-go")||"";if(!u)return;try{parent.postMessage({type:"batprox-nav",url:u},"*");}catch(x){}});})();<\/script></body></html>';
}
export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const q = String(url.searchParams.get('q') || '').trim();
  const engine = String(url.searchParams.get('engine') || 'batnight').toLowerCase();
  const items = q ? await collectSearch(q) : [];
  return new Response(searchPage(engine, q, items), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' } });
}
