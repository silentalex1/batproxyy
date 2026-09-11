import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyBackground } from './background';
import { applyTabCloak } from './tabcloak';
import { switchDashboardToAboutBlank } from './cloak';
import { getSavedTheme } from './theme';
import Blossom from './Blossom';
import { startReminderLoop } from './reminders';

const NO_BLOSSOM_ROUTES = ['/search-engine', '/homework', '/ai-work', '/advertisement'];

export default function PageChrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBlossom, setShowBlossom] = useState(
    () => getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(window.location.pathname)
  );
  const [dmIncoming, setDmIncoming] = useState<{ id: number; from: string } | null>(null);
  const [unread, setUnread] = useState(0);
  const [pingMsg, setPingMsg] = useState<{ id: number; room: string } | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const [shared, setShared] = useState<Array<{ owner: string; ts: number; rank: string }>>([]);
  const [pick, setPick] = useState('');
  const [switchErr, setSwitchErr] = useState('');
  const [switching, setSwitching] = useState(false);

  const openSwitcher = async () => {
    setSwitcher(true);
    setSwitchErr('');
    setSwitching(false);
    try {
      const token = localStorage.getItem('batprox-token') || '';
      if (!token) { setShared([]); setSwitchErr('Log in first.'); return; }
      const r = await fetch('/api/account/shares', { cache: 'no-store', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      const list = d.accounts || [];
      setShared(list);
      setPick(list.length ? list[0].owner : '');
      if (!list.length) setSwitchErr('Nobody has shared an account with you yet.');
    } catch {
      setShared([]);
      setSwitchErr('Could not load your shared accounts.');
    }
  };

  const doSwitch = async () => {
    if (!pick || switching) return;
    setSwitching(true);
    setSwitchErr('');
    try {
      const token = localStorage.getItem('batprox-token') || '';
      const r = await fetch('/api/account/switch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ account: pick }) });
      const d = await r.json();
      if (!d.success || !d.token) { setSwitchErr(d.error || 'Could not switch to that account.'); setSwitching(false); return; }
      localStorage.setItem('batprox-token', d.token);
      localStorage.setItem('batprox-user', d.user.username);
      localStorage.removeItem('batprox-display');
      setSwitcher(false);
      window.location.href = '/dashboard';
    } catch {
      setSwitchErr('Network error while switching.');
      setSwitching(false);
    }
  };

  useEffect(() => {
    if (location.pathname === '/advertisement') {
      document.body.style.background = '#000000';
      document.documentElement.style.background = '#000000';
      (document.body as any).style.backgroundImage = 'none';
    } else {
      applyBackground();
    }
    applyTabCloak();

    setShowBlossom(getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(location.pathname));

    if (location.pathname === '/dashboard') {
      switchDashboardToAboutBlank();
    }
  }, [location.pathname]);

  useEffect(() => {
    const onTheme = () => {
      setShowBlossom(getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(window.location.pathname));
    };
    startReminderLoop();
    const onThemeBg = () => applyBackground();
    window.addEventListener('bp-theme', onTheme);
    window.addEventListener('bp-theme', onThemeBg);
    return () => { window.removeEventListener('bp-theme', onTheme); window.removeEventListener('bp-theme', onThemeBg); };
  }, []);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/TOS' || location.pathname === '/advertisement') return;
    const me = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();
    if (!me) return;
    const check = async () => {
      try {
        const r = await fetch('/api/chat/dm-invites?user=' + encodeURIComponent(me));
        if (!r.ok) return;
        const d = await r.json();
        const list = d.invites || [];
        if (list.length > 0) setDmIncoming(prev => prev || { id: list[0].id, from: list[0].from });
      } catch {}
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/TOS' || location.pathname === '/advertisement' || location.pathname === '/chatting') return;
    let on = false;
    try { on = JSON.parse(localStorage.getItem('batprox-settings') || '{}').notifyMsgs === true; } catch {}
    if (!on) return;
    const me = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();
    if (!me) return;
    let seen: Record<string, number> = {};
    try { seen = JSON.parse(localStorage.getItem('batprox-chat-seen') || '{}'); } catch {}
    const saveSeen = () => { try { localStorage.setItem('batprox-chat-seen', JSON.stringify(seen)); } catch {} };
    const baseTitle = 'Bat Prox';
    const poll = async () => {
      if (location.pathname === '/chatting') {
        setUnread(0);
        setPingMsg(null);
        if (document.title.startsWith('(')) document.title = baseTitle;
        return;
      }
      const rooms = new Set<string>(['community']);
      try {
        const r = await fetch('/api/chat/dms?user=' + encodeURIComponent(me));
        if (r.ok) { const d = await r.json(); for (const x of (d.rooms || [])) rooms.add(x.id); }
      } catch {}
      try {
        const r = await fetch('/api/chat/rooms?user=' + encodeURIComponent(me));
        if (r.ok) { const d = await r.json(); for (const x of (d.rooms || [])) rooms.add(x.id); }
      } catch {}
      let fresh = 0;
      let latest: { id: number; room: string } | null = null;
      for (const rid of rooms) {
        try {
          const r = await fetch('/api/chat/messages?room=' + encodeURIComponent(rid));
          if (!r.ok) continue;
          const d = await r.json();
          const msgs = (d.messages || []).filter((m: any) => m.user !== me);
          if (!msgs.length) continue;
          const last = msgs[msgs.length - 1];
          const prevSeen = seen[rid] || 0;
          const isMention = rid === 'community' ? true : msgs.some((m: any) => m.id > prevSeen && (m.text.includes('@' + me) || rid !== 'community'));
          const news = msgs.filter((m: any) => m.id > prevSeen);
          if (news.length > 0 && (rid !== 'community' ? true : isMention)) {
            fresh += news.length;
            latest = { id: last.id, room: rid };
          }
          seen[rid] = last.id;
        } catch {}
      }
      saveSeen();
      if (fresh > 0) {
        setUnread(u => u + fresh);
        setPingMsg(latest);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/chatting') return;
    if (location.pathname === '/homework' && unread > 0) {
      document.title = `(${unread}) New Tab`;
    } else if (document.title.startsWith('(')) {
      document.title = 'Bat Prox';
    }
  }, [unread, location.pathname]);

  const goChat = () => {
    const q = pingMsg ? `?highlight=${pingMsg.id}&room=${encodeURIComponent(pingMsg.room)}` : '';
    setUnread(0);
    setPingMsg(null);
    navigate('/chatting' + q);
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        if (!e.data || e.data.type !== 'bp-parent' || !e.data.redirect) return;
        if (e.origin !== window.location.origin) return;
        window.location.href = String(e.data.redirect);
      } catch {}
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const respondDm = async (accept: boolean) => {
    if (!dmIncoming) return;
    const me = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();
    try {
      const r = await fetch('/api/chat/dm-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dmIncoming.id, to: me, accept }) });
      const d = await r.json().catch(() => ({}));
      setDmIncoming(null);
      if (accept && d.room) navigate('/chatting?dm=' + encodeURIComponent(dmIncoming.from));
    } catch { setDmIncoming(null); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable)) return;
      if (e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search-engine');
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSwitcher();
        return;
      }
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        if (!s.panicKey) return;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
        if (combo.toLowerCase() !== String(s.panicKey).toLowerCase() && e.key.toLowerCase() !== String(s.panicKey).toLowerCase()) return;
        e.preventDefault(); e.stopPropagation();
        const dest = s.panicUrl || 'https://www.google.com/';
        try { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); } catch {}
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'bp-parent', redirect: dest }, '*');
        }
        if (window.top) {
          window.top.location.href = dest;
        } else {
          window.location.href = dest;
        }
      } catch {
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        if (!s.closeProtection) return;
        e.preventDefault();
        e.returnValue = '';
      } catch {
      }
    };

    window.addEventListener('keydown', onKey, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    const attachToIframes = () => {
      try {
        if (document.documentElement.dataset.gaming === '1') return;
        if (document.visibilityState !== 'visible') return;
        const frames = document.querySelectorAll('iframe');
        for (const f of Array.from(frames)) {
          try {
            const doc = (f as HTMLIFrameElement).contentDocument;
            const win = (f as HTMLIFrameElement).contentWindow;
            if (doc && !(doc as any).__bpPanic) { (doc as any).__bpPanic = true; doc.addEventListener('keydown', onKey as any, true); }
            if (win && !(win as any).__bpPanic) { (win as any).__bpPanic = true; win.addEventListener('keydown', onKey as any, true); }
          } catch {}
        }
      } catch {}
    };
    const id = setInterval(attachToIframes, 2500);
    attachToIframes();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearInterval(id);
    };
  }, [navigate]);

  const gaming = location.pathname === '/homework';
  const showPing = unread > 0 && location.pathname !== '/chatting' && !gaming;
  if (!showBlossom && !dmIncoming && !showPing && !switcher) return null;
  return (
    <>
      {showBlossom && <Blossom />}
      {switcher && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setSwitcher(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(2,2,5,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
          <div className="relative w-full max-w-md rounded-3xl p-8 bp-enter" style={{ background: '#0a0a0f', border: '1px solid rgba(var(--bp-glow), 0.5)', boxShadow: '0 0 0 1px rgba(0,0,0,0.9), 0 30px 90px -20px rgba(0,0,0,1), 0 0 60px -10px rgba(var(--bp-glow), 0.45)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSwitcher(false)} title="Close" className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(var(--bp-glow), 0.22)', border: '1px solid rgba(var(--bp-glow), 0.55)', boxShadow: '0 0 26px -4px rgba(var(--bp-glow), 0.6)' }}>
              <svg className="w-7 h-7" style={{ color: 'var(--bp-accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1.5 tracking-tight">select the account you want to switch</h2>
            <p className="text-[13px] text-white/55 mb-6">accounts other people have shared with you</p>
            <div className="relative mb-4">
              <select value={pick} onChange={e => setPick(e.target.value)} disabled={shared.length === 0} className="w-full appearance-none px-4 py-3.5 pr-10 rounded-xl text-white text-[15px] font-medium focus:outline-none disabled:opacity-50 cursor-pointer transition-colors" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(var(--bp-glow), 0.35)' }}>
                {shared.length === 0 && <option value="" style={{ background: '#0a0a0f' }}>no shared accounts</option>}
                {shared.map(a => <option key={a.owner} value={a.owner} style={{ background: '#0a0a0f' }}>{a.owner}{a.rank === 'moderator' ? ' · staff' : ''}</option>)}
              </select>
              <svg className="w-4 h-4 text-white/60 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            {switchErr && <p className="text-[13px] mb-5 leading-relaxed px-3.5 py-2.5 rounded-xl" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)' }}>{switchErr}</p>}
            <div className="flex gap-2.5">
              <button onClick={() => setSwitcher(false)} className="flex-1 py-3 rounded-xl text-white/80 hover:text-white text-sm font-medium transition-colors" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}>Cancel</button>
              <button onClick={doSwitch} disabled={!pick || switching} className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-95" style={{ background: 'linear-gradient(135deg, var(--bp-accent), var(--bp-accent-2))', boxShadow: '0 8px 24px -8px rgba(var(--bp-glow), 0.8)' }}>{switching ? 'switching...' : 'switch'}</button>
            </div>
            <p className="text-center text-[11px] text-white/40 mt-5">shift+s opens this any time</p>
          </div>
        </div>
      )}
      {showPing && (
        <button onClick={goChat} title={`${unread} new message${unread === 1 ? '' : 's'}`} className="group fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.8)] ring-1 ring-white/15 transition-transform duration-200 hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(140deg, var(--bp-accent), var(--bp-accent-2))' }}>
          <span className="absolute inset-0 rounded-full animate-bp-ripple pointer-events-none" style={{ boxShadow: '0 0 0 0 rgba(var(--bp-glow), 0.55)' }} />
          <svg className="w-6 h-6 relative" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z" />
          </svg>
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#0b0b10] border border-white/20 text-[11px] font-bold flex items-center justify-center text-white shadow-lg">{unread > 99 ? '99+' : unread}</span>
        </button>
      )}
      {dmIncoming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-xs text-center shadow-2xl">
            <p className="text-sm text-white mb-2">{dmIncoming.from} would like to start dms with you.</p>
            <p className="text-xs text-white/40 mb-5">do you accept?</p>
            <div className="flex gap-2">
              <button onClick={() => respondDm(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">no</button>
              <button onClick={() => respondDm(true)} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
