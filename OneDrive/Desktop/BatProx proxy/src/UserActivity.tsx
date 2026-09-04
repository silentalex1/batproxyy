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

  const load = useCallback(async () => {
    try {
      const [pr, ur] = await Promise.all([fetch('/api/presence'), fetch('/api/users')]);
      const pd = pr.ok ? await pr.json() : { users: [] };
      const ud = ur.ok ? await ur.json() : { users: [] };
      const seen: Record<string, PresenceUser> = {};
      for (const u of ((pd.users || []) as PresenceUser[])) {
        if (u.username && u.username !== 'anonymous') seen[u.username] = u;
      }
      const merged: PresenceUser[] = ((ud.users || []) as Array<{ username: string }>).filter(u => u.username && u.username !== 'anonymous').map(u => (
        seen[u.username] || { username: u.username, active: false, game: '', lastSeen: 0 }
      ));
      for (const k of Object.keys(seen)) {
        if (!merged.find(m => m.username === k)) merged.push(seen[k]);
      }
      setUsers(merged.sort((a, b) => Number(b.active) - Number(a.active) || a.username.localeCompare(b.username)));
    } catch {}
    try {
      const r = await fetch('/api/gamestats');
      if (r.ok) {
        const d = await r.json();
        setStats(d.stats || {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    startPresence();
    load();
    const id = setInterval(load, 15000);
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
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);

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

  const fmtSession = (u: PresenceUser) => {
    if (!u.active) return fmtHours(hoursOf(u.username));
    const start = u.sessionStart || u.lastSeen || Date.now();
    const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
    if (mins < 1) return '0m';
    if (mins < 60) return `${mins}m`;
    return `${(mins / 60).toFixed(1)}h`;
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
          <p className="text-white/40 text-sm mt-2 mb-8">{activeCount} active now - {users.length} seen recently</p>
          <div className="w-full bg-black/55 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-2xl shadow-2xl">
            {users.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No users seen yet. Stay on the tab to appear here.</p>
            ) : (
              <div className="space-y-2.5">
                {users.map(u => (
                  <div key={u.username} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${u.active ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'bg-white/20'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-semibold truncate">{u.username}{u.username === me ? ' (you)' : ''}</p>
                      <p className="text-[11px] text-white/40 truncate">{u.active ? (u.game ? `Playing ${u.game}` : 'Active on site') : (u.lastSeen ? `last on ${fmtAgo(u.lastSeen)}` : 'Inactive')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-purple-300 font-semibold">{fmtSession(u)}</p>
                      <p className="text-[10px] text-white/30 truncate max-w-[120px]">{topGameOf(u.username)}</p>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${u.active ? 'bg-green-500/15 text-green-300 border border-green-500/25' : 'bg-white/5 text-white/35 border border-white/10'}`}>{u.active ? 'ACTIVE' : 'IDLE'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-white/25 text-[11px] mt-4">Leaving the tab counts as inactive. Game hours update while you play.</p>
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
