import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Settings from './Settings';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';

interface Feedback {
  id: number;
  title?: string;
  content: string;
  user_identifier: string;
  genre: string;
  status: string;
  submitted_at: string;
}

interface FbComment {
  id: number;
  feedbackId: number;
  user: string;
  text: string;
  created_at: string;
}

export default function StaffPanel() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [comments, setComments] = useState<Record<number, FbComment[]>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });

  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } })();
    if (!token) { setAllowed(false); return; }
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => {
      setAllowed(!!(d.isAdmin || d.isMod || d.rank === 'moderator'));
    }).catch(() => setAllowed(false));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/feedbacks');
      if (r.ok) {
        const d = await r.json();
        setFeedbacks(d.feedbacks || []);
      }
    } catch {}
    try {
      const r = await fetch('/api/feedback-comments');
      if (r.ok) {
        const d = await r.json();
        const grouped: Record<number, FbComment[]> = {};
        for (const c of (d.comments || [])) {
          if (!grouped[c.feedbackId]) grouped[c.feedbackId] = [];
          grouped[c.feedbackId].push(c);
        }
        setComments(grouped);
      }
    } catch {}
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const postComment = async (fid: number) => {
    const text = (drafts[fid] || '').trim();
    if (!text || !me) return;
    try {
      const r = await fetch('/api/feedback-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedbackId: fid, user: me, text }) });
      if (r.ok) { setDrafts(p => ({ ...p, [fid]: '' })); load(); }
    } catch {}
  };

  if (allowed === false) {
    return (
      <div className="relative min-h-screen w-full bg-black flex items-center justify-center font-sans text-white px-4">
        <AmbientBg />
        <div className="relative z-10 text-center">
          <p className="text-lg font-semibold mb-4">Staff only.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">Back home</button>
        </div>
      </div>
    );
  }
  if (allowed === null) {
    return (
      <div className="relative min-h-screen w-full bg-black flex items-center justify-center font-sans text-white">
        <AmbientBg />
        <div className="relative z-10 w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col min-h-screen px-4 sm:pl-20 sm:pr-6 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">MODERATOR</span>
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex flex-col items-center w-full max-w-2xl mx-auto pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-blue-300">Staff Panel</h1>
          <p className="text-white/40 text-sm mt-2 mb-8">Suggestion reviews — view and comment.</p>
          <div className="w-full space-y-4">
            {feedbacks.length === 0 && <p className="text-gray-500 text-sm text-center py-10">No suggestions yet.</p>}
            {feedbacks.map(f => (
              <div key={f.id} className="bg-black/55 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm text-white font-semibold truncate">{f.title || `Suggestion #${f.id}`}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${f.status === 'approved' ? 'bg-green-500/15 text-green-300 border border-green-500/25' : f.status === 'declined' ? 'bg-red-500/15 text-red-300 border border-red-500/25' : 'bg-white/5 text-white/50 border border-white/10'}`}>{(f.status || 'pending').toUpperCase()}</span>
                </div>
                <p className="text-xs text-white/40 mb-1">by {f.user_identifier} - {f.genre}</p>
                <p className="text-sm text-white/70 leading-relaxed mb-4 whitespace-pre-wrap">{f.content}</p>
                <div className="space-y-2 mb-3">
                  {(comments[f.id] || []).map(c => (
                    <div key={c.id} className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      <p className="text-[11px] text-blue-300 font-semibold">{c.user}</p>
                      <p className="text-xs text-white/70 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={drafts[f.id] || ''} onChange={e => setDrafts(p => ({ ...p, [f.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') postComment(f.id); }} placeholder="Add a staff comment..." className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60 text-sm" />
                  <button onClick={() => postComment(f.id)} className="px-5 py-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/45 text-blue-200 border border-blue-500/30 text-sm font-semibold">Send</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
