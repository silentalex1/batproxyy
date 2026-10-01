import { useEffect, useState } from 'react';

function readLowPower(): boolean {
  try { return localStorage.getItem('batprox-lowpower') === '1'; } catch { return false; }
}

export function applyLowPower(on: boolean) {
  try {
    if (on) localStorage.setItem('batprox-lowpower', '1');
    else localStorage.removeItem('batprox-lowpower');
  } catch {}
  document.documentElement.dataset.lowpower = on ? '1' : '0';
}

export function isLowPower(): boolean {
  return document.documentElement.dataset.lowpower === '1' || readLowPower();
}

export type BatteryReading = { level: number; charging: boolean };

export function watchBattery(onChange: (r: BatteryReading) => void): () => void {
  let stopped = false;
  let detach = () => {};
  const nav = navigator as any;
  if (typeof nav?.getBattery !== 'function') return () => {};
  let pending: any;
  try { pending = nav.getBattery(); } catch { return () => {}; }
  Promise.resolve(pending).then((b: any) => {
    if (stopped || !b || typeof b !== 'object') return;
    const read = () => {
      const raw = Number(b.level);
      if (!Number.isFinite(raw)) return;
      const level = Math.max(0, Math.min(100, Math.round(raw * 100)));
      onChange({ level, charging: !!b.charging });
    };
    read();
    const canListen = typeof b.addEventListener === 'function' && typeof b.removeEventListener === 'function';
    if (canListen) {
      try {
        b.addEventListener('levelchange', read);
        b.addEventListener('chargingchange', read);
        detach = () => {
          try { b.removeEventListener('levelchange', read); } catch {}
          try { b.removeEventListener('chargingchange', read); } catch {}
        };
        return;
      } catch {}
    }
    const timer = window.setInterval(read, 60000);
    detach = () => window.clearInterval(timer);
  }).catch(() => {});
  return () => {
    stopped = true;
    detach();
  };
}

export function useLowPower(): boolean {
  const [low, setLow] = useState(() => readLowPower());
  useEffect(() => {
    applyLowPower(readLowPower());
    return watchBattery(({ level, charging }) => {
      const on = !charging && level <= 20;
      setLow(on);
      applyLowPower(on);
    });
  }, []);
  return low;
}
