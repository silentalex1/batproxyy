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

export function useLowPower(): boolean {
  const [low, setLow] = useState(() => readLowPower());
  useEffect(() => {
    applyLowPower(readLowPower());
    const nav = navigator as any;
    if (typeof nav.getBattery !== 'function') return;
    let battery: any = null;
    const update = () => {
      if (!battery) return;
      const lvl = Math.round(battery.level * 100);
      const on = !battery.charging && lvl <= 20;
      setLow(on);
      applyLowPower(on);
    };
    nav.getBattery().then((b: any) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, []);
  return low;
}
