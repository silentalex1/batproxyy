import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail } from './Chrome';
import { domEncode, domSurface, fitSize, runUpscale, type Detail, type OutFormat, type UpscaleJob, type UpscaleResult } from './upscaleCore';
import { listSaved, removeSaved, saveUpscale, type SavedUpscale } from './upscaleStore';

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

const DETAILS: { id: Detail; label: string; hint: string }[] = [
  { id: 'off', label: 'Soft', hint: 'resample only' },
  { id: 'natural', label: 'Natural', hint: 'balanced sharpening' },
  { id: 'crisp', label: 'Crisp', hint: 'strong edge detail' }
];

const FORMATS: { id: OutFormat; label: string; ext: string }[] = [
  { id: 'image/png', label: 'PNG (lossless)', ext: 'png' },
  { id: 'image/webp', label: 'WebP (smaller)', ext: 'webp' },
  { id: 'image/jpeg', label: 'JPG (smallest)', ext: 'jpg' }
];

const extFor = (type: string) => FORMATS.find(f => f.id === type)?.ext || 'png';

const prettyBytes = (n: number) => {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
};

class JobError extends Error {}

function runInWorker(job: UpscaleJob, onProgress: (pct: number, stage: string) => void) {
  return new Promise<UpscaleResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./upscale.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = ev => {
      const m = ev.data;
      if (m.type === 'progress') onProgress(m.pct, m.stage);
      else if (m.type === 'done') { worker.terminate(); resolve(m.result); }
      else if (m.type === 'error') { worker.terminate(); reject(new JobError(m.message)); }
    };
    worker.onerror = ev => {
      ev.preventDefault();
      worker.terminate();
      reject(new Error('worker unavailable'));
    };
    worker.postMessage(job, [job.bitmap]);
  });
}

interface OutState {
  url: string;
  blob: Blob;
  w: number;
  h: number;
  scale: number;
  ms: number;
  type: string;
}

