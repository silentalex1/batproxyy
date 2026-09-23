import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Cookies from 'js-cookie';
import Settings from './Settings';
import { startPresence } from './presence';
import { useLowPower } from './power';
const ChevronDown=(p:any)=>(<span {...p}>▼</span>); const ChevronUp=(p:any)=>(<span {...p}>▲</span>); const ArrowLeft=(p:any)=>(<span {...p}>←</span>); const SettingsIcon=(p:any)=>(<span {...p}>⚙</span>); const Gamepad2=(p:any)=>(<span {...p}>🎮</span>); const ImageIcon=(p:any)=>(<span {...p}>🖼</span>); const Folder=(p:any)=>(<span {...p}>📁</span>); const Send=(p:any)=>(<span {...p}>➤</span>); const User=(p:any)=>(<span {...p}>👤</span>); const Sparkles=(p:any)=>(<span {...p}>✦</span>); const Clock=(p:any)=>(<span {...p}>◷</span>); const Paintbrush=(p:any)=>(<span {...p}>🎨</span>); const MessageSquare=(p:any)=>(<span {...p}>💬</span>); const Layers=(p:any)=>(<span {...p}>▦</span>);

interface ChatHistory {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; terminal?: string[]; imgs?: string[] }>;
  timestamp: number;
  checkpoints?: Array<{ id: string; messageIndex: number; timestamp: number }>;
}
interface Model { id: string; name: string; badge?: string; status: string; }

