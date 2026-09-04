import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyBackground } from './background';
import { applyTabCloak } from './tabcloak';
import { switchDashboardToAboutBlank } from './cloak';
import { getSavedTheme } from './theme';
import Blossom from './Blossom';

const NO_BLOSSOM_ROUTES = ['/search-engine', '/homework', '/ai-work'];

export default function PageChrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBlossom, setShowBlossom] = useState(
    () => getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(window.location.pathname)
  );
  const [dmIncoming, setDmIncoming] = useState<{ id: number; from: string } | null>(null);
  const [unread, setUnread] = useState(0);
  const [pingMsg, setPingMsg] = useState<{ id: number; room: string } | null>(null);

  useEffect(() => {
    applyBackground();
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
    window.addEventListener('bp-theme', onTheme);
    return () => window.removeEventListener('bp-theme', onTheme);
  }, []);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/TOS') return;
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
    if (location.pathname === '/' || location.pathname === '/TOS') return;
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
      if (e.shiftKey && e.key.toLowerCase() === 'k' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        navigate('/search-engine');
        return;
      }
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        if (!s.panicKey) return;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
        if (combo.toLowerCase() !== String(s.panicKey).toLowerCase() && e.key.toLowerCase() !== String(s.panicKey).toLowerCase()) return;
        e.preventDefault();
        const dest = s.panicUrl || 'https://www.google.com/';
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
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [navigate]);

  const gaming = location.pathname === '/homework';
  const showPing = unread > 0 && location.pathname !== '/chatting' && !gaming;
  if (!showBlossom && !dmIncoming && !showPing) return null;
  return (
    <>
      {showBlossom && <Blossom />}
      {showPing && (
        <button onClick={goChat} title="New message" className="fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm shadow-[0_0_24px_rgba(249,115,22,0.6)] transition-all animate-bounce">
          [!]
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
