import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';

interface Drop {
  id: string;
  name: string;
  kind: 'file' | 'text' | 'folder';
  mime: string;
  size: number;
  ts: number;
}

interface BundleFile { name: string; data: string; size: number; mime: string; }

const prettySize = (n: number) => {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
};

const ago = (ts: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Nav = ({ me, onHome }: { me: string; onHome: () => void }) => (
  <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-purple-600/25 border border-purple-500/40 flex items-center justify-center">
        <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-white leading-tight">Welcome {me || 'guest'}</p>
        <p className="text-[10px] text-white/35">file dropper</p>
      </div>
    </div>
    <button onClick={onHome} className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-sm font-medium transition-all">
      Go home
    </button>
  </nav>
);

const Backdrop = () => (
  <>
    <div className="fixed inset-0 bg-[#07060d]" />
    <div className="fixed inset-0 opacity-70" style={{ background: 'radial-gradient(900px circle at 50% 30%, rgba(124,58,237,0.18), transparent 60%)' }} />
  </>
);

async function getAllFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const direct = Array.from(dt.files || []);
  const items = Array.from(dt.items || []).filter(it => it.kind === 'file');
  if (!items.length || !items[0].webkitGetAsEntry) {
    return direct;
  }
  const entries = items.map((it: any) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
  const files: File[] = [];
  async function traverse(entry: any, path: string) {
    if (entry.isFile) {
      const f: File = await new Promise((res, rej) => entry.file((x: File) => res(x), rej));
      if (path) Object.defineProperty(f, 'webkitRelativePath' as any, { value: path + '/' + f.name });
      files.push(f as File & { webkitRelativePath: string });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries: any[] = await new Promise((res, rej) => {
        const acc: any[] = [];
        const read = () => reader.readEntries((batch: any[]) => {
          if (!batch.length) res(acc);
          else { acc.push(...batch); read(); }
        }, rej);
        read();
      });
      for (const e of allEntries) await traverse(e, path ? path + '/' + entry.name : entry.name);
    }
  }
  for (const e of entries) await traverse(e, '');
  if (!files.length) return direct;
  return files;
}

function buildAboutBlankHtml(drop: Drop, bundle: BundleFile[] | null, directUrl: string) {
  const title = drop.name.replace(/</g, '&lt;');
  const count = bundle ? bundle.length : 1;
  const rows = bundle ? bundle.map((f, i) => `
    <div class="row">
      <div class="icon">${f.name.endsWith('/')?'📁':'📄'}</div>
      <div class="meta">
        <div class="name">${f.name.replace(/</g,'&lt;')}</div>
        <div class="sub">${(f.size/1024).toFixed(1)} KB · ${f.mime||'file'}</div>
      </div>
      <button class="dl" data-i="${i}">download</button>
    </div>
  `).join('') : `
    <div class="preview-wrap">
      <p class="hint">${drop.mime.startsWith('image/')?`<img src="${directUrl}" style="max-width:100%;border-radius:12px;border:1px solid #ffffff18"/>` : drop.kind==='text' ? 'Text note, open to view raw.' : 'Click download to get your file.'}</p>
    </div>
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | BatProx</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#07060d;color:#fff;font-family:system-ui,sans-serif}
.top{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid #ffffff14;background:#0b0b14;position:sticky;top:0;z-index:2}
.back{padding:8px 14px;border-radius:999px;background:#ffffff10;border:1px solid #ffffff18;color:#fff;cursor:pointer}
.title{font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.count{font-size:12px;color:#ffffff66;background:#ffffff0d;border:1px solid #ffffff14;padding:6px 10px;border-radius:999px}
.btn{padding:10px 16px;border-radius:12px;background:#7c3aed;color:#fff;border:0;font-weight:700;cursor:pointer}
.btn:hover{background:#6d28e0}
.wrap{max-width:860px;margin:24px auto;padding:0 16px}
.card{background:#ffffff08;border:1px solid #ffffff12;border-radius:16px;padding:12px}
.row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#ffffff06;border:1px solid #ffffff0f;margin-bottom:8px}
.row:hover{border-color:#7c3aed55;background:#ffffff0b}
.icon{width:36px;height:36px;border-radius:10px;background:#7c3aed22;border:1px solid #7c3aed33;display:flex;align-items:center;justify-content:center;font-size:16px}
.meta{flex:1;min-width:0}
.name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:11px;color:#ffffff55}
.dl{padding:7px 12px;border-radius:10px;background:#ffffff10;border:1px solid #ffffff18;color:#fff;font-size:12px;cursor:pointer}
.dl:hover{background:#7c3aed33;border-color:#7c3aed44}
.preview-wrap{padding:18px;text-align:center;color:#aaa}
.hint{font-size:13px;color:#ffffff66}
</style></head><body>
<div class="top">
  <button class="back" onclick="history.length>1?history.back():window.close(); if(!window.closed) location.href='/'">&lt; Go back</button>
  <div class="title">${title}</div>
  <div class="count">${count} file${count!==1?'s':''}</div>
  <button class="btn" id="dlAll">Download files</button>
</div>
<div class="wrap"><div class="card" id="list">${rows}</div></div>
<script>
const dropId=${JSON.stringify(drop.id)};
const bundle=${JSON.stringify(bundle)};
const directUrl=${JSON.stringify(directUrl)};
const kind=${JSON.stringify(drop.kind)};
function downloadDataUrl(dataUrl, name){
  const a=document.createElement('a'); a.href=dataUrl; a.download=name||'download'; document.body.appendChild(a); a.click(); a.remove();
}
async function fetchFileData(id){
  const r=await fetch('/api/drops/file/'+encodeURIComponent(id));
  const ct=r.headers.get('content-type')||'';
  if(ct.includes('application/json')){
    const j=await r.json(); return j;
  }
  const blob=await r.blob();
  return URL.createObjectURL(blob);
}
document.getElementById('dlAll')?.addEventListener('click', async ()=>{
  if(bundle && bundle.length){
    for(const f of bundle){
      downloadDataUrl(f.data, f.name.split('/').pop()||f.name);
      await new Promise(r=>setTimeout(r,220));
    }
  } else {
    const r=await fetch(directUrl);
    if(!r.ok){ alert('Download failed'); return; }
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=${JSON.stringify(drop.name)}; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
});
document.querySelectorAll('.dl').forEach(b=>{
  b.addEventListener('click', ()=>{
    const i=parseInt(b.getAttribute('data-i')||'0',10);
    if(bundle && bundle[i]) downloadDataUrl(bundle[i].data, bundle[i].name.split('/').pop()||bundle[i].name);
  });
});
if(!bundle && kind!=='folder'){
  fetch(directUrl).then(r=>r.blob()).then(blob=>{
    if(blob.type.startsWith('image/')){
      const url=URL.createObjectURL(blob);
      const el=document.createElement('img');
      el.src=url; el.style.maxWidth='100%'; el.style.borderRadius='12px'; el.style.marginTop='12px';
      document.getElementById('list')?.appendChild(el);
    }
  }).catch(()=>{});
}
</script>
</body></html>`;
}

export default function FileDropper() {
  const navigate = useNavigate();
  const params = useParams();
  const me = localStorage.getItem('batprox-user') || '';
  const onDashboard = !!params.user;

  const [drops, setDrops] = useState<Drop[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch(`/api/drops?user=${encodeURIComponent(me)}`, { cache: 'no-store' });
      const d = await r.json();
      setDrops(Array.isArray(d.drops) ? d.drops : []);
    } catch {}
  }, [me]);

  useEffect(() => { load(); }, [load]);

  const filesRef = useRef<(files: File[]) => void>(() => {});
  const dragDepth = useRef(0);
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (!e.dataTransfer) return;
      const files = await getAllFilesFromDataTransfer(e.dataTransfer);
      filesRef.current(files);
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

  const saveOne = async (name: string, kind: 'file' | 'text' | 'folder', mime: string, data: string, text: string) => {
    const r = await fetch('/api/drops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: me, name, kind, mime, data, text })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) throw new Error(d.error || 'save failed');
    return d.drop as Drop;
  };

  const handleFiles = async (files: File[]) => {
    if (!me) { setError('Sign in first so your drops can be saved to your account.'); return; }
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const expanded: { name: string; files: BundleFile[] }[] = [];
      const singles: File[] = [];
      for (const f of files) {
        const isZip = f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';
        if (isZip) {
          setProgress(`Unzipping ${f.name}...`);
          try {
            const buf = await f.arrayBuffer();
            const zip = await JSZip.loadAsync(buf);
            const bundle: BundleFile[] = [];
            const entries = Object.values(zip.files) as any[];
            for (const entry of entries) {
              if (entry.dir) continue;
              const blob = await entry.async('base64');
              const ext = entry.name.split('.').pop()?.toLowerCase() || '';
              const mimeMap: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', pdf:'application/pdf', txt:'text/plain', json:'application/json', html:'text/html', js:'text/javascript', css:'text/css' };
              const mime = mimeMap[ext] || 'application/octet-stream';
              const dataUrl = `data:${mime};base64,${blob}`;
              bundle.push({ name: entry.name, data: dataUrl, size: blob.length, mime });
            }
            if (bundle.length) {
              const folderName = f.name.replace(/\.zip$/i, '') || 'unzipped';
              expanded.push({ name: folderName, files: bundle });
            } else {
              singles.push(f);
            }
          } catch {
            singles.push(f);
          }
        } else {
          singles.push(f);
        }
      }

      const folderGroups = new Map<string, File[]>();
      const remainingSingles: File[] = [];
      for (const f of singles) {
        const rel = (f as any).webkitRelativePath as string | undefined;
        if (rel && rel.includes('/')) {
          const root = rel.split('/')[0];
          if (!folderGroups.has(root)) folderGroups.set(root, []);
          folderGroups.get(root)!.push(f);
        } else {
          remainingSingles.push(f);
        }
      }

      let idx = 0;
      for (const [root, flist] of folderGroups) {
        setProgress(`Saving folder ${root} (${flist.length} files)...`);
        const bundle: BundleFile[] = [];
        for (const file of flist) {
          if (file.size > 3800000) { setError(`${file.name} too large (max 3.8 MB) skipped`); continue; }
          const rel = (file as any).webkitRelativePath || file.name;
          const data: string = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.onerror = () => rej(new Error('read failed'));
            fr.readAsDataURL(file);
          });
          bundle.push({ name: rel, data, size: file.size, mime: file.type || 'application/octet-stream' });
        }
        if (bundle.length) {
          const payload = JSON.stringify({ files: bundle, bundle: true });
          await saveOne(root, 'folder', 'application/x-batprox-folder', payload, '');
          idx++;
        }
      }

      for (const z of expanded) {
        setProgress(`Saving unzipped ${z.name} (${z.files.length} files)...`);
        const payload = JSON.stringify({ files: z.files, bundle: true });
        await saveOne(z.name, 'folder', 'application/x-batprox-folder', payload, '');
        idx++;
      }

      for (let i = 0; i < remainingSingles.length; i++) {
        const f = remainingSingles[i];
        setProgress(`Saving ${i + 1} of ${remainingSingles.length}: ${f.name}`);
        if (f.size > 3800000) { setError(`${f.name} is too large (max 3.8 MB)`); continue; }
        const data: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error('read failed'));
          fr.readAsDataURL(f);
        });
        await saveOne(f.name, 'file', f.type || 'application/octet-stream', data, '');
      }

      setProgress('Done');
      await load();
      navigate(`/file-dropper/${encodeURIComponent(me)}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    setBusy(false);
    setProgress('');
  };

  filesRef.current = handleFiles;

  const saveNote = async () => {
    const v = note.trim();
    if (!v || !me) return;
    setBusy(true);
    setError('');
    try {
      await saveOne(v.split('\n')[0].slice(0, 60) || 'note', 'text', 'text/plain', '', v);
      setNote('');
      await load();
      navigate(`/file-dropper/${encodeURIComponent(me)}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setDrops(prev => prev.filter(d => d.id !== id));
    try {
      await fetch('/api/drops/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me, id }) });
    } catch {}
  };

  const startRename = (d: Drop) => {
    setRenameId(d.id);
    setRenameVal(d.name);
  };

  const confirmRename = async () => {
    if (!renameId) return;
    const nn = renameVal.trim().slice(0, 120);
    if (!nn) { setRenameId(null); return; }
    const prev = drops.find(x => x.id === renameId)?.name;
    setDrops(prevList => prevList.map(x => x.id === renameId ? { ...x, name: nn } : x));
    setRenameId(null);
    try {
      const r = await fetch('/api/drops/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me, id: renameId, name: nn }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || 'rename failed');
    } catch {
      if (prev) setDrops(pl => pl.map(x => x.id === renameId ? { ...x, name: prev } : x));
      setError('Rename failed');
    }
  };

  const openViewer = async (d: Drop) => {
    const direct = `/api/drops/file/${encodeURIComponent(d.id)}`;
    if (d.kind === 'folder') {
      try {
        const r = await fetch(direct);
        const j = await r.json();
        const bundle: BundleFile[] | null = j && Array.isArray(j.files) ? j.files : null;
        const w = window.open('about:blank', '_blank');
        if (!w) { window.open(direct, '_blank'); return; }
        w.document.open();
        w.document.write(buildAboutBlankHtml(d, bundle, direct));
        w.document.close();
        return;
      } catch {
        window.open(direct, '_blank');
        return;
      }
    }
    const w = window.open('about:blank', '_blank');
    if (!w) { window.open(direct, '_blank'); return; }
    let bundle: BundleFile[] | null = null;
    if (d.name.toLowerCase().endsWith('.zip') || d.mime.includes('zip')) {
      try {
        const r = await fetch(direct);
        const blob = await r.blob();
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const files: BundleFile[] = [];
        for (const e of Object.values(zip.files) as any[]) {
          if (e.dir) continue;
          const b64 = await e.async('base64');
          files.push({ name: e.name, data: `data:application/octet-stream;base64,${b64}`, size: b64.length, mime: 'application/octet-stream' });
        }
        if (files.length) bundle = files;
      } catch {}
    }
    w.document.open();
    w.document.write(buildAboutBlankHtml(d, bundle, direct));
    w.document.close();
  };

  const dragOverlay = dragging ? (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-purple-400/70" />
      <div className="relative flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(167,139,250,0.5)' }}>
          <svg className="w-10 h-10 text-purple-200" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        <p className="text-2xl font-semibold text-white">Drop to upload</p>
        <p className="text-sm text-white/50 mt-1.5">files, zips and folders all work</p>
      </div>
    </div>
  ) : null;

  if (onDashboard) {
    const totalSize = drops.reduce((n, d) => n + (d.size || 0), 0);
    return (
      <div className="min-h-screen w-full text-white font-sans">
        <Backdrop />
        <Nav me={me} onHome={() => navigate('/dashboard')} />
        {dragOverlay}
        <main className="relative z-10 max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Your drops</h1>
              <p className="text-xs text-white/40 mt-1">Saved to your account, available wherever you sign in.</p>
            </div>
            <button onClick={() => navigate('/file-dropper')} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-all">+ Drop more</button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-7">
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Items</p>
              <p className="text-2xl font-bold mt-1">{drops.length}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Stored</p>
              <p className="text-2xl font-bold mt-1">{prettySize(totalSize)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Latest</p>
              <p className="text-2xl font-bold mt-1">{drops.length ? ago(drops[0].ts) : 'nothing yet'}</p>
            </div>
          </div>

          {drops.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-16 text-center">
              <p className="text-white/50 text-sm">Nothing saved yet.</p>
              <button onClick={() => navigate('/file-dropper')} className="mt-4 px-5 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-sm">Drop your first file</button>
            </div>
          ) : (
            <div className="space-y-2">
              {drops.map(d => (
                <div
                  key={d.id}
                  onClick={() => { if (renameId !== d.id) openViewer(d); }}
                  onContextMenu={e => { e.preventDefault(); const found = drops.find(x => x.id === d.id); if (found) startRename(found); }}
                  className="flex items-center gap-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] px-4 py-3 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/25 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {d.kind === 'text' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M6 3.75h12a1.5 1.5 0 011.5 1.5v13.5A1.5 1.5 0 0118 20.25H6a1.5 1.5 0 01-1.5-1.5V5.25A1.5 1.5 0 016 3.75z" />
                      ) : d.kind === 'folder' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75h3.75l1.5 1.5h6.75a2.25 2.25 0 012.25 2.25v4.5a1.5 1.5 0 01-1.5 1.5H5.25A1.5 1.5 0 013.75 18V9.75z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      )}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    {renameId === d.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameId(null); }}
                        onBlur={confirmRename}
                        className="w-full px-2 py-1 rounded-lg bg-black/50 border border-purple-500/50 text-white text-sm outline-none"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">{d.name}</p>
                    )}
                    <p className="text-[11px] text-white/35">{d.kind} · {prettySize(d.size)} · {ago(d.ts)}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); startRename(d); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-purple-600/30 hover:text-purple-200 border border-white/10 hover:border-purple-500/30 shrink-0">rename</button>
                  <button onClick={e => { e.stopPropagation(); openViewer(d); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 shrink-0">open</button>
                  <button onClick={e => { e.stopPropagation(); remove(d.id); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/30 text-red-300 border border-red-500/25 shrink-0">delete</button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-white font-sans">
      <Backdrop />
      <Nav me={me} onHome={() => navigate('/dashboard')} />
      {dragOverlay}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <div
          onClick={() => fileRef.current?.click()}
          className={`rounded-3xl border-2 border-dashed cursor-pointer transition-all py-20 flex flex-col items-center justify-center text-center ${dragging ? 'border-purple-400 bg-purple-500/10 scale-[1.01]' : 'border-white/15 bg-white/[0.03] hover:border-white/30'}`}
        >
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-transform ${dragging ? 'scale-110' : ''}`} style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(167,139,250,0.35)' }}>
            <svg className="w-10 h-10 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>
          <p className="text-xl font-semibold">{busy ? 'Saving..' : 'drop your files here'}</p>
          <p className="text-xs text-white/40 mt-2">{busy ? progress : 'drop anywhere on this page. files, zips and folders all work'}</p>
          {busy && (
            <div className="mt-5 w-56 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 bg-purple-400 animate-[dropslide_1s_ease-in-out_infinite]" />
            </div>
          )}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
          <input ref={folderRef} type="file" multiple {...({ webkitdirectory: '' } as any)} className="hidden" onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => folderRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm">Choose folder</button>
          <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm">Choose files / zip</button>
        </div>

        <div className="mt-5 rounded-2xl bg-white/[0.03] border border-white/10 p-4">
          <p className="text-xs text-white/45 mb-2">or drop some text</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="paste notes, links, anything.."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm resize-y focus:outline-none focus:border-purple-500/60"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[11px] text-white/25">{note.trim().length} characters</span>
            <button onClick={saveNote} disabled={!note.trim() || busy} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-semibold transition-all">Save text</button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {drops.length > 0 && (
          <button onClick={() => navigate(`/file-dropper/${encodeURIComponent(me)}/dashboard`)} className="mt-6 w-full py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-sm font-medium transition-all">
            View your {drops.length} saved {drops.length === 1 ? 'drop' : 'drops'}
          </button>
        )}
      </main>
    </div>
  );
}
