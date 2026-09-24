import { connect } from 'cloudflare:sockets';

const BUFFER = 128;
const T_CONNECT = 1;
const T_DATA = 2;
const T_CONTINUE = 3;
const T_CLOSE = 4;

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

const privateHost = (host: string) => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd|fe80)/.test(h)) return true;
  return false;
};

type Stream = { socket: any; writer: WritableStreamDefaultWriter; chain: Promise<void>; count: number };

function serve(ws: WebSocket) {
  const streams = new Map<number, Stream>();
  const send = (type: number, id: number, payload?: Uint8Array) => {
    const out = new Uint8Array(5 + (payload ? payload.length : 0));
    out[0] = type;
    new DataView(out.buffer).setUint32(1, id, true);
    if (payload) out.set(payload, 5);
    try { ws.send(out); } catch {}
  };
  const close = (id: number, reason: number, notify = true) => {
    const s = streams.get(id);
    if (!s) return;
    streams.delete(id);
    try { s.writer.releaseLock(); } catch {}
    try { s.socket.close(); } catch {}
    if (notify) send(T_CLOSE, id, new Uint8Array([reason]));
  };

  const open = (id: number, body: Uint8Array) => {
    if (body.length < 4) { send(T_CLOSE, id, new Uint8Array([0x41])); return; }
    const kind = body[0];
    const port = body[1] | (body[2] << 8);
    const host = new TextDecoder().decode(body.subarray(3)).trim();
    if (kind !== 1 || !host || !port) { send(T_CLOSE, id, new Uint8Array([0x41])); return; }
    if (privateHost(host) || port === 25) { send(T_CLOSE, id, new Uint8Array([0x48])); return; }
    let socket: any;
    try {
      socket = connect({ hostname: host, port }, { allowHalfOpen: false });
    } catch {
      send(T_CLOSE, id, new Uint8Array([0x42]));
      return;
    }
    const writer = socket.writable.getWriter();
    streams.set(id, { socket, writer, chain: Promise.resolve(), count: 0 });
    (async () => {
      try {
        const reader = socket.readable.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) send(T_DATA, id, value);
        }
        close(id, 0x02);
      } catch {
        close(id, 0x03);
      }
    })();
  };

  ws.addEventListener('message', (ev: MessageEvent) => {
    if (typeof ev.data === 'string') return;
    const buf = new Uint8Array(ev.data as ArrayBuffer);
    if (buf.length < 5) return;
    const type = buf[0];
    const id = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(1, true);
    const body = buf.subarray(5);
    if (type === T_CONNECT) { open(id, body); return; }
    if (type === T_DATA) {
      const s = streams.get(id);
      if (!s) return;
      const chunk = body.slice();
      s.chain = s.chain.then(() => s.writer.write(chunk)).catch(() => close(id, 0x03));
      s.count++;
      if (s.count >= BUFFER / 2) {
        s.count = 0;
        const owner = s;
        s.chain = s.chain.then(() => { if (streams.get(id) === owner) send(T_CONTINUE, id, u32(BUFFER)); });
      }
      return;
    }
    if (type === T_CLOSE) close(id, 0x02, false);
  });

  const shutdown = () => {
    for (const id of [...streams.keys()]) close(id, 0x02, false);
  };
  ws.addEventListener('close', shutdown);
  ws.addEventListener('error', shutdown);

  send(T_CONTINUE, 0, u32(BUFFER));
}

export async function onRequest(context: any) {
  const req: Request = context.request;
  if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response('wisp relay', { status: 426, headers: { 'Content-Type': 'text/plain', 'Upgrade': 'websocket' } });
  }
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  serve(server);
  return new Response(null, { status: 101, webSocket: client } as any);
}
