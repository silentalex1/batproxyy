import { useState, useEffect } from 'react';
import { addReminder, loadReminders, removeReminder, parseTime, ensurePermission, permissionState, testReminderNow, type Reminder } from './reminders';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function DailyReminder({ isOpen, onClose }: Props) {
  const [what, setWhat] = useState('');
  const [when, setWhen] = useState('');
  const [list, setList] = useState<Reminder[]>([]);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [perm, setPerm] = useState(permissionState());

  useEffect(() => {
    if (!isOpen) return;
    setList(loadReminders());
    setErr('');
    setNote('');
    setPerm(permissionState());
    if (permissionState() === 'default') {
      ensurePermission().then(() => setPerm(permissionState()));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const preview = parseTime(when);

  const start = async () => {
    setErr('');
    setNote('');
    if (!what.trim()) { setErr('Type what you want to be reminded about first.'); return; }
    if (!parseTime(when)) { setErr('Type a time like 9:00 PM, 9pm, 12 PM or 21:00.'); return; }
    const res = addReminder(what, when);
    if (!res.ok) { setErr(res.error || 'Could not save that.'); return; }
    setList(res.list || loadReminders());
    setWhat('');
    setWhen('');
    const ok = await ensurePermission();
    setPerm(permissionState());
    setNote(ok ? 'Saved. You will get a notification and a popup at that time every day.' : 'Saved. It will pop up with a sound inside BatProx at that time every day.');
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(2,2,5,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
      <div className="relative w-full max-w-md rounded-3xl p-8 bp-enter max-h-[88vh] overflow-y-auto" style={{ background: '#0a0a0f', border: '1px solid rgba(var(--bp-glow), 0.5)', boxShadow: '0 0 0 1px rgba(0,0,0,0.9), 0 30px 90px -20px rgba(0,0,0,1), 0 0 60px -10px rgba(var(--bp-glow), 0.45)' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(var(--bp-glow), 0.22)', border: '1px solid rgba(var(--bp-glow), 0.55)', boxShadow: '0 0 26px -4px rgba(var(--bp-glow), 0.6)' }}>
          <svg className="w-7 h-7" style={{ color: 'var(--bp-accent)' }} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-white mb-1.5 tracking-tight">Your daily reminders</h2>
        <p className="text-[13px] text-white/55 mb-6">Set a time and it will nudge you every day, even when you are on another tab.</p>

        <label className="block text-xs text-white/50 mb-1.5">What do you want to be reminded?</label>
        <input
          value={what}
          onChange={e => { setWhat(e.target.value.slice(0, 200)); setErr(''); }}
          placeholder="finish the math homework"
          className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none mb-4"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
        />

        <label className="block text-xs text-white/50 mb-1.5">When do you want to be reminded?</label>
        <input
          value={when}
          onChange={e => { setWhen(e.target.value.slice(0, 20)); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); start(); } }}
          placeholder="9:00 PM"
          className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
        />
        <p className="text-[11px] mt-1.5 mb-5" style={{ color: when ? (preview ? 'var(--bp-accent)' : '#fca5a5') : 'rgba(255,255,255,0.3)' }}>
          {when ? (preview ? `Reminding you at ${preview.label} every day` : 'Try 9:00 PM, 9pm, 12 PM or 21:00') : 'You can type 9:00 PM, 9pm, 12 PM or 21:00'}
        </p>

        {err && <p className="text-[13px] mb-4 px-3.5 py-2.5 rounded-xl" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)' }}>{err}</p>}
        {note && <p className="text-[13px] mb-4 px-3.5 py-2.5 rounded-xl" style={{ color: '#86efac', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>{note}</p>}

        <button onClick={start} className={`w-full py-3 rounded-xl text-white text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 ${what.trim() && preview ? '' : 'opacity-80'}`} style={{ background: 'linear-gradient(135deg, var(--bp-accent), var(--bp-accent-2))', boxShadow: '0 8px 24px -8px rgba(var(--bp-glow), 0.8)' }}>
          Start reminding.
        </button>

        {perm === 'default' && (
          <button
            onClick={async () => { await ensurePermission(); setPerm(permissionState()); }}
            className="w-full mt-3 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(167,139,250,0.4)' }}
          >
            Allow notifications
          </button>
        )}
        <button onClick={() => testReminderNow()} className="w-full mt-3 py-2.5 rounded-xl text-[12px] font-semibold text-white/80 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 transition-all">Test a reminder now</button>
        {perm === 'granted' && <p className="text-[11px] text-emerald-300/80 mt-3">Notifications are on, reminders reach you even on another tab.</p>}
        {perm === 'denied' && <p className="text-[11px] text-white/45 mt-3 leading-relaxed">Browser notifications are off for this site, so reminders pop up inside BatProx with a sound instead. To also get them outside the tab, allow notifications in the padlock menu.</p>}

        {list.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2.5">your reminders</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {list.slice().sort((a, b) => (a.hh * 60 + a.mm) - (b.hh * 60 + b.mm)).map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <span className="text-[11px] font-bold shrink-0 px-2 py-1 rounded-lg" style={{ color: 'var(--bp-accent)', background: 'rgba(var(--bp-glow), 0.14)' }}>{r.label}</span>
                  <span className="text-[12.5px] text-white/80 flex-1 min-w-0 break-words">{r.text}</span>
                  <button onClick={() => setList(removeReminder(r.id))} className="text-white/30 hover:text-red-300 text-lg leading-none shrink-0 px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
