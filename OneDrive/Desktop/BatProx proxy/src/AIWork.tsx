import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Cookies from 'js-cookie';
import Settings from './Settings';
import { startPresence } from './presence';
import { useLowPower } from './power';
import { applyTheme, THEMES } from './theme';
import { applyBackground, BACKGROUNDS } from './background';
import { applyTabCloak, TAB_CLOAKS } from './tabcloak';

type PendingSetting = { key: string; value: any; label: string; desc: string };

const IconChevron = ({ open }: { open?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${open ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 001-1.51V13a2 2 0 014 0v.09A1.65 1.65 0 0011 14.59a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0014.4 15" /></svg>
);
const IconGame = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 11h10M8 14h8M14 8a4 4 0 110 8H7a4 4 0 010-8h7z" /></svg>
);
const IconImage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
);
const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
);
const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>
);
const IconSpark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zM19 13l1 2.2L22 16l-2.2 1-1 2.2-1-2.2L15 16l2.2-1L19 13zM6 14l1 1.6L9 17l-1.6 1L6 20l-1-1.6L3 17l1.6-1L6 14z" /></svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);
const IconBrush = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7a2 2 0 00-2-2l-7 7v3h3z" /><path d="M5 19a2 2 0 100 4 2 2 0 000-4z" /></svg>
);
const IconMsg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8 8 0 01-12.6 6.6L3 21l3.4-5.4A8 8 0 0121 11.5z" /></svg>
);
const IconLayers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
);

interface ChatHistory {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; terminal?: string[]; imgs?: string[] }>;
  timestamp: number;
  checkpoints?: Array<{ id: string; messageIndex: number; timestamp: number }>;
}
interface Model { id: string; name: string; badge?: string; status: string; }

const revealSpeed = (len: number) => {
  const target = len < 240 ? 1.1 : len < 900 ? 1.8 : 2.8;
  return Math.max(90, Math.min(1400, len / target));
};

function streamInto(
  text: string,
  from: number,
  onTick: (s: string) => void,
  onDone: () => void,
  holder: { current: number | null }
) {
  if (holder.current) cancelAnimationFrame(holder.current);
  const reduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  if (reduced || text.length - from <= 0) {
    onTick(text);
    onDone();
    return;
  }
  const cps = revealSpeed(text.length - from);
  const started = performance.now();
  let shown = from;
  const step = (now: number) => {
    const want = from + Math.floor(((now - started) / 1000) * cps);
    if (want > shown) {
      let end = Math.min(text.length, want);
      if (end < text.length) {
        const nextSpace = text.indexOf(' ', end);
        if (nextSpace > -1 && nextSpace - end < 12) end = nextSpace;
      }
      shown = end;
      onTick(text.slice(0, shown));
    }
    if (shown < text.length) {
      holder.current = requestAnimationFrame(step);
    } else {
      holder.current = null;
      onDone();
    }
  };
  holder.current = requestAnimationFrame(step);
}

