import Epoxy from '/epoxy/index.mjs';

const measure = async (relay, target) => {
  const t = new Epoxy({ wisp: relay });
  await t.init();
  const t0 = performance.now();
  const job = (async () => {
    const res = await t.request(new URL(target + (target.includes('?') ? '&' : '?') + 'bp=' + Math.random().toString(36).slice(2)), 'GET', null, {}, null);
    if (res.status !== 200) throw new Error('status ' + res.status);
    const buf = await new Response(res.body).arrayBuffer();
    return buf.byteLength;
  })();
  const bytes = await Promise.race([job, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))]);
  if (bytes < 10000) throw new Error('short');
  return Math.round(performance.now() - t0);
};

self.onmessage = async (e) => {
  const relays = Array.isArray(e.data && e.data.relays) ? e.data.relays : [];
  const target = String((e.data && e.data.target) || '');
  const results = [];
  for (const relay of relays) {
    let ms = -1;
    try { ms = await measure(relay, target); } catch (x) {}
    results.push({ relay, ms });
  }
  self.postMessage({ type: 'done', results });
};
