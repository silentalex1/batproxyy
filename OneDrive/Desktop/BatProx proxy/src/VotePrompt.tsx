import { useEffect, useState } from 'react';

interface Vote {
  id: string;
  title: string;
  options: string[];
  images: string[];
  closed: boolean;
  counts: number[];
  total: number;
  mine: number | null;
}

const DISMISSED = 'bp-votes-dismissed';

const readDismissed = (): string[] => {
  try { const a = JSON.parse(localStorage.getItem(DISMISSED) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

export default function VotePrompt() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justVoted, setJustVoted] = useState('');
  const user = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();

  const load = async () => {
    try {
      const r = await fetch('/api/votes?user=' + encodeURIComponent(user), { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setVotes(Array.isArray(d.votes) ? d.votes : []);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const active = votes.find(v => v.id === justVoted) || votes.find(v => !v.closed && v.mine === null && !dismissed.includes(v.id));
  if (!user || !active) return null;

  const dismiss = () => {
    const next = [...dismissed, active.id].slice(-80);
    setDismissed(next);
    setJustVoted('');
    try { localStorage.setItem(DISMISSED, JSON.stringify(next)); } catch {}
  };

  const cast = async (choice: number) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem('batprox-token') || '';
      const r = await fetch('/api/votes/cast', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id: active.id, choice }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not save your vote.'); setBusy(false); return; }
      setJustVoted(active.id);
      setVotes(prev => prev.map(v => {
        if (v.id !== active.id) return v;
        const counts = [...v.counts];
        if (v.mine !== null) counts[v.mine] = Math.max(0, counts[v.mine] - 1);
        counts[choice] += 1;
        return { ...v, counts, total: counts[0] + counts[1], mine: choice };
      }));
      setTimeout(load, 800);
    } catch { setError('Network error, try again.'); }
    setBusy(false);
  };

  const voted = active.mine !== null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/10 bg-[#0c0c12]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden" style={{ animation: 'bpVoteIn .35s ease-out' }}>
      <style>{'@keyframes bpVoteIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200">{voted ? 'results' : 'new vote'}</span>
        <button onClick={dismiss} className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <p className="px-4 pt-2 text-[14px] font-semibold text-white leading-snug break-words">{active.title}</p>
      <div className={`p-4 grid gap-2.5 ${active.images.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {active.options.map((o, i) => {
          const img = active.images.find(u => u.endsWith('/' + i));
          const pct = active.total ? Math.round((active.counts[i] / active.total) * 100) : 0;
          const mine = active.mine === i;
          return (
            <button
              key={i}
              disabled={busy}
              onClick={() => cast(i)}
              className={`relative text-left rounded-xl overflow-hidden border transition-all ${mine ? 'border-purple-400/60 bg-purple-500/10' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'}`}
            >
              {active.images.length > 0 && (
                img ? <img src={img} alt="" className="w-full aspect-[4/3] object-cover" /> : <div className="w-full aspect-[4/3] bg-white/[0.03]" />
              )}
              <div className="relative px-3 py-2.5">
                {voted && <div className="absolute inset-y-0 left-0 bg-purple-500/15" style={{ width: pct + '%' }} />}
                <div className="relative flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[12px] text-white/90 break-words">{o}</span>
                  {voted && <span className="shrink-0 text-[12px] font-semibold text-white">{pct}%</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-4 pb-3.5 -mt-1 flex items-center text-[11px] text-white/35">
        {error ? <span className="text-red-300">{error}</span> : voted ? <span>You voted. Tap the other option to change it.</span> : <span>Tap an option to vote.</span>}
        <span className="ml-auto">{active.total} vote{active.total === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}
