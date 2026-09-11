import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Settings from './Settings';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';
import { startPresence } from './presence';

interface PresenceUser {
  username: string;
  active: boolean;
  game: string;
  lastSeen: number;
  sessionStart?: number;
  total?: number;
  live?: number;
}

export default function UserActivity() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionGenre, setSuggestionGenre] = useState('Feedback suggestions');
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  const [dmAsk, setDmAsk] = useState<string | null>(null);
  const [dmSent, setDmSent] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { display: string; bio: string; pfp: string }>>({});
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pr, ur, gr, fr] = await Promise.all([
        fetch('/api/presence', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/gamestats', { cache: 'no-store' }),
        fetch('/api/chat/profiles', { cache: 'no-store' })
      ]);
      const pd = pr.ok ? await pr.json() : { users: [] };
      const ud = ur.ok ? await ur.json() : { users: [] };
      if (gr.ok) { const gd = await gr.json(); setStats(gd.stats || {}); }
      if (fr.ok) { const fd = await fr.json(); setProfiles(fd.profiles || {}); }
      const seen: Record<string, PresenceUser> = {};
      for (const u of ((pd.users || []) as PresenceUser[])) {
        if (u.username && u.username !== 'anonymous') seen[u.username] = u;
      }
      const registered = new Set<string>();
      const merged: PresenceUser[] = ((ud.users || []) as Array<{ username: string }>).filter(u => u.username && u.username !== 'anonymous').map(u => {
        registered.add(u.username);
        return seen[u.username] || { username: u.username, active: false, game: '', lastSeen: 0, total: 0, live: 0 };
      });
      for (const k of Object.keys(seen)) {
        if (!merged.find(m => m.username === k)) merged.push(seen[k]);
      }
      const score = (u: PresenceUser) => (u.total || 0) + (u.active ? (u.live || 0) : 0);
      setUsers(merged.sort((a, b) => {
        if (a.active !== b.active) return Number(b.active) - Number(a.active);
        const d = score(b) - score(a);
        if (d) return d;
        const l = (b.lastSeen || 0) - (a.lastSeen || 0);
        if (l) return l;
        return a.username.localeCompare(b.username);
      }));
    } catch {}
  }, []);

  const askDm = async (username: string) => {
    if (!me || username === me) return;
    setDmAsk(null);
    try {
      const r = await fetch('/api/chat/dm-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: me, to: username }) });
      if (r.ok) setDmSent(true);
    } catch {}
  };

  useEffect(() => {
    startPresence();
    load();
    const id = setInterval(load, 5000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const hoursOf = (u: string) => {
    const m = stats[u];
    if (!m) return 0;
    return Object.values(m).reduce((a, b) => a + b, 0) / 3600;
  };

  const topGameOf = (u: string) => {
    const m = stats[u];
    if (!m) return '';
    const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] : '';
  };

  const fmtHours = (h: number) => h < 0.1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`;

  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const fmtAgo = (ts: number) => {
    if (!ts) return '—';
    const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const fmtDur = (secs: number) => {
    const s = Math.max(0, Math.round(secs));
    if (s < 60) return s < 1 ? '0m' : `${s}s`;
    const mins = Math.floor(s / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = mins / 60;
    return hrs < 10 ? `${hrs.toFixed(1)}h` : `${Math.floor(hrs)}h`;
  };

  const fmtSession = (u: PresenceUser) => {
    const base = u.total || 0;
    if (u.active) return fmtDur(base + (u.live || 0));
    if (base > 0) return fmtDur(base);
    return fmtHours(hoursOf(u.username));
  };

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    try {
      const r = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: suggestionTitle, content: suggestionText, userIdentifier: me, genre: suggestionGenre }) });
      if (r.ok) { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); }
    } catch {}
  };

  const activeCount = users.filter(u => u.active).length;
  const seenCount = users.filter(u => (u.lastSeen || 0) > 0).length;
  const dispOf = (u: string) => profiles[u]?.display || u;
  const avatarColor = (name: string) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h}, 65%, 45%)`;
  };
  const rankStyle = (i: number) => {
    if (i === 0) return 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40';
    if (i === 1) return 'bg-slate-300/15 text-slate-200 border-slate-300/35';
    if (i === 2) return 'bg-orange-500/15 text-orange-300 border-orange-500/35';
    return 'bg-white/[0.04] text-white/35 border-white/10';
  };
  const visible = users.filter(u => {
    if (activeOnly && !u.active) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || dispOf(u.username).toLowerCase().includes(q);
  });

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col min-h-screen px-4 sm:pl-20 sm:pr-6 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSuggest(true)}>Suggestions</NavBtn>
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex flex-col items-center w-full max-w-2xl mx-auto pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--bp-accent)' }}>User Leaderboards</h1>
          <p className="text-white/40 text-sm mt-2 mb-6"><span className="text-green-300 font-semibold">{activeCount}</span> active now · {seenCount} seen recently · {users.length} total</p>
          <div className="w-full flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <svg className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search users..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
            </div>
            <button onClick={() => setActiveOnly(v => !v)} className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${activeOnly ? 'bg-green-500/15 text-green-300 border-green-500/35' : 'bg-white/[0.04] text-white/45 border-white/10 hover:text-white/80'}`}>active only</button>
          </div>
          <div className="w-full bg-black/55 border border-white/10 rounded-3xl p-3 sm:p-4 backdrop-blur-2xl shadow-2xl">
            {visible.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">{users.length === 0 ? 'No users seen yet. Stay on the tab to appear here.' : 'Nobody matches that.'}</p>
            ) : (
              <div className="space-y-1.5">
                {visible.map((u, i) => {
                  const never = !u.lastSeen;
                  const pfp = profiles[u.username]?.pfp || '';
                  return (
                    <button key={u.username} onClick={() => { if (u.username !== me) { setDmAsk(u.username); setDmSent(false); } }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border text-left transition-all duration-200 ${u.active ? 'bg-green-500/[0.06] border-green-500/20 hover:border-green-400/40' : 'bg-white/[0.03] border-white/[0.07] hover:border-white/20'}`}>
                      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-bold shrink-0 ${rankStyle(i)}`}>{i + 1}</span>
                      <span className="relative shrink-0">
                        {pfp
                          ? <img src={pfp} alt="" className="w-10 h-10 rounded-full object-cover" />
                          : <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: avatarColor(u.username) }}>{dispOf(u.username).charAt(0).toUpperCase()}</span>}
                        {u.active && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-black shadow-[0_0_8px_rgba(74,222,128,0.9)]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-semibold truncate">{dispOf(u.username)}{u.username === me ? ' (you)' : ''}</p>
                        <p className="text-[11px] text-white/40 truncate">{u.active ? (u.game ? `Playing ${u.game}` : 'Active on site') : never ? 'never seen on site' : `last on ${fmtAgo(u.lastSeen)}`}</p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className={`text-xs font-semibold ${never ? 'text-white/20' : 'text-purple-300'}`}>{never ? '—' : fmtSession(u)}</p>
                        {topGameOf(u.username) && <p className="text-[10px] text-white/30 truncate max-w-[120px]">{topGameOf(u.username)}</p>}
                      </div>
                      <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full shrink-0 ${u.active ? 'bg-green-500/15 text-green-300 border border-green-500/25' : never ? 'bg-white/[0.03] text-white/25 border border-white/[0.07]' : 'bg-white/5 text-white/35 border border-white/10'}`}>{u.active ? 'ACTIVE' : never ? 'NEW' : 'IDLE'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-white/25 text-[11px] mt-4">Ranked by time on site. Leaving the tab counts as inactive. Game hours update while you play.</p>
      {dmAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-xs text-center shadow-2xl">
            {dmSent ? (
              <p className="text-sm text-white">{dmAsk} will be notified. If they accept, your DM starts in chat.</p>
            ) : (
              <>
                <p className="text-sm text-white mb-5">would you like to start dms with {dmAsk}?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDmAsk(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">no</button>
                  <button onClick={() => askDm(dmAsk)} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">yes</button>
                </div>
              </>
            )}
            {dmSent && <button onClick={() => setDmAsk(null)} className="mt-4 px-6 py-2 rounded-xl bg-white/10 text-white text-sm">Okay</button>}
          </div>
        </div>
      )}
        </div>
      </main>
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <form onSubmit={submitSuggestion}>
              <select value={suggestionGenre} onChange={e => setSuggestionGenre(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 mb-3 cursor-pointer">
                <option value="Feedback suggestions">Feedback suggestions</option>
                <option value="Website bug">Website bug</option>
              </select>
              <input value={suggestionTitle} onChange={e => setSuggestionTitle(e.target.value)} placeholder="Enter suggestion title:" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-sm mb-3" />
              <textarea value={suggestionText} onChange={e => setSuggestionText(e.target.value)} placeholder="Enter your suggestion..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4 min-h-[120px] resize-none" />
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); }} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-sm">Submit your suggestion</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
