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

  if (!showBlossom && !dmIncoming) return null;
  return (
    <>
      {showBlossom && <Blossom />}
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
