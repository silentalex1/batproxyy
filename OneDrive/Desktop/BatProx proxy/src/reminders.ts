export interface Reminder {
  id: string;
  text: string;
  hh: number;
  mm: number;
  label: string;
  createdAt: number;
  lastFired: string;
}

const KEY = 'batprox-reminders';

function userKey(): string {
  try { return KEY + ':' + (localStorage.getItem('batprox-user') || 'guest'); } catch { return KEY + ':guest'; }
}

export function formatTime(hh: number, mm: number): string {
  const mer = hh >= 12 ? 'PM' : 'AM';
  let h = hh % 12;
  if (h === 0) h = 12;
  return `${h}:${String(mm).padStart(2, '0')} ${mer}`;
}

export function parseTime(raw: string): { hh: number; mm: number; label: string } | null {
  const s = String(raw || '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3] ? m[3][0] : '';
  if (isNaN(hh) || isNaN(mm) || mm > 59) return null;
  if (mer) {
    if (hh < 1 || hh > 12) return null;
    if (mer === 'p' && hh !== 12) hh += 12;
    if (mer === 'a' && hh === 12) hh = 0;
  } else if (hh > 23) {
    return null;
  }
  return { hh, mm, label: formatTime(hh, mm) };
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(userKey());
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(r => r && typeof r.text === 'string' && typeof r.hh === 'number');
  } catch {
    return [];
  }
}

export function saveReminders(list: Reminder[]) {
  try { localStorage.setItem(userKey(), JSON.stringify(list.slice(0, 40))); } catch {}
}

export function addReminder(text: string, when: string): { ok: boolean; error?: string; list?: Reminder[] } {
  const t = String(text || '').trim().slice(0, 200);
  if (!t) return { ok: false, error: 'Type what you want to be reminded about.' };
  const parsed = parseTime(when);
  if (!parsed) return { ok: false, error: 'Could not read that time. Try 9:00 PM, 9pm, 12 PM or 21:00.' };
  const list = loadReminders();
  if (list.some(r => r.hh === parsed.hh && r.mm === parsed.mm && r.text.toLowerCase() === t.toLowerCase())) {
    return { ok: false, error: 'You already have that reminder at ' + parsed.label + '.' };
  }
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text: t,
    hh: parsed.hh,
    mm: parsed.mm,
    label: parsed.label,
    createdAt: Date.now(),
    lastFired: ''
  });
  saveReminders(list);
  return { ok: true, list };
}

export function removeReminder(id: string): Reminder[] {
  const list = loadReminders().filter(r => r.id !== id);
  saveReminders(list);
  return list;
}

export function permissionState(): string {
  try { return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; } catch { return 'unsupported'; }
}

export async function ensurePermission(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

function toast(text: string) {
  try { localStorage.setItem('bp-reminder-toast', JSON.stringify({ text, at: Date.now() })); } catch {}
  try { window.dispatchEvent(new CustomEvent('bp-reminder-toast', { detail: { text } })); } catch {}
}

async function fire(r: Reminder) {
  const body = r.text;
  toast(body);
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof (reg as any).showNotification === 'function') {
        await (reg as any).showNotification('Reminder', { body, tag: 'bp-reminder-' + r.id, badge: '/favicon.ico', icon: '/favicon.ico', data: { url: '/dashboard' } });
        return;
      }
    }
    new Notification('Reminder', { body, tag: 'bp-reminder-' + r.id });
  } catch {
    try { new Notification('Reminder', { body }); } catch {}
  }
}

function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function tick() {
  const list = loadReminders();
  if (!list.length) return;
  const now = new Date();
  const today = dayStamp(now);
  let changed = false;
  for (const r of list) {
    if (r.lastFired === today) continue;
    const due = now.getHours() > r.hh || (now.getHours() === r.hh && now.getMinutes() >= r.mm);
    if (!due) continue;
    const mins = now.getHours() * 60 + now.getMinutes() - (r.hh * 60 + r.mm);
    if (mins > 120) { r.lastFired = today; changed = true; continue; }
    r.lastFired = today;
    changed = true;
    fire(r);
  }
  if (changed) saveReminders(list);
}

let loopStarted = false;

export function startReminderLoop() {
  if (loopStarted) return;
  loopStarted = true;
  try {
    const has = loadReminders().length > 0;
    if (has && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setTimeout(() => { if (document.visibilityState === 'visible') ensurePermission().catch(() => {}); }, 3500);
    }
  } catch {}
  tick();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  navigator.serviceWorker?.addEventListener?.('message', (e: MessageEvent) => {
    if (e.data && e.data.type === 'bp-check-reminders') tick();
  });
  const syncToSW = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.active) reg.active.postMessage({ type: 'bp-sync-reminders', reminders: loadReminders(), permission: permissionState() });
    } catch {}
  };
  setTimeout(syncToSW, 1200);
  setInterval(syncToSW, 60000);
  window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('batprox-reminders')) { tick(); syncToSW(); } });
}

export function testReminderNow() {
  const list = loadReminders();
  const r = list[0];
  if (r) fire(r);
  else fire({ id: 'test', text: 'This is a test reminder. Reminders are working!', hh: 0, mm: 0, label: 'now', createdAt: Date.now(), lastFired: '' } as Reminder);
}