export default function AIWork() {
  const navigate = useNavigate();
  const [_localOnline, setLocalOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try { const r = await fetch('/api/ai/status', { cache: 'no-store' }); const d = await r.json(); if (alive) setLocalOnline(!!d.online); } catch { if (alive) setLocalOnline(false); }
    }; check(); const id = setInterval(check, 30000); return () => { alive = false; clearInterval(id); };
  }, []);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; terminal?: string[]; imgs?: string[] }>>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [images, setImages] = useState<Array<{ id: string; data: string; file: File }>>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; file: File; label?: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [startTime] = useState<number>(Date.now());
  const [siteTime, setSiteTime] = useState<string>('0 seconds');
  const [themeGlow, setThemeGlow] = useState<string>('rgba(147, 51, 234, 0.18)');
  const [selectedModel, setSelectedModel] = useState<Model>({ id: 'batprox-ai', name: 'BatProx AI', status: 'online' });
  const [customA, setCustomA] = useState('#c084fc');
  const [customB, setCustomB] = useState('#6366f1'); void customA;
  const [pendingTheme, setPendingTheme] = useState<{ a: string; b: string; label: string } | null>(null);
  const [pendingSetting, setPendingSetting] = useState<PendingSetting | null>(null);
  const [alwaysAllow, setAlwaysAllow] = useState(() => { try { return localStorage.getItem('bp-ai-always-allow') === '1'; } catch { return false; } });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  useEffect(() => {
    const u = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();
    if (!u) return;
    fetch(`/api/ai/permissions?user=${encodeURIComponent(u)}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d && typeof d.alwaysAllow === 'boolean') { setAlwaysAllow(!!d.alwaysAllow); try { localStorage.setItem('bp-ai-always-allow', d.alwaysAllow ? '1' : '0'); } catch {} }
    }).catch(() => {});
  }, []);
  const availableModels: Model[] = [
    { id: 'batprox-ai', name: 'BatProx AI', badge: 'Active', status: 'online' },
    { id: 'inferforge-code', name: 'Inferforge-code', badge: 'Code', status: 'online' },
    { id: 'prysmis-ai', name: 'PrysmisAI beta', badge: 'Beta', status: 'online' },
  ];
  const [isThinking, setIsThinking] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [fullResponse, setFullResponse] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const typingRef = useRef<number | null>(null);

  const applyCustomGradient = (a: string, b: string) => {
    setCustomA(a); setCustomB(b);
    document.documentElement.style.setProperty('--bp-accent', a);
    document.documentElement.style.setProperty('--bp-accent-2', b);
    document.documentElement.style.setProperty('--bp-glow', `${parseInt(a.slice(1, 3), 16)}, ${parseInt(a.slice(3, 5), 16)}, ${parseInt(a.slice(5, 7), 16)}`);
    setThemeGlow(`linear-gradient(135deg, ${a}33, ${b}33)`);
    try {
      const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
      s.customGradient = { a, b }; s.theme = 'custom';
      localStorage.setItem('batprox-settings', JSON.stringify(s));
      localStorage.setItem('bp-custom-gradient', JSON.stringify({ a, b }));
    } catch {}
    window.dispatchEvent(new CustomEvent('bp-theme'));
  };
  const requestThemeChange = (a: string, b: string, label: string) => {
    if (alwaysAllow) { applyCustomGradient(a, b); return true; }
    setPendingTheme({ a, b, label });
    return false;
  };

  const grantAlwaysAllow = () => {
    try { localStorage.setItem('bp-ai-always-allow', '1'); } catch {}
    setAlwaysAllow(true);
    const u = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })();
    if (u) fetch('/api/ai/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u, alwaysAllow: true }) }).catch(() => {});
  };

  const applySettingValue = (key: string, value: any) => {
    let next: any = {};
    try { next = JSON.parse(localStorage.getItem('batprox-settings') || '{}'); } catch {}
    next[key] = value;
    try { localStorage.setItem('batprox-settings', JSON.stringify(next)); } catch {}
    if (key === 'theme') applyTheme(String(value));
    if (key === 'background' || key === 'backgroundUpload') applyBackground();
    if (key === 'tabCloak') applyTabCloak();
    const token = (() => { try { return localStorage.getItem('batprox-token'); } catch { return null; } })();
    if (token) fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(next) }).catch(() => {});
    window.dispatchEvent(new CustomEvent('bp-theme'));
  };

  const parseSettingRequest = (raw: string): PendingSetting | null => {
    const n = raw.toLowerCase().replace(/["'.]/g, '');
    if (!/\b(change|set|turn|enable|disable|switch|make|update|use|apply|cloak)\b/.test(n)) return null;
    const off = /\b(off|disable|disabled|remove|stop|hide|dont|do not)\b/.test(n);
    const on = !off;
    const state = on ? 'on' : 'off';

    if (/typing animation/.test(n)) return { key: 'disableTypingAnimation', value: !on, label: 'typing animation', desc: state };
    if (/auto ?login/.test(n)) return { key: 'autoLoginPage', value: on, label: 'auto login page', desc: state };
    if (/about ?:? ?blank/.test(n)) return { key: 'aboutBlankTab', value: on, label: 'about:blank tab', desc: state };
    if (/close protection|closing protection|confirm before clos/.test(n)) return { key: 'closeProtection', value: on, label: 'close protection', desc: state };
    if (/skip loading|loading screen/.test(n)) return { key: 'skipLoading', value: on, label: 'skip the loading screen', desc: state };
    if (/message notif|notify me|notifications/.test(n)) return { key: 'notifyMsgs', value: on, label: 'message notifications', desc: state };

    if (/panic/.test(n)) {
      const url = raw.match(/https?:\/\/[^\s"']+/i)?.[0];
      if (url) return { key: 'panicUrl', value: url, label: 'panic url', desc: url };
      const k = raw.match(/panic (?:key|button)\s*(?:to|=|:)?\s*([a-z0-9])\b/i)?.[1];
      if (k) return { key: 'panicKey', value: k.toLowerCase(), label: 'panic key', desc: k.toLowerCase() };
    }
    if (/cloak|tab title|tab icon|disguise/.test(n)) {
      const c = TAB_CLOAKS.find(t => n.includes(t.id) || n.includes(t.title.toLowerCase()));
      if (c) return { key: 'tabCloak', value: c.id, label: 'tab cloak', desc: c.title };
    }
    if (/background|wallpaper|scenery/.test(n)) {
      const b = BACKGROUNDS.find(x => x.id !== 'upload' && x.id !== 'theme' && (n.includes(x.id) || n.includes(x.name.toLowerCase())));
      if (b) return { key: 'background', value: b.id, label: 'background', desc: b.name };
    }
    if (/theme/.test(n)) {
      const t = THEMES.find(x => n.includes(x.name.toLowerCase()));
      if (t) return { key: 'theme', value: t.name, label: 'theme', desc: t.name };
    }
    return null;
  };

  const confirmSetting = (p: PendingSetting, always: boolean) => {
    if (always) grantAlwaysAllow();
    applySettingValue(p.key, p.value);
    setPendingSetting(null);
    setMessages(prev => [...prev, { role: 'assistant' as const, content: `Done, your ${p.label} is now ${p.desc}.${always ? ' I will apply future setting changes without asking.' : ''}` }]);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bp-custom-gradient');
      if (raw) { const g = JSON.parse(raw); if (g.a && g.b) { setCustomA(g.a); setCustomB(g.b); applyCustomGradient(g.a, g.b); } }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      if (elapsedSeconds < 60) setSiteTime(`${elapsedSeconds} seconds`);
      else if (elapsedSeconds < 3600) { const mins = Math.floor(elapsedSeconds / 60); const secs = elapsedSeconds % 60; setSiteTime(`${mins}m ${secs}s`); }
      else { const hrs = Math.floor(elapsedSeconds / 3600); const mins = Math.floor((elapsedSeconds % 3600) / 60); setSiteTime(`${hrs}h ${mins}m`); }
    }, 1000); return () => clearInterval(timer);
  }, [startTime]);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages, streamText, isThinking]);
  useEffect(() => { startPresence(); }, []);
  useLowPower();

  useEffect(() => { const saved = Cookies.get('chatHistory'); if (saved) { try { setChatHistory(JSON.parse(saved)); } catch {} } }, []);
  useEffect(() => { Cookies.set('chatHistory', JSON.stringify(chatHistory), { expires: 365 }); }, [chatHistory]);
  const syncHistory = (chats: ChatHistory[]) => { const u = localStorage.getItem('batprox-user'); if (!u) return; fetch('/api/ai/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u, chats }) }).catch(() => {}); };
  useEffect(() => { const u = localStorage.getItem('batprox-user'); if (!u) return; fetch(`/api/ai/history?user=${encodeURIComponent(u)}`, { cache: 'no-store' }).then(r => r.json()).then(d => { if (Array.isArray(d.chats) && d.chats.length) setChatHistory(d.chats); }).catch(() => {}); }, []);
  const saveChatToHistory = (messagesToSave?: Array<{ role: 'user' | 'assistant'; content: string; imgs?: string[] }>) => {
    const messagesArray = messagesToSave || messages;
    if (messagesArray.length === 0) return;
    const title = messagesArray[0]?.content.substring(0, 30) + (messagesArray[0]?.content.length > 30 ? '...' : '') || 'New Chat';
    const newChat: ChatHistory = { id: currentChatId || Date.now().toString(), title, messages: messagesArray as any, timestamp: Date.now(), checkpoints: [] };
    if (currentChatId) { setChatHistory(prev => { const updated = prev.map(c => c.id === currentChatId ? newChat : c); Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 }); syncHistory(updated); return updated; }); }
    else { setChatHistory(prev => { const updated = [newChat, ...prev]; Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 }); syncHistory(updated); setCurrentChatId(newChat.id); return updated; }); }
  };
  const loadChat = (chatId: string) => { const chat = chatHistory.find(c => c.id === chatId); if (chat) { setMessages(chat.messages as any); setCurrentChatId(chatId); } };
  const startNewChat = () => { setMessages([]); setCurrentChatId(null); setStreamText(''); setFullResponse(''); setIsThinking(false); setShowContinue(false); };
  const deleteChat = (chatId: string) => {
    setChatHistory(prev => { const nh = prev.filter(c => c.id !== chatId); Cookies.set('chatHistory', JSON.stringify(nh), { expires: 365 }); syncHistory(nh); return nh; });
    if (currentChatId === chatId) startNewChat(); setContextMenu(null);
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    Array.from(items).filter(i => i.type.startsWith('image/')).forEach(item => {
      const file = item.getAsFile(); if (file) { const reader = new FileReader(); reader.onload = ev => { const dataUrl = ev.target?.result as string; setImages(prev => [...prev, { id: Date.now().toString(), data: dataUrl, file }]); }; reader.readAsDataURL(file); }
    });
  };
  const removeImage = (id: string) => setImages(prev => prev.filter(img => img.id !== id));
  const addFiles = (files: Array<{ file: File; label?: string }>) => {
    files.forEach(({ file, label }) => {
      if (file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = ev => { const dataUrl = ev.target?.result as string; setImages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), data: dataUrl, file }]); }; reader.readAsDataURL(file); }
      else setAttachedFiles(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), file, label }]);
    });
  };
  const readEntry = async (entry: any, folderLabel?: string): Promise<Array<{ file: File; label?: string }>> => {
    if (!entry) return []; if (entry.isFile) return new Promise(res => entry.file((f: File) => res([{ file: f, label: folderLabel || f.name }]), () => res([])));
    if (entry.isDirectory) { const reader = entry.createReader(); const all: Array<{ file: File; label?: string }> = []; const readBatch = (): Promise<any[]> => new Promise(r => reader.readEntries((ents: any[]) => r(ents), () => r([]))); let batch = await readBatch(); while (batch.length) { for (const e of batch) all.push(...(await readEntry(e, entry.name))); batch = await readBatch(); } return all; } return [];
  };
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounterRef.current++; setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragging(false); } };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); dragCounterRef.current = 0;
    const items = Array.from(e.dataTransfer.items || []); const entries = items.map(it => (it as any).webkitGetAsEntry ? (it as any).webkitGetAsEntry() : null);
    if (entries.some(en => en)) { const collected: Array<{ file: File; label?: string }> = []; for (const en of entries) collected.push(...(await readEntry(en))); addFiles(collected); }
    else addFiles(Array.from(e.dataTransfer.files || []).map(f => ({ file: f, label: f.name })));
  };
  const isTruncated = (t: string) => {
    const s = t.trim();
    if (!s) return false;
    if (s.length >= 1400) return true;
    if (s.length > 220 && !/[.!?)"']\s*$/.test(s) && !s.endsWith('```')) return true;
    return false;
  };
  const getDisableTyping = () => {
    try { const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}'); return !!s.disableTypingAnimation; } catch { return false; }
  };
  const startFluidStream = (text: string) => {
    if (getDisableTyping()) {
      setIsThinking(false); setStreamText(''); setFullResponse('');
      const userContent = lastUserRef.current; const imgs = lastImgsRef.current;
      setMessages(prev => [...prev, { role: 'assistant' as const, content: text }]);
      saveChatToHistory([...messages, { role: 'user' as const, content: userContent, imgs: imgs } as any, { role: 'assistant' as const, content: text } as any]);
      if (isTruncated(text)) setShowContinue(true);
      return;
    }
    setFullResponse(text); setStreamText(''); setShowContinue(false);
    streamInto(text, 0, setStreamText, () => {
      setIsThinking(false);
      if (isTruncated(text)) setShowContinue(true);
      else { const userContent = lastUserRef.current; const imgs = lastImgsRef.current; saveChatToHistory([...messages, { role: 'user' as const, content: userContent, imgs: imgs } as any, { role: 'assistant' as const, content: text } as any]); setMessages(prev => [...prev, { role: 'assistant' as const, content: text }]); setStreamText(''); setFullResponse(''); }
    }, typingRef);
  };
  const handleStop = () => {
    if (typingRef.current) cancelAnimationFrame(typingRef.current);
    setIsThinking(false);
    const me = (() => { try { return localStorage.getItem('batprox-user') || 'user'; } catch { return 'user'; } })();
    const stopped = streamText || fullResponse;
    if (stopped) {
      setMessages(prev => [...prev, { role: 'assistant' as const, content: stopped }]);
      saveChatToHistory([...messages, { role: 'assistant' as const, content: stopped }]);
    }
    setStreamText(''); setFullResponse(''); setShowContinue(false);
    const stopMsg = `BatProx AI message has been stopped by ${me}`;
    setMessages(prev => [...prev, { role: 'assistant' as const, content: stopMsg }]);
    saveChatToHistory([...messages, { role: 'assistant' as const, content: stopMsg }]);
  };
  const lastUserRef = useRef('');
  const lastImgsRef = useRef<string[] | undefined>(undefined);

  const parseThemeRequest = (raw: string): { a: string; b: string; label: string } | null => {
    let name: string | null = null;
    const m1 = raw.match(/change my (?:website )?background(?: theme design| colors| color)? to\s+(.+)/i);
    if (m1) name = m1[1].trim();
    else {
      const m2 = raw.match(/change background(?: colors| color)? to\s+(.+)/i);
      if (m2) name = m2[1].trim();
      else {
        const m3 = raw.match(/background.*?to\s+([#a-z0-9 &]+)/i);
        if (m3 && /white|black|blue|green|red|gold|yellow|#/.test(m3[1].toLowerCase())) name = m3[1].trim();
      }
    }
    if (name) {
      const n = name.toLowerCase().replace(/["'.]/g, '');
      if (n.includes('black and white') || n.includes('black & white') || (n.includes('white') && n.includes('black'))) return { a: '#e5e7eb', b: '#111827', label: 'black and white' };
      if (n.includes('white and blue') || (n.includes('white') && n.includes('blue'))) return { a: '#e5e7eb', b: '#3b82f6', label: 'white and blue' };
      if (n.includes('blue')) return { a: '#3b82f6', b: '#06b6d4', label: name };
      if (n.includes('green')) return { a: '#22c55e', b: '#16a34a', label: name };
      if (n.includes('red') || n.includes('crimson')) return { a: '#ef4444', b: '#f97316', label: name };
      if (n.includes('gold') || n.includes('yellow')) return { a: '#eab308', b: '#f59e0b', label: name };
      if (/^#[0-9a-f]{6}$/i.test(name)) return { a: name, b: '#6366f1', label: name };
      return { a: '#a855f7', b: '#6366f1', label: name };
    }
    const hex = raw.match(/#[0-9a-f]{6}/i)?.[0];
    if (hex) return { a: hex, b: customB, label: hex };
    return null;
  };
  const handleSendMessage = async (textOverride?: string) => {
    const raw = (textOverride ?? inputValue).trim();
    if (!raw && images.length === 0) return;
    const settingRequested = parseSettingRequest(raw);
    if (settingRequested) {
      const userMessage = raw;
      const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
      setMessages(newMessages); lastUserRef.current = userMessage;
      setInputValue(''); setImages([]); setAttachedFiles([]);
      if (alwaysAllow) {
        applySettingValue(settingRequested.key, settingRequested.value);
        const done = `Done, your ${settingRequested.label} is now ${settingRequested.desc}.`;
        setMessages(prev => [...prev, { role: 'assistant' as const, content: done }]);
        saveChatToHistory([...newMessages, { role: 'assistant' as const, content: done }]);
        return;
      }
      const ask = `I can set your ${settingRequested.label} to ${settingRequested.desc}. Do you allow me to change that setting?`;
      setMessages(prev => [...prev, { role: 'assistant' as const, content: ask }]);
      saveChatToHistory([...newMessages, { role: 'assistant' as const, content: ask }]);
      setPendingSetting(settingRequested);
      return;
    }
    let themeRequested = parseThemeRequest(raw);
    if (themeRequested) {
      const ok = requestThemeChange(themeRequested.a, themeRequested.b, themeRequested.label);
      if (!ok) {
        const userMessage = raw; const shots = images.map(i => String(i.data || '')).filter(Boolean).slice(0, 4);
        const newMessages = [...messages, { role: 'user' as const, content: userMessage, imgs: shots.length ? shots : undefined }];
        setMessages(newMessages); lastUserRef.current = userMessage; lastImgsRef.current = shots.length ? shots : undefined;
        setInputValue(''); setImages([]); setAttachedFiles([]);
        const ask = `I can change your background to "${themeRequested.label}" - do you allow me to update your website colors?`;
        setMessages(prev => [...prev, { role: 'assistant' as const, content: ask }]);
        saveChatToHistory([...newMessages, { role: 'assistant' as const, content: ask }]);
        return;
      }
    }
    const userMessage = raw; const shots = images.map(i => String(i.data || '')).filter(Boolean).slice(0, 4);
    const newMessages = [...messages, { role: 'user' as const, content: userMessage, imgs: shots.length ? shots : undefined }];
    setMessages(newMessages); lastUserRef.current = userMessage; lastImgsRef.current = shots.length ? shots : undefined;
    setInputValue(''); setImages([]); setAttachedFiles([]);
    setIsThinking(true); setStreamText(''); setFullResponse(''); setShowContinue(false);
    let reply = 'batprox-ai could not answer right now.';
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 45000);
      const payload: any = { prompt: userMessage || 'The user sent an image.', messages: newMessages.slice(-12).map(mm => ({ role: mm.role, content: mm.content })), user: localStorage.getItem('batprox-user') || 'anonymous', model: selectedModel.id, images: shots };
      const r = await fetch('/api/ai/batprox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const d = await r.json(); if (d && typeof d.response === 'string' && d.response.trim()) reply = d.response; }
      else { const d = await r.json().catch(() => ({})); reply = d.error ? `batprox-ai: ${d.error}` : 'batprox-ai could not answer right now.'; }
    } catch { reply = 'batprox-ai could not answer right now.'; }
    if (raw.toLowerCase().includes('how long was i on this website')) reply = `You have been active on this website for ${siteTime}.`;
    if (raw.toLowerCase().includes('what did chatroom talked about')) reply = `The chatroom recently discussed upcoming platform updates, new AI models, UI tweaks, and web mini-games!`;
    const toolMatch = reply.match(/"name"\s*:\s*"update_settings".*?"new"\s*:\s*"([^"]+)"/s);
    if (toolMatch) {
      const themeName = toolMatch[1];
      const doApply = () => {
        try {
          const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
          s.theme = themeName; localStorage.setItem('batprox-settings', JSON.stringify(s));
          applyTheme(themeName);
        } catch { applyTheme(themeName); }
      };
      if (alwaysAllow) doApply();
      else {
        const a = themeName === 'Moon' ? '#38bdf8' : '#e5e7eb'; const b = '#6366f1';
        setPendingTheme({ a, b, label: themeName });
        setIsThinking(false);
        startFluidStream(reply + `\n\nI can switch you to "${themeName}" - allow me to update your settings?`);
        return;
      }
    }
    setIsThinking(false);
    startFluidStream(reply);
  };

  const handleContinue = async () => {
    if (!fullResponse) return;
    setShowContinue(false);
    const base = fullResponse;
    setStreamText(base);
    const ctrl = new AbortController();
    try {
      const r = await fetch('/api/ai/batprox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Continue where you left off. Previous response: ' + base.slice(-600), messages: [...messages, { role: 'assistant' as const, content: base }].slice(-12).map(m => ({ role: m.role, content: m.content })), user: localStorage.getItem('batprox-user') || 'anonymous' }), signal: ctrl.signal });
      if (r.ok) { const d = await r.json(); const extra = (d.response || '').trim(); if (extra) {
        const combined = base + '\n\n' + extra;
        setFullResponse(combined);
        streamInto(combined, base.length, setStreamText, () => { setIsThinking(false); if (isTruncated(combined)) setShowContinue(true); else { setMessages(prev => [...prev, { role: 'assistant' as const, content: combined }]); saveChatToHistory([...messages, { role: 'assistant' as const, content: combined }]); setStreamText(''); setFullResponse(''); } }, typingRef);
        return;
      } }
    } catch {}
    setMessages(prev => [...prev, { role: 'assistant' as const, content: base }]); saveChatToHistory([...messages, { role: 'assistant' as const, content: base }]); setStreamText(''); setFullResponse(''); setIsThinking(false);
  };

  const handleSuggestionClick = (prompt: string) => {
    let formatted = prompt; if (prompt.includes('Change my background theme design to ____')) formatted = 'Change my background theme design to '; setInputValue(formatted); inputRef.current?.focus();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

  return (
    <div className="relative min-h-screen w-full bg-[#050507] text-white flex flex-col justify-between overflow-hidden font-sans" onDragEnter={onDragEnter} onDragOver={e => e.preventDefault()} onDragLeave={onDragLeave} onDrop={handleDrop}>
      <div className="absolute inset-0 pointer-events-none opacity-40 z-0" style={{ backgroundSize: '36px 36px', backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[120px] pointer-events-none transition-all duration-700 ease-in-out z-0" style={{ background: themeGlow }} />
      <style>{`@keyframes bpPulse{0%,100%{transform:scale(0.9);opacity:0.5}50%{transform:scale(1.14);opacity:1;box-shadow:0 0 10px rgba(168,85,247,0.75)}} @keyframes bpFloat{0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}} @keyframes bpGlowMelt{0%{filter:blur(3px);opacity:0}100%{filter:blur(0);opacity:1}} .bp-word{display:inline-block;will-change:transform,opacity;animation:bpFloat 360ms cubic-bezier(0.16,1,0.3,1) both, bpGlowMelt 360ms ease-out both} .bp-stream{filter:drop-shadow(0 0 5px rgba(168,85,247,0.18))}`}</style>
      {dragging && (<div className="fixed inset-0 z-[60] bg-purple-600/10 backdrop-blur-sm border-2 border-dashed border-purple-500/60 flex items-center justify-center pointer-events-none"><div className="text-center"><p className="text-lg font-medium text-purple-200">drop your files here</p><p className="text-xs text-purple-300/60 mt-1">images, folders and .zip archives are supported</p></div></div>)}

      <header className="relative z-20 w-full max-w-6xl mx-auto pt-4 px-4">
        <div className="bg-[#0e0c15]/80 backdrop-blur-md border border-[#262035] rounded-full px-4 py-2 flex items-center justify-between shadow-2xl">
          <div className="relative">
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="h-10 px-4 flex items-center gap-2 bg-[#211833] hover:bg-[#2b2042] text-[#d1c7e9] text-sm font-medium rounded-full border border-[#3b2d5a] transition duration-200">
              <span>Chat History</span><IconChevron open={isHistoryOpen} />
            </button>
            {isHistoryOpen && (
              <div className="absolute top-12 left-0 w-80 max-h-96 overflow-y-auto bg-[#120e1d] border border-[#2d2345] rounded-xl shadow-2xl p-2 z-50">
                <div className="text-xs font-semibold text-purple-300/60 px-3 py-1.5 uppercase tracking-wider">Recent Conversations</div>
                <div className="space-y-1 px-2">
                  <button onClick={startNewChat} className="w-full px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/45 text-purple-200 border border-purple-500/30 text-xs">+ New Chat</button>
                  {chatHistory.length === 0 ? <div className="text-center text-gray-500 text-xs py-4">No chat history</div> : chatHistory.map(chat => (
                    <div key={chat.id} onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, chatId: chat.id }); }} onClick={() => { loadChat(chat.id); setIsHistoryOpen(false); }} className={`px-3 py-2 rounded-lg cursor-pointer text-xs truncate flex items-center gap-2 ${currentChatId === chat.id ? 'bg-purple-600/25 border border-purple-500/40 text-white' : 'bg-white/[0.03] hover:bg-white/[0.08] text-gray-300'}`}>
                      <span className="truncate flex-1">{chat.title}<span className="block text-[10px] text-white/25">{new Date(chat.timestamp).toLocaleDateString()} · {chat.messages.length} msgs</span></span>
                      <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/dashboard')} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><IconArrow /><span>Go back</span></button>
            <button onClick={() => setShowSettingsModal(true)} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><IconSettings /><span>Settings</span></button>
            <button onClick={() => navigate('/more-games')} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><IconGame /><span>More Games</span></button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 max-w-4xl w-full mx-auto overflow-y-auto my-4">
        {messages.length === 0 && !isThinking && !streamText ? (
          <div className="w-full flex flex-col items-center justify-center text-center space-y-6 my-auto">
            <div className="space-y-2"><h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#a08cc6] drop-shadow-[0_0_25px_rgba(160,140,198,0.3)]">batprox-ai</h1><p className="text-purple-300/60 text-lg md:text-xl font-medium tracking-wide">Ask me anything...</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-2xl pt-2">
              <button onClick={() => handleSuggestionClick("How long was i on this website for?")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><IconClock /></div><span>How long was i on this website for?</span></button>
              <button onClick={() => handleSuggestionClick("Change my background theme design to ____")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><IconBrush /></div><span>Change my background theme design to ____</span></button>
              <button onClick={() => handleSuggestionClick("What did chatroom talked about?")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><IconMsg /></div><span>What did chatroom talked about?</span></button>
            </div>

          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4 py-4 my-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (<div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><IconSpark /></div>)}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed select-text ${msg.role === 'user' ? 'bg-[#3b2866] text-white rounded-br-none border border-purple-400/20 shadow-lg' : String(msg.content).includes('has been stopped by') ? 'bg-red-950/60 text-red-200 rounded-bl-none border border-red-500/30 shadow-md' : 'bg-[#120e1e] text-purple-100 rounded-bl-none border border-[#2d2248] shadow-md'}`}>
                  {msg.role === 'assistant' ? <div className="select-text prose prose-invert max-w-none"><ReactMarkdown components={{ code({ inline, className, children, ...props }: any) { const txt = String(children).replace(/\n$/, ''); if (inline || (!className && !txt.includes('\n'))) return <code className="px-1 py-0.5 rounded bg-white/10 text-purple-200 text-xs" {...props}>{children}</code>; const id = txt.slice(0, 40); return <div className="relative group my-2 rounded-xl overflow-hidden border border-white/10 bg-black/40"><div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/10"><span className="text-[10px] tracking-widest text-white/30">{(className || '').replace('language-', '') || 'code'}</span><button onClick={() => { navigator.clipboard.writeText(txt).then(() => { setCopiedCode(id); setTimeout(() => setCopiedCode(null), 1500); }); }} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-[11px] border border-white/10 transition">{copiedCode === id ? 'copied' : 'copy code'}</button></div><pre className="p-3 overflow-x-auto text-xs leading-relaxed"><code className={className} {...props}>{txt}</code></pre></div>; } }}>{String(msg.content || "")}</ReactMarkdown></div> : <span className="whitespace-pre-wrap break-words select-text">{msg.content}</span>}
                  {Array.isArray((msg as any).imgs) && (msg as any).imgs.length > 0 && (<div className="flex flex-wrap gap-2 mt-2">{(msg as any).imgs.map((src: string, ii: number) => (<a key={ii} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="max-w-[220px] max-h-[220px] rounded-xl border border-white/15" /></a>))}</div>)}
                </div>
                {msg.role === 'user' && (<div className="w-8 h-8 rounded-full bg-[#271d42] border border-purple-400/20 flex items-center justify-center shrink-0"><IconUser /></div>)}
              </div>
            ))}
            {pendingTheme && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><IconSpark /></div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#120e1e] border border-[#2d2248] shadow-md">
                  <p className="text-xs text-purple-200 mb-3">Allow BatProx AI to change your background to <span className="font-semibold" style={{ color: pendingTheme.a }}>{pendingTheme.label}</span>?</p>
                  <div className="flex gap-2">
                    <button onClick={() => { applyCustomGradient(pendingTheme.a, pendingTheme.b); setPendingTheme(null); setMessages(prev => [...prev, { role: 'assistant' as const, content: `Background updated to ${pendingTheme.label}.` }]); }} className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold">Allow permission</button>
                    <button onClick={() => setPendingTheme(null)} className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 text-xs border border-white/10">Decline permission</button>
                    <button onClick={() => { try { localStorage.setItem('bp-ai-always-allow', '1'); setAlwaysAllow(true); } catch {}; const u = (() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } })(); if (u) fetch('/api/ai/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u, alwaysAllow: true }) }).catch(() => {}); applyCustomGradient(pendingTheme.a, pendingTheme.b); setPendingTheme(null); setMessages(prev => [...prev, { role: 'assistant' as const, content: `Always allowed - background updated to ${pendingTheme.label} and future changes will apply automatically.` }]); }} className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">Always Allow</button>
                  </div>
                </div>
              </div>
            )}
            {pendingSetting && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><IconSpark /></div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#120e1e] border border-[#2d2248] shadow-md">
                  <p className="text-[10px] uppercase tracking-widest text-purple-300/50 mb-1.5">permission request</p>
                  <p className="text-xs text-purple-200 mb-3">Allow BatProx AI to set your <span className="font-semibold text-white">{pendingSetting.label}</span> to <span className="font-semibold text-white">{pendingSetting.desc}</span>?</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => confirmSetting(pendingSetting, false)} className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold">Allow permission</button>
                    <button onClick={() => { setPendingSetting(null); setMessages(prev => [...prev, { role: 'assistant' as const, content: 'No problem, I left that setting alone.' }]); }} className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 text-xs border border-white/10">Decline permission</button>
                    <button onClick={() => confirmSetting(pendingSetting, true)} className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">Always Allow</button>
                  </div>
                </div>
              </div>
            )}
            {(isThinking || streamText) && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><IconSpark /></div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#120e1e] text-purple-100 rounded-bl-none border border-[#2d2248] shadow-md min-h-[44px] flex items-center bp-stream select-text">
                  {isThinking ? (
                    <span className="flex items-center gap-1.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0s infinite' }} />
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0.15s infinite' }} />
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0.3s infinite' }} />
                    </span>
                  ) : (
                    <span className="leading-relaxed">{streamText.split(/(\s+)/).map((w, i) => w.trim() ? <span key={i} className="bp-word" style={{ animationDelay: `${i * 10}ms` }}>{w}</span> : w)}</span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <footer className="relative z-30 w-full max-w-2xl mx-auto pb-6 px-4">
        {(isThinking || streamText) && (
          <div className="flex justify-center mb-2">
            <button onClick={handleStop} className="px-5 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg transition border border-red-400/30">Stop</button>
          </div>
        )}
        {showContinue && (
          <div className="flex justify-center mb-2">
            <button onClick={handleContinue} className="px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition">Continue</button>
          </div>
        )}
        <div className="relative bg-[#0d0a14]/90 backdrop-blur-xl border border-[#231a38] rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="relative inline-block">
              <button onClick={() => { setIsModelMenuOpen(!isModelMenuOpen); setVersionFor(null); }} className="flex items-center gap-2 bg-[#171126] hover:bg-[#231a38] border border-[#2f234a] rounded-lg px-3 py-1.5 text-xs text-purple-200 transition">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="font-medium">{selectedModel.id}</span><IconChevron open={isModelMenuOpen} />
              </button>
            {isModelMenuOpen && (
              <div onMouseLeave={() => setVersionFor(null)} className="absolute bottom-full left-0 mb-2 w-64 bg-[#120d21] border border-[#31254d] rounded-xl shadow-2xl p-1.5 z-50">
                <div className="text-[11px] font-semibold text-purple-400/60 px-3 py-1 uppercase tracking-wider">Our AI models</div>
                <div className="space-y-1">{availableModels.map(m => (
                  <div key={m.id} className="relative" onContextMenu={e => { if (m.id !== 'batprox-ai') return; e.preventDefault(); setVersionFor(versionFor === m.id ? null : m.id); }}>
                    <div className={`w-full rounded-lg text-xs flex items-center transition ${selectedModel.id === m.id ? 'bg-[#281c45] text-purple-100 font-medium' : 'text-purple-300/70 hover:bg-[#1a1330] hover:text-purple-200'} ${m.status === 'offline' ? 'opacity-50' : ''}`}>
                      <button onClick={() => { if (m.status === 'online') { setSelectedModel(m); setIsModelMenuOpen(false); setVersionFor(null); } }} className={`flex-1 min-w-0 text-left pl-3 pr-2 py-2 flex items-center justify-between gap-2 ${m.status === 'offline' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="flex items-center gap-2 min-w-0"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'}`} /><span className="truncate">{m.name}</span></span>{m.badge && <span className="shrink-0 text-[10px] bg-purple-950 border border-purple-700/40 text-purple-300 px-1.5 py-0.5 rounded">{m.badge}</span>}
                      </button>
                      {m.id === 'batprox-ai' ? (
                        <button
                          onMouseEnter={() => setVersionFor(m.id)}
                          onClick={() => setVersionFor(versionFor === m.id ? null : m.id)}
                          aria-label="Other versions"
                          className={`mr-1 w-6 h-6 shrink-0 rounded-md flex items-center justify-center transition ${versionFor === m.id ? 'bg-purple-500/25 text-purple-100' : 'text-purple-300/60 hover:text-purple-100 hover:bg-white/10'}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      ) : <span className="mr-1 w-6 shrink-0" />}
                    </div>
                    {versionFor === m.id && (
                      <div className="absolute left-full top-0 ml-2 w-60 bg-[#120d21] border border-[#31254d] rounded-xl shadow-2xl p-1.5 z-50" style={{ animation: 'bpFly .16s ease-out' }}>
                        <style>{'@keyframes bpFly{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:none}}'}</style>
                        <div className="text-[11px] font-semibold text-purple-400/60 px-3 py-1 uppercase tracking-wider">Model versions</div>
                        <div className="px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 text-purple-300/55 cursor-not-allowed select-none">
                          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" />BatProx AI v2.0</span>
                          <span className="text-[10px] bg-purple-950/70 border border-purple-700/30 text-purple-300/70 px-1.5 py-0.5 rounded whitespace-nowrap">coming soon</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}</div>
              </div>
            )}
            </div>
            <button onClick={startNewChat} className="h-7 px-3 rounded-full bg-[#211833] hover:bg-[#2b2042] text-[#d1c7e9] text-xs font-medium border border-[#3b2d5a] transition">+ New Chat</button>
          </div>
          {attachedFiles.length > 0 && (<div className="flex flex-wrap gap-2">{attachedFiles.map(f => (<div key={f.id} className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white/85"><span className="truncate max-w-[180px]">{f.label || f.file.name}</span><button onClick={() => setAttachedFiles(prev => prev.filter(x => x.id !== f.id))} className="w-5 h-5 rounded-full bg-red-500/80 text-white">×</button></div>))}</div>)}
          {images.length > 0 && (<div className="flex flex-wrap gap-2">{images.map(img => (<div key={img.id} className="relative group"><img src={img.data} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/20" /><button onClick={() => removeImage(img.id)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100">×</button></div>))}</div>)}
          <div className="flex items-center gap-3 bg-[#120d20] border border-[#271d3d] focus-within:border-purple-500/50 rounded-xl px-3.5 py-2.5 shadow-inner">
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-purple-400/60 hover:text-purple-300 hover:bg-[#1f1638] rounded-lg shrink-0"><IconImage /></button>
            <textarea ref={inputRef} value={inputValue} onChange={e => { setInputValue(e.target.value); const el = e.target; el.style.height = '28px'; if (el.scrollHeight > 30) el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} onKeyDown={handleKeyDown} onPaste={handlePaste} rows={1} placeholder="Ask BatProx AI anything.." className="w-full bg-transparent text-sm text-purple-100 placeholder-purple-400/40 focus:outline-none resize-none py-1 min-h-[28px]" />
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => folderInputRef.current?.click()} className="p-1.5 text-purple-400/60 hover:text-purple-300 hover:bg-[#1f1638] rounded-lg"><IconFolder /></button>
              <button onClick={() => handleSendMessage()} disabled={!inputValue.trim() && images.length === 0} className={`p-2 rounded-lg transition ${inputValue.trim() || images.length ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md' : 'text-purple-400/30'}`}><IconSend /></button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); files.forEach(file => { const reader = new FileReader(); reader.onload = ev => { const d = ev.target?.result as string; setImages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), data: d, file }]); }; reader.readAsDataURL(file); }); e.target.value = ''; }} />
          <input ref={folderInputRef} type="file" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []).map(f => { const rel = (f as any).webkitRelativePath || ''; const folder = rel.includes('/') ? rel.split('/')[0] : f.name; return { file: f, label: folder }; }); addFiles(files); e.target.value = ''; }} />
        </div>
      </footer>
      <aside className="fixed bottom-6 right-6 hidden md:flex flex-col gap-2 z-40"><div className="bg-[#120e1d]/80 border border-[#2d2345] backdrop-blur-md rounded-2xl p-2 flex flex-col gap-2 shadow-xl text-purple-300/80"><button className="p-2.5 hover:bg-[#21183d] rounded-xl"><IconFolder /></button><button className="p-2.5 hover:bg-[#21183d] rounded-xl"><IconLayers /></button></div></aside>
      <Settings isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      {contextMenu && (<><div className="fixed z-50 bg-black/90 border border-white/20 rounded-xl shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={() => setContextMenu(null)}><button onClick={() => deleteChat(contextMenu.chatId)} className="px-4 py-3 text-red-400 hover:bg-red-500/20 text-sm w-full text-left rounded-xl">Delete Chat</button></div><div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} /></>)}
    </div>
  );
}
