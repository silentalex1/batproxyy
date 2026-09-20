import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';
import Settings from './Settings';
import { startPresence } from './presence';
import { useLowPower } from './power';
import { launchAboutBlankCloak, isAboutBlankTabEnabled } from './cloak';

export default function MyScripts() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState('');
  void username;
  useLowPower();

  useEffect(() => {
    const token = localStorage.getItem('batprox-token');
    if (!token) { navigate('/'); return; }
    setUsername(localStorage.getItem('batprox-user') || 'user');
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => {
      if (!d.user) { localStorage.removeItem('batprox-token'); localStorage.removeItem('batprox-user'); navigate('/'); }
      else if (isAboutBlankTabEnabled()) launchAboutBlankCloak();
    }).catch(() => navigate('/'));
    startPresence();
  }, [navigate]);

  useEffect(() => {
    const css = document.createElement('style');
    css.textContent = `@keyframes rip{to{transform:scale(2.5);opacity:0;}}@keyframes pFly{to{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0;}}@keyframes popIn{from{transform:translate(-50%,-50%) scale(0);opacity:0;}to{transform:translate(-50%,-50%) scale(1);opacity:1;}}@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}@keyframes slideDown{to{opacity:0;transform:translateX(-50%) translateY(20px);}}`;
    document.head.appendChild(css);
    return () => { try { document.head.removeChild(css); } catch {} };
  }, []);

  const handleBookmark = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    void (btn.closest('.card') as HTMLElement);
    const r = btn.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const x = e.clientX - r.left - s / 2;
    const y = e.clientY - r.top - s / 2;
    const el = document.createElement('span');
    el.style.cssText = `position:absolute;width:${s}px;height:${s}px;left:${x}px;top:${y}px;background:rgba(255,255,255,0.4);border-radius:50%;transform:scale(0);animation:rip 0.5s ease-out;pointer-events:none;`;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(el);
    setTimeout(() => el.remove(), 500);
    const k = [
      { transform: 'scale(1)', opacity: 1, offset: 0 },
      { transform: 'scale(1.05)', opacity: 0.8, offset: 0.3 },
      { transform: 'scale(0)', opacity: 0, offset: 1 }
    ];
    try { (btn as any).animate(k as any, { duration: 800, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', fill: 'forwards' }); } catch {}
    btn.style.pointerEvents = 'none';
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      const a = (Math.PI * 2 * i) / 20;
      const v = 80 + Math.random() * 150;
      p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;background:hsl(${Math.random()*360},80%,60%);border-radius:50%;pointer-events:none;z-index:9999;animation:pFly 0.7s ease-out forwards;--tx:${Math.cos(a)*v}px;--ty:${Math.sin(a)*v}px;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
    setTimeout(() => {
      const payload = `javascript:(function(){var d=document.createElement('div');d.innerText='hello';d.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ff0055;color:#fff;padding:15px 30px;border-radius:8px;font:bold 24px sans-serif;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.3)';document.body.appendChild(d);})();`;
      const link = document.createElement('a');
      link.href = payload;
      link.textContent = '🔖 Drag to Bar — hello';
      link.draggable = true;
      link.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:16px;font-weight:600;font-size:14px;box-shadow:0 8px 20px rgba(102,126,234,0.45);z-index:10;animation:popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);cursor:grab;user-select:none;white-space:nowrap;border:1px solid rgba(255,255,255,0.12);`;
      link.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('text/plain', payload);
        ev.dataTransfer?.setData('text/uri-list', payload);
        ev.dataTransfer?.setData('text/html', `<a href="${payload}">hello bookmarklet</a>`);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
      });
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        navigator.clipboard.writeText(payload).then(() => {
          toast.textContent = 'Copied to clipboard!';
        });
      });
      document.body.appendChild(link);
      btn.style.display = 'none';
      const toast = document.createElement('div');
      toast.textContent = 'Drag the bookmarklet to your bookmarks bar!';
      toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;z-index:10000;animation:slideUp 0.4s ease-out;border:1px solid #333;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideDown 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400);
      }, 3500);
      const cleanup = () => {
        link.remove();
        toast.remove();
        btn.style.display = '';
        btn.style.pointerEvents = '';
        try { (btn as any).getAnimations?.().forEach((a: any) => a.cancel()); } catch {}
        (btn.style as any).transform = '';
      };
      link.addEventListener('dragend', cleanup);
      setTimeout(() => {
        const onDocClick = (ev: MouseEvent) => {
          const t = ev.target as HTMLElement;
          if (t !== link && !link.contains(t) && t !== btn) {
            cleanup();
            document.removeEventListener('click', onDocClick);
          }
        };
        setTimeout(() => document.addEventListener('click', onDocClick), 300);
      }, 500);
    }, 800);
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col min-h-screen px-4 sm:pl-20 sm:pr-6 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto py-16">
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-[0.18em] uppercase text-white/35 text-center" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui', letterSpacing: '0.18em' }}>Welcome to my scripts</h1>
          <p className="text-sm sm:text-[15px] font-light tracking-wide text-white/30 text-center mt-4">a page where i code js bookmarklets, for you to run if you want.</p>
          <div className="card w-full max-w-xl mt-10 bg-black/40 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl">
            <div className="flex flex-col items-center gap-5">
              <div className="w-full flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Bookmarklets</p>
                  <p className="text-xs text-white/40 mt-1">Click to generate a draggable bookmarklet</p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">1 available</span>
              </div>
              <div className="w-full h-px bg-white/5" />
              <button id="bookmarkBtn" onClick={handleBookmark} className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/20 hover:shadow-purple-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all">simple hello message</button>
              <p className="text-[11px] text-white/25 text-center leading-relaxed">Click the button for a quick animation, then drag the popup to your bookmarks bar or click to copy.</p>
            </div>
          </div>
        </div>
      </main>
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
