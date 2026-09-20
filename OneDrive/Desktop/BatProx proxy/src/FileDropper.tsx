import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface Drop {
  id: string;
  name: string;
  kind: 'file' | 'text';
  mime: string;
  size: number;
  ts: number;
}

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

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch(`/api/drops?user=${encodeURIComponent(me)}`, { cache: 'no-store' });
      const d = await r.json();
      setDrops(Array.isArray(d.drops) ? d.drops : []);
    } catch {}
  }, [me]);

  useEffect(() => { load(); }, [load]);

  const saveOne = async (name: string, kind: 'file' | 'text', mime: string, data: string, text: string) => {
    const r = await fetch('/api/drops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: me, name, kind, mime, data, text })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) throw new Error(d.error || 'save failed');
  };

  const handleFiles = async (files: File[]) => {
    if (!me) { setError('Sign in first so your drops can be saved to your account.'); return; }
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Saving ${i + 1} of ${files.length}: ${f.name}`);
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

  if (onDashboard) {
    const totalSize = drops.reduce((n, d) => n + (d.size || 0), 0);
    return (
      <div className="min-h-screen w-full text-white font-sans">
        <Backdrop />
        <Nav me={me} onHome={() => navigate('/dashboard')} />
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
                <div key={d.id} onClick={() => window.open(`/api/drops/file/${encodeURIComponent(d.id)}`, '_blank', 'noreferrer')} className="flex items-center gap-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] px-4 py-3 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/25 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {d.kind === 'text' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M6 3.75h12a1.5 1.5 0 011.5 1.5v13.5A1.5 1.5 0 0118 20.25H6a1.5 1.5 0 01-1.5-1.5V5.25A1.5 1.5 0 016 3.75z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      )}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-[11px] text-white/35">{d.kind} · {prettySize(d.size)} · {ago(d.ts)}</p>
                  </div>
                  <a href={`/api/drops/file/${encodeURIComponent(d.id)}`} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 shrink-0">open</a>
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
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(Array.from(e.dataTransfer?.files || [])); }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-3xl border-2 border-dashed cursor-pointer transition-all py-20 flex flex-col items-center justify-center text-center ${dragging ? 'border-purple-400 bg-purple-500/10 scale-[1.01]' : 'border-white/15 bg-white/[0.03] hover:border-white/30'}`}
        >
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-transform ${dragging ? 'scale-110' : ''}`} style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(167,139,250,0.35)' }}>
            <svg className="w-10 h-10 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>
          <p className="text-xl font-semibold">{busy ? 'Saving..' : 'drop your files here'}</p>
          <p className="text-xs text-white/40 mt-2">{busy ? progress : 'drag and drop, or click to browse'}</p>
          {busy && (
            <div className="mt-5 w-56 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 bg-purple-400 animate-[dropslide_1s_ease-in-out_infinite]" />
            </div>
          )}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
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