interface SavedView {
  item: SavedUpscale;
  thumbUrl: string;
}

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export default function ImageUpscale() {
  const navigate = useNavigate();
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  const owner = me || 'guest';
  const [isStaff, setIsStaff] = useState(false);
  const [tier, setTier] = useState<TierId>('4k');
  const [detail, setDetail] = useState<Detail>('natural');
  const [denoise, setDenoise] = useState(false);
  const [format, setFormat] = useState<OutFormat>('image/png');
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [srcDims, setSrcDims] = useState({ w: 0, h: 0 });
  const [out, setOut] = useState<OutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [compare, setCompare] = useState(50);
  const [viewer, setViewer] = useState<'' | 'fit' | 'full'>('');
  const [saved, setSaved] = useState<SavedView[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } })();
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setIsStaff(!!d.isAdmin || !!d.isMod); })
      .catch(() => {});
  }, []);

  const refreshSaved = useCallback(() => {
    listSaved(owner)
      .then(items => setSaved(items.map(item => ({ item, thumbUrl: URL.createObjectURL(item.thumb) }))))
      .catch(() => setSaved([]));
  }, [owner]);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);
  useEffect(() => () => { saved.forEach(s => URL.revokeObjectURL(s.thumbUrl)); }, [saved]);
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);
  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);

  const accept = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { setError('That file is not an image.'); return; }
    if (f.size > 25 * 1024 * 1024) { setError('That image is over 25 MB. Try a smaller one.'); return; }
    setError('');
    setNotice('');
    setOut(null);
    setPct(0);
    setStage('');
    setCompare(50);
    setFile(f);
    setSrcDims({ w: 0, h: 0 });
    const url = URL.createObjectURL(f);
    setSrcUrl(url);
    const img = new Image();
    img.onload = () => setSrcDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setError('Your browser could not read that image format.');
    img.src = url;
  }, []);

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
    const paste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.kind === 'file' && i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (!f) return;
      e.preventDefault();
      accept(new File([f], f.name && f.name !== 'image.png' ? f.name : 'pasted-image.png', { type: f.type }));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [accept]);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  const activeTier = TIERS.find(t => t.id === tier) || TIERS[0];
  const locked = activeTier.staffOnly && !isStaff;
  const plan = srcDims.w ? fitSize(srcDims.w, srcDims.h, activeTier.width, activeTier.height) : null;
  const tooBig = !!plan && plan.scale <= 1;

  const run = async () => {
    if (!file || busy) return;
    if (locked) { setError('That quality is for staff only.'); return; }
    if (tooBig) { setError(`This image is already ${srcDims.w} x ${srcDims.h}. Pick a higher quality.`); return; }
    setBusy(true);
    setError('');
    setNotice('');
    setOut(null);
    setPct(0);
    setStage('Starting');
    const onProgress = (p: number, s: string) => { setPct(p); setStage(s); };
    const makeJob = async (): Promise<UpscaleJob> => ({
      bitmap: await createImageBitmap(file),
      boxW: activeTier.width,
      boxH: activeTier.height,
      detail,
      denoise,
      format
    });
    try {
      let result: UpscaleResult;
      try {
        if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') throw new Error('no worker');
        result = await runInWorker(await makeJob(), onProgress);
      } catch (e) {
        if (e instanceof JobError) throw e;
        result = await runUpscale(await makeJob(), domSurface, domEncode, onProgress);
      }
      const type = result.blob.type || format;
      setOut({ url: URL.createObjectURL(result.blob), blob: result.blob, w: result.w, h: result.h, scale: result.scale, ms: result.ms, type });
      setCompare(50);
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      try {
        await saveUpscale({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user: owner,
          name: `${base}-${tier}.${extFor(type)}`,
          tier,
          w: result.w,
          h: result.h,
          size: result.blob.size,
          type,
          at: Date.now(),
          blob: result.blob,
          thumb: result.thumb
        });
        setNotice('Saved to your upscales on this device.');
        refreshSaved();
      } catch {
        setNotice('Done. Your browser storage is full, so this one was not saved. Download it to keep it.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upscaling failed.');
      setPct(0);
      setStage('');
    }
    setBusy(false);
  };

  const download = () => {
    if (!out || !file) return;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    saveBlob(out.blob, `${base}-${tier}.${extFor(out.type)}`);
  };

  const reset = () => {
    setFile(null);
    setSrcUrl('');
    setOut(null);
    setSrcDims({ w: 0, h: 0 });
    setPct(0);
    setStage('');
    setError('');
    setNotice('');
  };

  const deleteSaved = async (id: string) => {
    try { await removeSaved(id); } catch {}
    refreshSaved();
  };

  const seg = (on: boolean) =>
    `flex-1 px-3 py-2.5 rounded-lg text-left transition-colors border ${on ? 'border-[var(--bp-accent)] bg-white/[0.07]' : 'border-white/10 bg-black/30 hover:border-white/25'}`;

  return (
    <div className="relative min-h-screen w-full bg-black overflow-x-hidden font-sans text-white">
      <AmbientBg />
      <SideRail />
      {dragging && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="absolute inset-5 rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--bp-accent)' }} />
          <p className="text-2xl font-semibold">Drop your image</p>
        </div>
      )}

      {viewer && out && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="h-14 px-5 flex items-center gap-2 border-b border-white/10 shrink-0">
            <p className="text-sm font-semibold">{out.w} x {out.h}</p>
            <p className="text-xs text-white/40">{viewer === 'full' ? 'actual pixels, scroll to pan' : 'fit to screen'}</p>
            <button onClick={() => setViewer(viewer === 'full' ? 'fit' : 'full')} className="ml-auto h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-sm">
              {viewer === 'full' ? 'Fit to screen' : 'Actual size'}
            </button>
            <button onClick={download} className="h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-sm">Download</button>
            <button onClick={() => setViewer('')} className="h-9 w-9 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center" aria-label="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className={`flex-1 overflow-auto ${viewer === 'fit' ? 'flex items-center justify-center p-4' : ''}`}>
            <img src={out.url} alt="" className={viewer === 'full' ? 'max-w-none' : 'max-w-full max-h-full object-contain'} />
          </div>
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
        {file && !busy && <button onClick={reset} className="ml-auto h-9 px-4 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm text-white/70 hover:text-white transition-colors">New image</button>}
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 sm:pl-24 sm:pr-8 py-10">
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
            <p className="text-sm text-white/40 mt-2">click to choose one, or paste with Ctrl+V. PNG, JPG, WebP or GIF, up to 25 MB.</p>
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
                <p className="text-[11px] uppercase tracking-widest text-white/35">{out ? 'Before / After' : 'Upscaled'}</p>
                <p className="ml-auto text-[11px] text-white/45 tabular-nums">
                  {out ? `${out.w} x ${out.h}` : plan && !tooBig ? `${plan.w} x ${plan.h} · ${plan.scale.toFixed(1)}x` : activeTier.note}
                </p>
              </div>
              <div className="relative aspect-video bg-black/40 flex items-center justify-center select-none overflow-hidden">
                {out ? (
                  <>
                    <img src={out.url} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                    <img src={srcUrl} alt="" className="absolute inset-0 w-full h-full object-contain" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} draggable={false} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.6)] pointer-events-none" style={{ left: `calc(${compare}% - 1px)` }}>
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
                      </div>
                    </div>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] uppercase tracking-wider text-white/70 pointer-events-none">Before</span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] uppercase tracking-wider text-white/70 pointer-events-none">After</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={compare}
                      onChange={e => setCompare(Number(e.target.value))}
                      aria-label="Compare before and after"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                    />
                  </>
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
                  <p className="text-sm text-white/25">{tooBig ? 'already above this quality' : 'nothing yet'}</p>
                )}
              </div>
              <div className="px-4 py-2.5 flex items-center gap-3 text-[11px] text-white/35">
                <span className="truncate">
                  {out ? `${extFor(out.type).toUpperCase()} · ${prettyBytes(out.blob.size)} · ${out.scale.toFixed(1)}x in ${(out.ms / 1000).toFixed(1)}s` : 'pick a quality and run it'}
                </span>
                {out && <button onClick={() => setViewer('fit')} className="ml-auto shrink-0 text-white/60 hover:text-white">View full size</button>}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-white/50 mb-2">Output quality</label>
                  <select
                    value={tier}
                    onChange={e => { setTier(e.target.value as TierId); setError(''); }}
                    disabled={busy}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60"
                  >
                    {TIERS.map(t => (
                      <option key={t.id} value={t.id} className="bg-[#12121a]">
                        {t.label} ({t.note}){t.staffOnly && !isStaff ? ' - staff only' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-2">File format</label>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value as OutFormat)}
                    disabled={busy}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60"
                  >
                    {FORMATS.map(f => <option key={f.id} value={f.id} className="bg-[#12121a]">{f.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2">Detail</label>
                <div className="flex gap-2">
                  {DETAILS.map(d => (
                    <button key={d.id} onClick={() => setDetail(d.id)} disabled={busy} className={seg(detail === d.id)}>
                      <span className="block text-[13px] font-medium">{d.label}</span>
                      <span className="block text-[11px] text-white/40">{d.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setDenoise(v => !v)}
                disabled={busy}
                className="flex items-center gap-3 text-left"
                role="switch"
                aria-checked={denoise}
              >
                <span className={`relative w-10 h-6 rounded-full transition-colors ${denoise ? 'bg-[var(--bp-accent)]' : 'bg-white/15'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${denoise ? 'left-5' : 'left-1'}`} />
                </span>
                <span>
                  <span className="block text-[13px] font-medium">Clean compression noise</span>
                  <span className="block text-[11px] text-white/40">smooths JPEG blocks and grain before upscaling, keeps edges</span>
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={run}
                  disabled={busy || locked || tooBig || !srcDims.w}
                  className="px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-35 transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, var(--bp-accent), var(--bp-accent-2))' }}
                >
                  {busy ? `Working ${pct}%` : out ? 'Upscale again' : 'Upscale'}
                </button>
                <button
                  onClick={download}
                  disabled={!out}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 disabled:opacity-30 transition-colors"
                >
                  Download
                </button>
                {notice && <p className="text-[12px] text-emerald-300/80">{notice}</p>}
              </div>
              {locked && <p className="text-[12px] text-amber-300/80">{activeTier.label} is for staff, mods and admins. 4K is available to everyone.</p>}
              {tooBig && !locked && <p className="text-[12px] text-amber-300/80">This image is already {srcDims.w} x {srcDims.h}, at or above {activeTier.label}.</p>}
              {error && <p className="text-[12px] text-red-300">{error}</p>}
            </div>
          </div>
        )}

        {saved.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline mb-3">
              <h2 className="text-sm font-semibold">Your upscales</h2>
              <p className="ml-3 text-[11px] text-white/35">saved on this device for {owner}, newest first</p>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {saved.map(({ item, thumbUrl }) => (
                <div key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
                  <div className="aspect-video bg-black/40 flex items-center justify-center">
                    <img src={thumbUrl} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[12px] truncate">{item.name}</p>
                    <p className="text-[10px] text-white/35 tabular-nums">{item.w} x {item.h} · {prettyBytes(item.size)}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveBlob(item.blob, item.name)} className="flex-1 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[11px]">Download</button>
                      <button onClick={() => deleteSaved(item.id)} className="px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-red-500/20 text-[11px] text-white/50 hover:text-red-200">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) accept(f); }} />
      </main>
    </div>
  );
}
