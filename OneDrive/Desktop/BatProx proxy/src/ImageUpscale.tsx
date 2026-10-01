import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail } from './Chrome';

type TierId = '4k' | '8k' | '9k';

interface Tier {
  id: TierId;
  label: string;
  width: number;
  height: number;
  staffOnly: boolean;
  note: string;
}

const TIERS: Tier[] = [
  { id: '4k', label: '4K Ultra HD', width: 3840, height: 2160, staffOnly: false, note: '3840 x 2160' },
  { id: '8k', label: '8K Ultra HD', width: 7680, height: 4320, staffOnly: true, note: '7680 x 4320' },
  { id: '9k', label: '9K Cinema', width: 9216, height: 5184, staffOnly: true, note: '9216 x 5184' }
];

const prettyBytes = (n: number) => {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
};

function drawStep(src: HTMLCanvasElement | HTMLImageElement, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function sharpen(canvas: HTMLCanvasElement, amount: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  if (w * h > 40000000) return canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const d = out.data;
  const k = amount;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const p = i + c;
        const centre = s[p];
        const around = s[p - 4] + s[p + 4] + s[p - w * 4] + s[p + w * 4];
        const v = centre * (1 + 4 * k) - around * k;
        d[p] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

export default function ImageUpscale() {
  const navigate = useNavigate();
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  const [isStaff, setIsStaff] = useState(false);
  const [tier, setTier] = useState<TierId>('4k');
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [srcDims, setSrcDims] = useState({ w: 0, h: 0 });
  const [outUrl, setOutUrl] = useState('');
  const [outDims, setOutDims] = useState({ w: 0, h: 0 });
  const [outSize, setOutSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } })();
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsStaff(!!d.isAdmin || !!d.isMod); })
      .catch(() => {});
  }, []);

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  useEffect(() => {
    const has = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e: DragEvent) => { if (!has(e)) return; e.preventDefault(); dragDepth.current += 1; setDragging(true); };
    const over = (e: DragEvent) => { if (!has(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e: DragEvent) => { if (!has(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); };
    const drop = (e: DragEvent) => {
      if (!has(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) accept(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const accept = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('That file is not an image.'); return; }
    if (f.size > 25 * 1024 * 1024) { setError('That image is over 25 MB. Try a smaller one.'); return; }
    setError('');
    setOutUrl('');
    setOutSize(0);
    setPct(0);
    setStage('');
    setFile(f);
    const url = URL.createObjectURL(f);
    setSrcUrl(url);
    const img = new Image();
    img.onload = () => setSrcDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  };

  const activeTier = TIERS.find(t => t.id === tier) || TIERS[0];
  const locked = activeTier.staffOnly && !isStaff;

  const run = async () => {
    if (!file || busy) return;
    if (locked) { setError('That quality is for staff only.'); return; }
    setBusy(true);
    setError('');
    setOutUrl('');
    setPct(0);
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    try {
      setStage('Reading image');
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Could not decode that image.'));
        i.src = srcUrl;
      });
      setPct(10);
      await wait(16);

      const scale = Math.min(activeTier.width / img.naturalWidth, activeTier.height / img.naturalHeight);
      const targetW = Math.round(img.naturalWidth * scale);
      const targetH = Math.round(img.naturalHeight * scale);

      setStage('Upscaling');
      let canvas = drawStep(img, img.naturalWidth, img.naturalHeight);
      let curW = img.naturalWidth;
      let curH = img.naturalHeight;
      let guard = 0;
      while (curW < targetW && guard < 12) {
        const nextW = Math.min(targetW, Math.round(curW * 1.6));
        const nextH = Math.round(nextW * (targetH / targetW));
        canvas = drawStep(canvas, nextW, nextH);
        curW = nextW;
        curH = nextH;
        guard += 1;
        setPct(10 + Math.round((curW / targetW) * 60));
        await wait(16);
      }
      if (curW !== targetW || curH !== targetH) canvas = drawStep(canvas, targetW, targetH);

      setStage('Sharpening detail');
      setPct(78);
      await wait(16);
      sharpen(canvas, 0.38);

      setStage('Encoding');
      setPct(90);
      await wait(16);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Could not encode the result.');
      if (outUrl) URL.revokeObjectURL(outUrl);
      setOutUrl(URL.createObjectURL(blob));
      setOutDims({ w: canvas.width, h: canvas.height });
      setOutSize(blob.size);
      setPct(100);
      setStage('Done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upscaling failed.');
      setPct(0);
      setStage('');
    }
    setBusy(false);
  };

  const download = () => {
    if (!outUrl || !file) return;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const a = document.createElement('a');
    a.href = outUrl;
    a.download = `${base}-${tier}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const reset = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (outUrl) URL.revokeObjectURL(outUrl);
    setFile(null);
    setSrcUrl('');
    setOutUrl('');
    setSrcDims({ w: 0, h: 0 });
    setOutDims({ w: 0, h: 0 });
    setOutSize(0);
    setPct(0);
    setStage('');
    setError('');
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail />
      {dragging && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="absolute inset-5 rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--bp-accent)' }} />
          <p className="text-2xl font-semibold">Drop your image</p>
        </div>
      )}

      <header className="relative z-10 h-16 px-5 sm:pl-24 sm:pr-8 flex items-center gap-3 border-b border-white/[0.06]">
        <button onClick={() => navigate('/dashboard')} className="h-9 px-4 flex items-center gap-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm text-white/80 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Home
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Image to 4K</p>
          <p className="text-[11px] text-white/35">{me ? `signed in as ${me}` : 'not signed in'}{isStaff ? ' · staff' : ''}</p>
        </div>
        {outUrl && <button onClick={reset} className="ml-auto h-9 px-4 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm text-white/70 hover:text-white transition-colors">New image</button>}
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-5 sm:pl-24 sm:pr-8 py-10">
        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-3xl border-2 border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] py-24 flex flex-col items-center justify-center transition-colors"
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(var(--bp-glow), 0.16)', border: '1px solid rgba(var(--bp-glow), 0.4)' }}>
              <svg className="w-10 h-10" style={{ color: 'var(--bp-accent)' }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <p className="text-xl font-semibold">Drop your image here</p>
            <p className="text-sm text-white/40 mt-2">or click to choose one. PNG, JPG, WebP or GIF, up to 25 MB.</p>
          </button>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center">
                <p className="text-[11px] uppercase tracking-widest text-white/35">Original</p>
                <p className="ml-auto text-[11px] text-white/45 tabular-nums">{srcDims.w} x {srcDims.h}</p>
              </div>
              <div className="aspect-video bg-black/40 flex items-center justify-center">
                {srcUrl && <img src={srcUrl} alt="" className="max-w-full max-h-full object-contain" />}
              </div>
              <p className="px-4 py-2.5 text-[11px] text-white/35 truncate">{file.name} · {prettyBytes(file.size)}</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center">
                <p className="text-[11px] uppercase tracking-widest text-white/35">Upscaled</p>
                <p className="ml-auto text-[11px] text-white/45 tabular-nums">{outDims.w ? `${outDims.w} x ${outDims.h}` : activeTier.note}</p>
              </div>
              <div className="aspect-video bg-black/40 flex items-center justify-center">
                {outUrl ? (
                  <img src={outUrl} alt="" className="max-w-full max-h-full object-contain" />
                ) : busy ? (
                  <div className="w-3/4">
                    <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: pct + '%', background: 'linear-gradient(90deg, var(--bp-accent), var(--bp-accent-2))' }} />
                    </div>
                    <div className="flex items-center mt-2">
                      <span className="text-[11px] text-white/40">{stage}</span>
                      <span className="ml-auto text-[12px] font-semibold tabular-nums" style={{ color: 'var(--bp-accent)' }}>{pct}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/25">nothing yet</p>
                )}
              </div>
              <p className="px-4 py-2.5 text-[11px] text-white/35">{outSize ? `PNG · ${prettyBytes(outSize)}` : 'pick a quality and run it'}</p>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <label className="block text-xs text-white/50 mb-2">Output quality</label>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={tier}
                  onChange={e => { setTier(e.target.value as TierId); setError(''); }}
                  className="flex-1 min-w-[220px] px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60"
                >
                  {TIERS.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#12121a]">
                      {t.label} ({t.note}){t.staffOnly && !isStaff ? ' - staff only' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={run}
                  disabled={busy || locked}
                  className="px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, var(--bp-accent), var(--bp-accent-2))' }}
                >
                  {busy ? 'Working..' : 'Upscale'}
                </button>
                <button
                  onClick={download}
                  disabled={!outUrl}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 disabled:opacity-30 transition-colors"
                >
                  Download
                </button>
              </div>
              {locked && <p className="mt-3 text-[12px] text-amber-300/80">{activeTier.label} is for staff, mods and admins. 4K is available to everyone.</p>}
              {error && <p className="mt-3 text-[12px] text-red-300">{error}</p>}
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) accept(f); }} />
      </main>
    </div>
  );
}
