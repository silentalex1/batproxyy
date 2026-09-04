import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BatMascot from './BatMascot';

export default function LoginStatus() {
  const navigate = useNavigate();
  const [up, setUp] = useState<boolean | null>(null);
  const [history, setHistory] = useState<boolean[]>([]);
  const [lastChange, setLastChange] = useState<number>(Date.now());
  const [othersOnline, setOthersOnline] = useState(0);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState('');
  const [voted, setVoted] = useState<string>(() => { try { return localStorage.getItem('batprox-login-vote') || ''; } catch { return ''; } });
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || 'guest'; } catch { return 'guest'; } });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const probe = useCallback(async (): Promise<{ up: boolean; others: number }> => {
    let backendUp = false;
    let loginUp = false;
    let others = 0;
    try {
      const r = await fetch('https://api.stealthybat.org/health');
      backendUp = r.ok;
    } catch { backendUp = false; }
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '__probe__', inviteCode: '__probe__' }) });
      loginUp = r.ok;
    } catch { loginUp = false; }
    try {
      const r = await fetch('/api/presence');
      if (r.ok) {
        const d = await r.json();
        others = (d.users || []).filter((u: any) => u.active).length;
      }
    } catch {}
    return { up: backendUp && loginUp, others };
  }, []);

  const refresh = useCallback(async () => {
    const res = await probe();
    setOthersOnline(res.others);
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

  const castVote = async (working: boolean) => {
    const v = working ? 'yes' : 'no';
    setVoted(v);
    try { localStorage.setItem('batprox-login-vote', v); } catch {}
    try {
      await fetch('/api/login-vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me, working }) });
    } catch {}
  };

  const submitReport = async () => {
    const t = reportText.trim();
    if (!t) return;
    try {
      await fetch('/api/login-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me, error: t }) });
      setReportSent(true);
      setReportText('');
    } catch {}
  };

  const requestReset = async () => {
    try {
      await fetch('/api/pw-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me }) });
    } catch {}
    setResetSent(true);
  };

  const checkJustMe = async () => {
    setChecking(true);
    setVerdict('');
    const res = await probe();
    setOthersOnline(res.others);
    setUp(res.up);
    setHistory(prev => [...prev.slice(-19), res.up]);
    if (!res.up) {
      setVerdict('Login is not working for you, please report the login error for me.');
    } else if (res.others > 0) {
      setVerdict('This is a you issue. Just wait.');
    } else {
      setVerdict('Backend is up but no one else is online right now. Try again in a bit.');
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
        <div className="flex items-end gap-1.5 h-20 mb-2">
          {history.length === 0 ? (
            <p className="text-white/30 text-xs">collecting checks...</p>
          ) : history.map((h, i) => (
            <div key={i} className={`flex-1 rounded-sm ${h ? 'bg-green-500/80' : 'bg-red-500/80'}`} style={{ height: `${35 + (i % 5) * 12}%` }} />
          ))}
        </div>
        <p className="text-[11px] text-white/35">{othersOnline} user{othersOnline === 1 ? '' : 's'} online right now</p>
      </div>
      <div className="relative z-10 w-full max-w-3xl grid sm:grid-cols-2 gap-5">
        <div className="bg-black/55 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
          <h2 className="text-sm font-bold text-white mb-4">What to do:</h2>
          <p className="text-xs text-white/60 leading-relaxed mb-2">[+] Make sure you type in your password CORRECTLY.</p>
          <p className="text-xs text-white/60 leading-relaxed mb-4">[+] The login backend service, may be down for YOU, but it also may work for other people. So it might be just a you problem. If it is then just click <span className="text-orange-300 font-semibold">check status</span>.</p>
          <button onClick={checkJustMe} disabled={checking} className="w-full py-3 rounded-xl bg-orange-500/90 hover:bg-orange-400 disabled:opacity-70 text-black text-sm font-bold transition-all flex items-center justify-center gap-2">
            {checking ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>
                detecting if the issue is just you..
              </>
            ) : 'check status'}
          </button>
          {verdict && <p className="text-xs text-orange-200 bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3 mt-4 leading-relaxed">{verdict}</p>}
          <p className="text-xs text-white/60 leading-relaxed mt-4">[+] If it's just you, then just wait until it works.</p>
        </div>
        <div className="bg-black/55 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
          <h2 className="text-sm font-bold text-white mb-4">What to do if you've been waiting forever and login STILL not working for you</h2>
          <p className="text-xs text-white/60 leading-relaxed">If you've been waiting for at least an hour, then let me know as if you've been waiting for an hour then that means it's a backend service error. Even though it's working for few other people.</p>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-3xl bg-black/55 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl mt-5">
        <h2 className="text-sm font-bold text-white mb-2">is the login working for you?</h2>
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