export default function AIWork() {
  const navigate = useNavigate();
  const [localOnline, setLocalOnline] = useState<boolean | null>(null); void localOnline;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isDropdownOpen, _setIsDropdownOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [startTime] = useState<number>(Date.now());
  const [siteTime, setSiteTime] = useState<string>('0 seconds');
  const [themeGlow, setThemeGlow] = useState<string>('rgba(147, 51, 234, 0.18)');
  const [selectedModel, setSelectedModel] = useState<Model>({ id: 'batprox-ai', name: 'BatProx AI', status: 'online' });
  const availableModels: Model[] = [
    { id: 'batprox-ai', name: 'BatProx AI', badge: 'Active', status: 'online' },
    { id: 'inferforge-code', name: 'Inferforge-code', badge: 'Code', status: 'online' },
  ];
  // Fluid Glow Stream state
  const [isThinking, setIsThinking] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [fullResponse, setFullResponse] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const [isPaused, setIsPaused] = useState(false); void isPaused;
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // history sync
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

  const startFluidStream = (text: string) => {
    setFullResponse(text); setStreamText(''); setShowContinue(false); setIsPaused(false);
    let idx = 0;
    if (typingRef.current) clearInterval(typingRef.current);
    typingRef.current = setInterval(() => {
      if (idx < text.length) {
        // reveal word by word for liquid float effect — we reveal char by char but CSS handles word float
        idx = Math.min(text.length, idx + 7);
        setStreamText(text.slice(0, idx));
        if (idx >= text.length) { clearInterval(typingRef.current!); setIsThinking(false); // detect if truncated (backend cut at limit) show Continue
          if (text.length >= 1500) setShowContinue(true); else { saveChatToHistory([...messages, { role: 'user' as const, content: lastUserRef.current, imgs: lastImgsRef.current } as any, { role: 'assistant' as const, content: text } as any]); }
        }
      }
    }, 18);
  };
  const lastUserRef = useRef('');
  const lastImgsRef = useRef<string[] | undefined>(undefined);

  const handleSendMessage = async (textOverride?: string) => {
    const raw = (textOverride ?? inputValue).trim();
    if (!raw && images.length === 0) return;
    // theme / time shortcuts kept from provided code
    if (raw.toLowerCase().includes('change my background theme design to')) {
      const themeName = raw.replace(/change my background theme design to/i, '').trim();
      if (themeName) {
        if (themeName.toLowerCase().includes('blue')) setThemeGlow('rgba(59, 130, 246, 0.25)');
        else if (themeName.toLowerCase().includes('green')) setThemeGlow('rgba(34, 197, 94, 0.25)');
        else if (themeName.toLowerCase().includes('red') || themeName.toLowerCase().includes('crimson')) setThemeGlow('rgba(239, 68, 68, 0.25)');
        else if (themeName.toLowerCase().includes('gold') || themeName.toLowerCase().includes('yellow')) setThemeGlow('rgba(234, 179, 8, 0.25)');
        else setThemeGlow('rgba(168, 85, 247, 0.3)');
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
      const note = shots.length ? ' [The user attached ' + shots.length + ' image(s). You cannot view images, so ask them to describe it.]' : '';
      const payload = { prompt: (userMessage || 'The user sent an image with no text.') + note, messages: newMessages.slice(-12).map(mm => ({ role: mm.role, content: mm.content })), user: localStorage.getItem('batprox-user') || 'anonymous', model: selectedModel.id };
      const r = await fetch('/api/ai/batprox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const d = await r.json(); if (d && typeof d.response === 'string' && d.response.trim()) reply = d.response; }
      else { const d = await r.json().catch(() => ({})); reply = d.error ? `batprox-ai: ${d.error}` : 'batprox-ai could not answer right now.'; }
    } catch { reply = 'batprox-ai could not answer right now.'; }
    // handle time question locally if AI didn't
    if (raw.toLowerCase().includes('how long was i on this website')) reply = `You have been active on this website for ${siteTime}.`;
    if (raw.toLowerCase().includes('what did chatroom talked about')) reply = `The chatroom recently discussed upcoming platform updates, new AI models, UI tweaks, and web mini-games!`;
    setIsThinking(false);
    startFluidStream(reply);
    // push assistant placeholder now, will be updated as stream progresses via messages? We keep streamText separate and append on done
    // Do not push yet; stream will be shown as thinking+stream area, on complete we push
  };

  const handleContinue = async () => {
    if (!fullResponse) return;
    setShowContinue(false); setIsPaused(false);
    const ctrl = new AbortController();
    try {
      const r = await fetch('/api/ai/batprox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Continue where you left off. Previous response: ' + fullResponse.slice(-400), messages: [...messages, { role: 'assistant' as const, content: fullResponse }].slice(-12).map(m => ({ role: m.role, content: m.content })), user: localStorage.getItem('batprox-user') || 'anonymous' }), signal: ctrl.signal });
      if (r.ok) { const d = await r.json(); const extra = (d.response || '').trim(); if (extra) { const combined = fullResponse + '\n\n' + extra; startFluidStream(combined); return; } }
    } catch {}
    // fallback: just finalize current
    setMessages(prev => [...prev, { role: 'assistant' as const, content: fullResponse }]); saveChatToHistory([...messages, { role: 'assistant' as const, content: fullResponse }]); setStreamText(''); setFullResponse('');
  };

  const handleSuggestionClick = (prompt: string) => {
    let formatted = prompt; if (prompt.includes('Change my background theme design to ____')) formatted = 'Change my background theme design to '; setInputValue(formatted); inputRef.current?.focus();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

  return (
    <div className="relative min-h-screen w-full bg-[#050507] text-white flex flex-col justify-between overflow-hidden font-sans select-none" onDragEnter={onDragEnter} onDragOver={e => e.preventDefault()} onDragLeave={onDragLeave} onDrop={handleDrop}>
      <div className="absolute inset-0 pointer-events-none opacity-40 z-0" style={{ backgroundSize: '36px 36px', backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[120px] pointer-events-none transition-all duration-700 ease-in-out z-0" style={{ background: themeGlow }} />
      <style>{`@keyframes bpPulse {0%,100%{transform:scale(0.85);opacity:0.6}50%{transform:scale(1.15);opacity:1}} @keyframes bpFloat {0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}} .bp-word{ display:inline-block; animation: bpFloat 0.35s ease-out forwards; }`}</style>
      {dragging && (<div className="fixed inset-0 z-[60] bg-purple-600/10 backdrop-blur-sm border-2 border-dashed border-purple-500/60 flex items-center justify-center pointer-events-none"><div className="text-center"><p className="text-lg font-medium text-purple-200">drop your files here</p><p className="text-xs text-purple-300/60 mt-1">images, folders and .zip archives are supported</p></div></div>)}

      <header className="relative z-20 w-full max-w-6xl mx-auto pt-4 px-4">
        <div className="bg-[#0e0c15]/80 backdrop-blur-md border border-[#262035] rounded-full px-4 py-2 flex items-center justify-between shadow-2xl">
          <div className="relative">
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="h-10 px-4 flex items-center gap-2 bg-[#211833] hover:bg-[#2b2042] text-[#d1c7e9] text-sm font-medium rounded-full border border-[#3b2d5a] transition duration-200">
              <span>Chat History</span><ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`} />
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
            <button onClick={() => navigate('/dashboard')} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><ArrowLeft className="w-4 h-4" /><span>Go back</span></button>
            <button onClick={() => setShowSettingsModal(true)} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><SettingsIcon className="w-4 h-4" /><span>Settings</span></button>
            <button onClick={() => navigate('/more-games')} className="h-10 px-4 flex items-center gap-1.5 bg-[#171322] hover:bg-[#221c32] text-gray-300 hover:text-white text-xs md:text-sm font-medium rounded-full border border-[#2b233e] transition"><Gamepad2 className="w-4 h-4" /><span>More Games</span></button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 max-w-4xl w-full mx-auto overflow-y-auto my-4">
        {messages.length === 0 && !isThinking && !streamText ? (
          <div className="w-full flex flex-col items-center justify-center text-center space-y-8 my-auto animate-in fade-in duration-500">
            <div className="space-y-2"><h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#a08cc6] drop-shadow-[0_0_25px_rgba(160,140,198,0.3)]">batprox-ai</h1><p className="text-purple-300/60 text-lg md:text-xl font-medium tracking-wide">Ask me anything...</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-2xl pt-2">
              <button onClick={() => handleSuggestionClick("How long was i on this website for?")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><Clock className="w-4 h-4" /></div><span>"How long was i on this website for?"</span></button>
              <button onClick={() => handleSuggestionClick("Change my background theme design to ____")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><Paintbrush className="w-4 h-4" /></div><span>"Change my background theme design to ____"</span></button>
              <button onClick={() => handleSuggestionClick("What did chatroom talked about?")} className="p-4 bg-[#120e1e]/90 hover:bg-[#1c1530] border border-[#2b2046] hover:border-[#4d387b] rounded-2xl text-purple-200 text-xs md:text-sm font-medium transition shadow-lg flex flex-col items-start justify-between text-left h-28"><div className="p-2 rounded-lg bg-[#1f1636] text-purple-400 border border-purple-500/20"><MessageSquare className="w-4 h-4" /></div><span>"What did chatroom talked about?"</span></button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4 py-4 my-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (<div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-purple-300" /></div>)}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#3b2866] text-white rounded-br-none border border-purple-400/20 shadow-lg' : 'bg-[#120e1e] text-purple-100 rounded-bl-none border border-[#2d2248] shadow-md'}`}>
                  {msg.role === 'assistant' ? <ReactMarkdown>{String(msg.content || "")}</ReactMarkdown> : <span className="whitespace-pre-wrap break-words">{msg.content}</span>}
                  {Array.isArray((msg as any).imgs) && (msg as any).imgs.length > 0 && (<div className="flex flex-wrap gap-2 mt-2">{(msg as any).imgs.map((src: string, ii: number) => (<a key={ii} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="max-w-[220px] max-h-[220px] rounded-xl border border-white/15" /></a>))}</div>)}
                </div>
                {msg.role === 'user' && (<div className="w-8 h-8 rounded-full bg-[#271d42] border border-purple-400/20 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-purple-200" /></div>)}
              </div>
            ))}
            {(isThinking || streamText) && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-purple-300" /></div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#120e1e] text-purple-100 rounded-bl-none border border-[#2d2248] shadow-md min-h-[44px] flex items-center">
                  {isThinking ? (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0s infinite' }} />
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0.15s infinite' }} />
                      <span className="w-2 h-2 rounded-full bg-purple-400" style={{ animation: 'bpPulse 0.9s ease-in-out 0.3s infinite' }} />
                      <span className="text-[11px] text-purple-300/50 ml-2">thinking</span>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none leading-relaxed">
                      <span>{streamText.split(/(\s+)/).map((w, i) => w.trim() ? <span key={i} className="bp-word" style={{ animationDelay: `${i * 12}ms` }}>{w}</span> : w)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <footer className="relative z-30 w-full max-w-2xl mx-auto pb-6 px-4">
        {showContinue && (
          <div className="flex justify-center mb-2">
            <button onClick={handleContinue} className="px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition">Continue</button>
          </div>
        )}
        <div className="relative bg-[#0d0a14]/90 backdrop-blur-xl border border-[#231a38] rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5">
          <div className="relative inline-block self-start">
            <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className="flex items-center gap-2 bg-[#171126] hover:bg-[#231a38] border border-[#2f234a] rounded-lg px-3 py-1.5 text-xs text-purple-200 transition">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="font-medium">{selectedModel.id}</span><ChevronUp className={`w-3.5 h-3.5 text-purple-400 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isModelMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#120d21] border border-[#31254d] rounded-xl shadow-2xl p-1.5 z-50">
                <div className="text-[11px] font-semibold text-purple-400/60 px-3 py-1 uppercase tracking-wider">Our AI models</div>
                <div className="space-y-1">{availableModels.map(m => (
                  <button key={m.id} onClick={() => { if (m.status === 'online') { setSelectedModel(m); setIsModelMenuOpen(false); } }} className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${selectedModel.id === m.id ? 'bg-[#281c45] text-purple-100 font-medium' : 'text-purple-300/70 hover:bg-[#1a1330] hover:text-purple-200'} ${m.status === 'offline' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'}`} /><span>{m.name}</span></div>{m.badge && <span className="text-[10px] bg-purple-950 border border-purple-700/40 text-purple-300 px-1.5 py-0.5 rounded">{m.badge}</span>}
                  </button>
                ))}</div>
              </div>
            )}
          </div>
          {attachedFiles.length > 0 && (<div className="flex flex-wrap gap-2">{attachedFiles.map(f => (<div key={f.id} className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white/85"><span className="truncate max-w-[180px]">{f.label || f.file.name}</span><button onClick={() => setAttachedFiles(prev => prev.filter(x => x.id !== f.id))} className="w-5 h-5 rounded-full bg-red-500/80 text-white">×</button></div>))}</div>)}
          {images.length > 0 && (<div className="flex flex-wrap gap-2">{images.map(img => (<div key={img.id} className="relative group"><img src={img.data} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/20" /><button onClick={() => removeImage(img.id)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100">×</button></div>))}</div>)}
          <div className="flex items-center gap-3 bg-[#120d20] border border-[#271d3d] focus-within:border-purple-500/50 rounded-xl px-3.5 py-2.5 shadow-inner">
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-purple-400/60 hover:text-purple-300 hover:bg-[#1f1638] rounded-lg shrink-0"><ImageIcon className="w-5 h-5" /></button>
            <textarea ref={inputRef} value={inputValue} onChange={e => { setInputValue(e.target.value); const el = e.target; el.style.height = '28px'; if (el.scrollHeight > 30) el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} onKeyDown={handleKeyDown} onPaste={handlePaste} rows={1} placeholder="Ask BatProx AI anything.." className="w-full bg-transparent text-sm text-purple-100 placeholder-purple-400/40 focus:outline-none resize-none py-1 min-h-[28px]" />
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => folderInputRef.current?.click()} className="p-1.5 text-purple-400/60 hover:text-purple-300 hover:bg-[#1f1638] rounded-lg"><Folder className="w-5 h-5" /></button>
              <button onClick={() => handleSendMessage()} disabled={!inputValue.trim() && images.length === 0} className={`p-2 rounded-lg transition ${inputValue.trim() || images.length ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md' : 'text-purple-400/30'}`}><Send className="w-4 h-4" /></button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); files.forEach(file => { const reader = new FileReader(); reader.onload = ev => { const d = ev.target?.result as string; setImages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), data: d, file }]); }; reader.readAsDataURL(file); }); e.target.value = ''; }} />
          <input ref={folderInputRef} type="file" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []).map(f => { const rel = (f as any).webkitRelativePath || ''; const folder = rel.includes('/') ? rel.split('/')[0] : f.name; return { file: f, label: folder }; }); addFiles(files); e.target.value = ''; }} />
        </div>
      </footer>
      <aside className="fixed bottom-6 right-6 hidden md:flex flex-col gap-2 z-40"><div className="bg-[#120e1d]/80 border border-[#2d2345] backdrop-blur-md rounded-2xl p-2 flex flex-col gap-2 shadow-xl text-purple-300/80"><button className="p-2.5 hover:bg-[#21183d] rounded-xl"><Folder className="w-4 h-4" /></button><button className="p-2.5 hover:bg-[#21183d] rounded-xl"><Layers className="w-4 h-4" /></button></div></aside>
      <Settings isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      {contextMenu && (<><div className="fixed z-50 bg-black/90 border border-white/20 rounded-xl shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={() => setContextMenu(null)}><button onClick={() => deleteChat(contextMenu.chatId)} className="px-4 py-3 text-red-400 hover:bg-red-500/20 text-sm w-full text-left rounded-xl">Delete Chat</button></div><div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} /></>)}
    </div>
  );
}
