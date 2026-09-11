import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BatMascot from './BatMascot';

export default function LoginStatus() {
  const navigate = useNavigate();
  const [up, setUp] = useState<boolean | null>(null);
  const [_history, setHistory] = useState<boolean[]>([]);
  const [lastChange, setLastChange] = useState<number>(Date.now());
  const [othersOnline, setOthersOnline] = useState(0);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState('');
  const [lastReason, setLastReason] = useState('');
  const [voted, setVoted] = useState<string>(() => { try { return localStorage.getItem('batprox-login-vote') || ''; } catch { return ''; } });
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || 'guest'; } catch { return 'guest'; } });
  const [reportUser, setReportUser] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWithTimeout = async (input: string, init: RequestInit, ms = 8000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  const probe = useCallback(async (): Promise<{ up: boolean; others: number; reason: string }> => {
    let others = 0;
    try {
      const r = await fetch('/api/presence');
      if (r.ok) {
        const d = await r.json();
        others = (d.users || []).filter((u: any) => u.active).length;
      }
    } catch {}
    const API_BASES = ['', 'https://api.stealthybat.org', 'https://batproxyy.asdwwas233.workers.dev', 'https://authlogin.stealthlybat.it.com'];
    const BLOCKED = 'Your wifi or filter is sending back a web page instead of the login server. The login itself is fine - try a phone hotspot or a different network.';
    const readJson = async (r: Response) => {
      let txt = '';
      try { txt = await r.text(); } catch { return null; }
      if (!txt || !/^\s*[\{\[]/.test(txt)) return null;
      try { return JSON.parse(txt); } catch { return null; }
    };
    const unwrapAuth = (data: any) => {
      let cur = data;
      for (let i = 0; i < 6; i++) {
        if (!cur || typeof cur !== 'object') return cur;
        const hasToken = typeof cur.token === 'string' && cur.token.length > 0 && cur.user && typeof cur.user.username === 'string';
        const hasErr = typeof cur.success === 'boolean' || typeof cur.error === 'string';
        if (hasToken || hasErr) return cur;
        if (Object.prototype.hasOwnProperty.call(cur, 'data')) { cur = cur.data; continue; }
        return cur;
      }
      return cur;
    };
    let lastErr = '';
    let loginUp = false;
    for (const base of API_BASES) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetchWithTimeout(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '__probe__', inviteCode: '__probe__' }) }, 8000);
          if (r.status === 404 || r.status >= 500) {
            lastErr = `Server error (${r.status}). Please try again.`;
            continue;
          }
          const data = await readJson(r);
          if (!data) {
            lastErr = BLOCKED;
            continue;
          }
          const payload = unwrapAuth(data);
          if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
            lastErr = 'The login server answered with an empty body. Please try again.';
            continue;
          }
          const hasSuccess = typeof payload.success === 'boolean';
          const hasError = typeof payload.error === 'string';
          const hasToken = typeof payload.token === 'string' && payload.token.length > 0;
          const hasUser = payload.user && typeof payload.user.username === 'string';
          if (!hasSuccess && !hasError && !hasToken && !hasUser) {
            lastErr = 'The login server answered without the expected account data. Please try again.';
            continue;
          }
          if (!r.ok || payload.success === false) {
            if (hasError || hasSuccess) {
              loginUp = true;
              break;
            }
            lastErr = 'The login server answered without the expected account data. Please try again.';
            continue;
          }
          if (!hasToken || !hasUser) {
            lastErr = 'The login server answered without the expected account data. Please try again.';
            continue;
          }
          loginUp = true;
          break;
        } catch {
          lastErr = 'Server error (404). Please try again.';
        }
      }
      if (loginUp) break;
    }
    if (!loginUp) return { up: false, others, reason: lastErr || 'Server error (404). Please try again.' };
    try {
      const r = await fetchWithTimeout('https://api.stealthybat.org/health', { cache: 'no-store' } as any, 6000);
      if (!r.ok) return { up: false, others, reason: `Server error (${r.status}). Please try again.` };
    } catch {
      return { up: false, others, reason: 'Server error (404). Please try again.' };
    }
    return { up: true, others, reason: '' };
  }, []);

  const refresh = useCallback(async () => {
    const res = await probe();
    setOthersOnline(res.others);
    setLastReason(res.reason);
    setUp(prev => {
      if (prev !== null && prev !== res.up) setLastChange(Date.now());
      return res.up;
    });
    setHistory(prev => [...prev.slice(-19), res.up]);
  }, [probe]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 15000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh]);

  const who = () => (reportUser.trim() || me || 'guest');

  const castVote = async (working: boolean) => {
    const v = working ? 'yes' : 'no';
    setVoted(v);
    try { localStorage.setItem('batprox-login-vote', v); } catch {}
    try { await fetch('/api/login-vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: who(), working }) }); } catch {}
  };

  const submitReport = async () => {
    const t = reportText.trim();
    if (!t) return;
    try { await fetch('/api/login-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: who(), error: t }) }); setReportSent(true); setReportText(''); } catch {}
  };

  const requestReset = async () => {
    try { await fetch('/api/pw-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: who() }) }); } catch {}
    setResetSent(true);
  };

  const checkJustMe = async () => {
    setChecking(true);
    setVerdict('');
    const res = await probe();
    setOthersOnline(res.others);
    setLastReason(res.reason);
    setUp(res.up);
    setHistory(prev => [...prev.slice(-19), res.up]);
    if (!res.up) {
      setVerdict(res.reason ? `${res.reason} Login is currently DOWN — not working for anyone right now. Please report the login error for me.` : 'Login is currently DOWN — not working for anyone right now. Please report the login error for me.');
    } else {
      setVerdict("it's up and working for you.");
    }
    setChecking(false);
  };

  const ago = Math.max(0, Math.floor((Date.now() - lastChange) / 60000));
  const agoLabel = ago < 1 ? 'just now' : ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ago`;

  return (
    <div className="relative min-h-screen w-full bg-black overflow-y-auto font-sans text-white flex flex-col items-center px-4 py-10">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-purple-600/25 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_70%,#000_100%)]" />
      </div>
      <button onClick={() => navigate('/')} title="Back to login" className="relative z-10 w-24 h-24 rounded-[28px] bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-600/40 mb-5 hover:scale-105 transition-transform">
        <BatMascot size={86} />
      </button>
      <h1 className="relative z-10 text-4xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--bp-accent)' }}>Login Status</h1>
      <p className="relative z-10 text-white/50 text-sm mb-7">currently working.</p>
      <div className="relative z-10 w-full max-w-3xl bg-black/55 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl mb-5">
        <div className="flex items-center gap-3 mb-5">
          <span className={`w-3.5 h-3.5 rounded-full ${up === null ? 'bg-white/20' : up ? 'bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]' : 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]'}`} />
          <p className="text-lg font-bold">{up === null ? 'Checking...' : up ? 'UP — login is working' : 'DOWN — login is not working'}</p>
          <span className="ml-auto text-[11px] text-white/35">updated {agoLabel} - auto refresh 15s</span>
        </div>
        <div className="w-full h-6 rounded-full bg-white/5 overflow-hidden mb-2 border border-white/5">
          <div className={`h-full transition-all duration-500 ${up === null ? 'bg-white/20' : up ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: '100%' }} />
        </div>
        {lastReason && up === false && <p className="text-[11px] text-red-300/80 mb-2">{lastReason}</p>}
        <p className="text-[11px] text-white/35">{othersOnline} user{othersOnline === 1 ? '' : 's'} online right now</p>
      </div>
      <div className="relative z-10 w-full max-w-3xl grid sm:grid-cols-2 gap-5">
        <div className="bg-black/55 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
          <h2 className="text-sm font-bold text-white mb-4">What to do:</h2>
          <p className="text-xs text-white/60 leading-relaxed mb-2">[+] Make sure you type in your password CORRECTLY.</p>
          <p className="text-xs text-white/60 leading-relaxed mb-4">[+] Click check status to see if login is working for you right now.</p>
          <button onClick={checkJustMe} disabled={checking} className="w-full py-3 rounded-xl bg-orange-500/90 hover:bg-orange-400 disabled:opacity-70 text-black text-sm font-bold transition-all flex items-center justify-center gap-2">
            {checking ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>
                detecting if the issue is just you..
              </>
            ) : 'check status'}
          </button>
          {verdict && <p className={`text-xs rounded-xl px-4 py-3 mt-4 leading-relaxed border ${up ? 'text-green-200 bg-green-500/10 border-green-500/25' : 'text-orange-200 bg-orange-500/10 border-orange-500/25'}`}>{verdict}</p>}
          <p className="text-xs text-white/60 leading-relaxed mt-4">[+] If it's up, it's working for you. If it's down, please report.</p>
        </div>
        <div className="bg-black/55 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
          <h2 className="text-sm font-bold text-white mb-4">What to do if you've been waiting forever and login STILL not working for you</h2>
          <p className="text-xs text-white/60 leading-relaxed">If you've been waiting for at least an hour, then let me know as if you've been waiting for an hour then that means it's a backend service error. Even though it's working for few other people.</p>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-3xl bg-black/55 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl mt-5">
        <h2 className="text-sm font-bold text-white mb-2">is the login working for you?</h2>
        <input value={reportUser} onChange={e => setReportUser(e.target.value)} placeholder="your username" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 text-sm mb-3" />
        {!voted ? (
          <div className="flex gap-2.5">
            <button onClick={() => castVote(true)} className="flex-1 py-2.5 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-200 border border-green-500/30 text-sm font-semibold transition-all">yes</button>
            <button onClick={() => { castVote(false); setShowReport(true); }} className="flex-1 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-200 border border-red-500/30 text-sm font-semibold transition-all">no</button>
          </div>
        ) : (
          <p className="text-xs text-white/50">Thanks — your vote ({voted}) was recorded.</p>
        )}
        {showReport && (
          <div className="mt-4">
            <label className="block text-xs text-white/50 mb-1.5">Enter the login report error so i can fix it please:</label>
            <textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="describe what happens when you try to login..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 text-sm min-h-[90px] resize-none mb-3" />
            <button onClick={submitReport} className="w-full py-2.5 rounded-xl bg-orange-500/90 hover:bg-orange-400 text-black text-sm font-bold transition-all">Submit Error</button>
            {reportSent && <p className="text-xs text-green-300 mt-2">Report sent. The admin will review it.</p>}
          </div>
        )}
        <div className="mt-5 pt-5 border-t border-white/[0.06]">
          <button onClick={requestReset} disabled={resetSent} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm transition-all disabled:opacity-60">Request an password reset</button>
          {resetSent && <p className="text-xs text-green-300 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 mt-3 text-center animate-fade-in">your request has been submitted! Please wait for an review.</p>}
        </div>
      </div>
    </div>
  );
}
