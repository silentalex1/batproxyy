import { useEffect, useRef, useState } from 'react';

interface Toast { id: number; text: string }

const chime = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((delay, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.5);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.55);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 1200);
  } catch {}
};

export default function ReminderToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const titleTimer = useRef<number | null>(null);
  const baseTitle = useRef('');

  useEffect(() => {
    const flash = (text: string) => {
      if (titleTimer.current) return;
      baseTitle.current = document.title;
      let on = false;
      let n = 0;
      titleTimer.current = window.setInterval(() => {
        on = !on;
        n += 1;
        document.title = on ? 'Reminder: ' + text.slice(0, 40) : baseTitle.current;
        if (n > 12 || (document.visibilityState === 'visible' && n > 3)) {
          if (titleTimer.current) window.clearInterval(titleTimer.current);
          titleTimer.current = null;
          document.title = baseTitle.current;
        }
      }, 900);
    };
    const show = (text: string) => {
      if (!text) return;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev.slice(-2), { id, text }]);
      chime();
      flash(text);
      window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 20000);
    };
    const read = () => {
      try {
        const d = JSON.parse(localStorage.getItem('bp-reminder-toast') || 'null');
        if (d && d.text && Date.now() - (d.at || 0) < 60000) show(String(d.text));
      } catch {}
    };
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.text) show(String(detail.text));
      else read();
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'bp-reminder-toast') read(); };
    window.addEventListener('bp-reminder-toast', onEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('bp-reminder-toast', onEvent);
      window.removeEventListener('storage', onStorage);
      if (titleTimer.current) window.clearInterval(titleTimer.current);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <style>{'@keyframes bpToastIn{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:none}}'}</style>
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3.5 bg-[#0d0b16]/95 backdrop-blur-xl border shadow-2xl shadow-black/60" style={{ borderColor: 'rgba(var(--bp-glow), 0.45)', animation: 'bpToastIn .3s ease-out' }}>
          <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--bp-glow), 0.2)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--bp-accent)' }} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Reminder</p>
            <p className="text-[14px] text-white mt-0.5 break-words">{t.text}</p>
          </div>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80 bg-white/10 hover:bg-white/15 transition-colors">Got it</button>
        </div>
      ))}
    </div>
  );
}
