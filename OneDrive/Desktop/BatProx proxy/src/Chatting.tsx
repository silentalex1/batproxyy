import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Settings from './Settings';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';
import { startPresence } from './presence';
import { useLowPower } from './power';

interface Msg { id: number; room: string; user: string; display: string; text: string; ts: number; sys?: boolean; replyTo?: { user: string; text: string } | null }
interface Gc { id: string; owner: string; members: string[]; created: number }
interface DmRoom { id: string; other: string }
interface Presence { username: string; active: boolean }
interface DmInvite { id: number; from: string; to: string; status: string }

type Room = { kind: 'community' | 'dm' | 'gc'; id: string; label: string };

const dmId = (a: string, b: string) => 'dm:' + [a, b].sort().join(':');
const avatarColor = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 65%, 45%)`;
};

export default function Chatting() {
  const navigate = useNavigate();
  const location = useLocation();
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  const [isStaff, setIsStaff] = useState(false);
  const [gate, setGate] = useState(() => { try { return !localStorage.getItem('batprox-display'); } catch { return true; } });
  const [displayInput, setDisplayInput] = useState('');
  const [, setDisplay] = useState(() => { try { return localStorage.getItem('batprox-display') || ''; } catch { return ''; } });
  const [names, setNames] = useState<Record<string, string>>({});
  const [room, setRoom] = useState<Room>({ kind: 'community', id: 'community', label: 'Community' });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [dms, setDms] = useState<DmRoom[]>([]);
  const [gcs, setGcs] = useState<Gc[]>([]);
  const [online, setOnline] = useState<Presence[]>([]);
  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [card, setCard] = useState<{ username: string } | null>(null);
  const [showCreateDm, setShowCreateDm] = useState(false);
  const [dmTarget, setDmTarget] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [menuGc, setMenuGc] = useState<Gc | null>(null);
  const [invite, setInvite] = useState<{ code: string; expiresAt: number; maxUses: number } | null>(null);
  const [addMembers, setAddMembers] = useState('');
  const [dmAsk, setDmAsk] = useState<{ username: string } | null>(null);
  const [dmIncoming, setDmIncoming] = useState<DmInvite | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => void } | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<{ user: string; text: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { display: string; bio: string; pfp: string }>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: number; text: string; ts: number }>>([]);
  const [noteText, setNoteText] = useState('');
  const [ranks, setRanks] = useState<Record<string, string>>({});
  const [shiftDown, setShiftDown] = useState(false);
  const [hoverMsg, setHoverMsg] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingAt = useRef(0);
  useLowPower();

  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } })();
    if (!token || !me) { navigate('/'); return; }
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => {
      if (!d.user) { navigate('/'); return; }
      setIsStaff(!!(d.isAdmin || d.isMod || d.rank === 'moderator'));
    }).catch(() => {});
    startPresence();
  }, [me, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dm = params.get('dm');
    if (dm && me && dm !== me) setRoom({ kind: 'dm', id: dmId(me, dm), label: dm });
  }, [location.search, me]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hid = params.get('highlight');
    const hroom = params.get('room');
    if (!hid || !hroom) return;
    if (hroom !== 'community' && hroom !== room.id) {
      if (hroom.startsWith('dm:')) {
        const parts = hroom.split(':');
        const other = parts[1] === me ? parts[2] : parts[1];
        if (other) setRoom({ kind: 'dm', id: hroom, label: other });
      } else {
        setRoom({ kind: 'gc', id: hroom, label: 'Group' });
      }
      return;
    }
    const t = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-mid="${hid}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const id = parseInt(hid, 10);
          if (!isNaN(id)) setSelected(id);
        }
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [location.search, messages, room.id, me]);

  const loadNames = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/name');
      if (r.ok) { const d = await r.json(); setNames(d.names || {}); }
    } catch {}
    try {
      const r = await fetch('/api/users');
      if (r.ok) {
        const d = await r.json();
        const m: Record<string, string> = {};
        for (const u of (d.users || [])) {
          if (u.username === 'realalex' || u.username === 'admin') m[u.username] = 'admin';
          else if (u.rank === 'moderator') m[u.username] = 'moderator';
        }
        setRanks(m);
      }
    } catch {}
  }, []);

  const rankOf = (u: string) => ranks[u] || '';
  const rankPill = (u: string) => {
    const r = rankOf(u);
    if (r === 'admin') return <span className="ml-1.5 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 align-middle">ADMIN</span>;
    if (r === 'moderator') return <span className="ml-1.5 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 align-middle">MODERATOR</span>;
    return null;
  };

  const loadMessages = useCallback(async (roomId: string) => {
    try {
      const r = await fetch('/api/chat/messages?room=' + encodeURIComponent(roomId));
      if (r.ok) { const d = await r.json(); setMessages(d.messages || []); }
    } catch {}
  }, []);

  const loadLists = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch('/api/chat/dms?user=' + encodeURIComponent(me));
      if (r.ok) { const d = await r.json(); setDms(d.rooms || []); }
    } catch {}
    try {
      const r = await fetch('/api/chat/rooms?user=' + encodeURIComponent(me));
      if (r.ok) { const d = await r.json(); setGcs(d.rooms || []); }
    } catch {}
    try {
      const r = await fetch('/api/presence');
      if (r.ok) { const d = await r.json(); setOnline((d.users || []).filter((u: Presence) => u.username && u.username !== 'anonymous')); }
    } catch {}
    loadNames();
  }, [me, loadNames]);

  const checkDmInvites = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch('/api/chat/dm-invites?user=' + encodeURIComponent(me));
      if (!r.ok) return;
      const d = await r.json();
      const list: DmInvite[] = d.invites || [];
      if (list.length > 0 && !dmIncoming) setDmIncoming(list[0]);
    } catch {}
  }, [me, dmIncoming]);

  useEffect(() => {
    if (!me || gate) return;
    loadLists();
    const loadTyping = async () => {
      try {
        const r = await fetch('/api/chat/typing?room=' + encodeURIComponent(room.id));
        if (r.ok) { const d = await r.json(); setTyping(((d.typing || []) as string[]).filter(u => u !== me)); }
      } catch {}
    };
    loadTyping();
    const a = setInterval(() => { loadMessages(room.id); loadTyping(); }, 2000);
    const b = setInterval(loadLists, 15000);
    const c = setInterval(checkDmInvites, 8000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, [me, gate, room.id, loadMessages, loadLists, checkDmInvites]);

  const loadNotes = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch('/api/notes?user=' + encodeURIComponent(me));
      if (r.ok) { const d = await r.json(); setNotes(d.notes || []); }
    } catch {}
  }, [me]);

  const saveNotes = async (next: Array<{ id: number; text: string; ts: number }>) => {
    setNotes(next);
    try {
      await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: me, notes: next }) });
    } catch {}
  };

  const loadProfiles = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/profiles');
      if (r.ok) { const d = await r.json(); setProfiles(d.profiles || {}); }
    } catch {}
  }, []);

  useEffect(() => { if (me && !gate) { loadNotes(); loadProfiles(); } }, [me, gate, loadNotes, loadProfiles]);

  const beatTyping = () => {
    if (!me) return;
    const now = Date.now();
    if (now - typingAt.current < 3000) return;
    typingAt.current = now;
    fetch('/api/chat/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: room.id, user: me }) }).catch(() => {});
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftDown(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftDown(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    if (!me) return;
    try {
      if (localStorage.getItem('batprox-display')) return;
    } catch {}
    fetch('/api/chat/name?user=' + encodeURIComponent(me)).then(r => r.json()).then(d => {
      if (d.display && d.display !== me) {
        try { localStorage.setItem('batprox-display', d.display); } catch {}
        setDisplay(d.display);
        setGate(false);
      }
    }).catch(() => {});
  }, [me]);

  const deleteMsg = async (id: number) => {
    if (!me) return;
    setDeleting(id);
    try {
      await fetch('/api/chat/messages/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, user: me }) });
    } catch {}
    setTimeout(() => { setDeleting(null); loadMessages(room.id); }, 350);
  };

  const submitGate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const v = displayInput.trim().slice(0, 24);
    if (!v || !me) return;
    try {
      await fetch('/api/chat/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: me, display: v }) });
    } catch {}
    try { localStorage.setItem('batprox-display', v); } catch {}
    setDisplay(v);
    setGate(false);
  };

  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t || !me) return;
    setText('');
    setReplyTo(null);
    try {
      await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: room.id, user: me, text: t, replyTo }) });
      loadMessages(room.id);
    } catch {}
  };

  const replyNow = (m: Msg) => {
    setReplyTo({ user: m.user, text: m.text });
    setSelected(null);
    inputRef.current?.focus();
  };

  const openRoom = (r: Room) => { setRoom(r); loadMessages(r.id); };

  const openDm = (other: string) => {
    if (!me || other === me) return;
    openRoom({ kind: 'dm', id: dmId(me, other), label: other });
  };

  const createDm = async () => {
    const v = dmTarget.trim();
    if (!v || !me) return;
    const found = Object.keys(names).find(u => u.toLowerCase() === v.toLowerCase() || (names[u] || '').toLowerCase() === v.toLowerCase());
    if (!found) { setDmTarget(''); return; }
    try {
      const r = await fetch('/api/chat/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: me, members: [found] }) });
      if (r.ok) {
        const d = await r.json();
        setShowCreateDm(false); setDmTarget('');
        loadLists();
        openRoom({ kind: 'gc', id: d.id, label: found });
      }
    } catch {}
  };

  const joinByCode = async () => {
    const c = joinCode.trim();
    if (!c || !me) return;
    try {
      const r = await fetch('/api/chat/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, user: me }) });
      const d = await r.json();
      if (r.ok) { setShowJoin(false); setJoinCode(''); setJoinMsg(''); loadLists(); openRoom({ kind: 'gc', id: d.roomId, label: 'Group' }); }
      else setJoinMsg(d.error || 'Invite expired or invalid.');
    } catch { setJoinMsg('Network error'); }
  };

  const makeInvite = async () => {
    if (!menuGc || !me) return;
    try {
      const r = await fetch('/api/chat/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: menuGc.id, user: me, maxUses: 10, hours: 24 }) });
      if (r.ok) { const d = await r.json(); setInvite({ code: d.code, expiresAt: d.expiresAt, maxUses: d.maxUses }); }
    } catch {}
  };

  const revokeInvites = async () => {
    if (!menuGc || !me) return;
    try {
      await fetch('/api/chat/invites/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: menuGc.id, user: me }) });
      setInvite(null);
    } catch {}
  };

  const leaveGc = (gc: Gc) => {
    setConfirm({ title: 'Leave this group?', body: 'You will lose the chat on your side.', action: async () => {
      await fetch('/api/chat/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: gc.id, user: me }) });
      setMenuGc(null); setConfirm(null); loadLists();
      if (room.id === gc.id) openRoom({ kind: 'community', id: 'community', label: 'Community' });
    }});
  };

  const deleteGc = (gc: Gc) => {
    setConfirm({ title: 'Delete for everyone?', body: 'This cannot be undone.', action: async () => {
      await fetch('/api/chat/rooms/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: gc.id, user: me }) });
      setMenuGc(null); setConfirm(null); loadLists();
      if (room.id === gc.id) openRoom({ kind: 'community', id: 'community', label: 'Community' });
    }});
  };

  const addToGc = async () => {
    if (!menuGc || !me) return;
    const list = addMembers.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    await fetch('/api/chat/rooms/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: menuGc.id, user: me, members: list }) });
    setAddMembers('');
    loadLists();
  };

  const askDm = async (username: string) => {
    if (!me || username === me) return;
    setDmAsk(null);
    try {
      await fetch('/api/chat/dm-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: me, to: username }) });
    } catch {}
  };

  const respondDm = async (accept: boolean) => {
    if (!dmIncoming || !me) return;
    try {
      const r = await fetch('/api/chat/dm-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dmIncoming.id, to: me, accept }) });
      const d = await r.json().catch(() => ({}));
      setDmIncoming(null);
      loadLists();
      if (accept && d.room) openRoom({ kind: 'dm', id: d.room, label: dmIncoming.from });
    } catch { setDmIncoming(null); }
  };

  const isOnline = (u: string) => online.some(o => o.username === u && o.active);
  const dispOf = (u: string) => names[u] || u;

  const renderText = (t: string) => {
    const parts = t.split(/(@[\w$%]+)/g);
    return parts.map((p, i) => {
      if (/^@[\w$%]+$/.test(p)) {
        const uname = p.slice(1);
        return <button key={i} onClick={() => setCard({ username: uname })} className="text-blue-400 hover:underline font-medium">{p}</button>;
      }
      const m = p.match(/(gc-[A-Z0-9]{6,8})/);
      if (m) {
        const idx = p.indexOf(m[1]);
        return <span key={i}>{p.slice(0, idx)}<button onClick={() => { setJoinCode(m[1]); setShowJoin(true); }} className="px-2.5 py-1 rounded-lg bg-purple-600/25 border border-purple-500/40 text-purple-200 text-xs font-bold">Join {m[1]}</button>{p.slice(idx + m[1].length)}</span>;
      }
      return <span key={i}>{p}</span>;
    });
  };

  const roomLabel = (r: Room) => r.kind === 'community' ? 'Community' : r.kind === 'dm' ? dispOf(r.label) : `Group · ${r.label}`;
  const dmOther = room.kind === 'dm' ? room.label : '';
  const gcNow = room.kind === 'gc' ? gcs.find(g => g.id === room.id) : undefined;

  if (!me) return null;

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col h-screen sm:pl-16 px-3 sm:px-4 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex gap-3 min-h-0 pt-3">
          <div className="w-56 shrink-0 hidden sm:flex flex-col bg-black/55 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-widest text-white/30 px-2 mb-2">Community</p>
              <button onClick={() => openRoom({ kind: 'community', id: 'community', label: 'Community' })} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${room.id === 'community' ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.04]'}`}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: avatarColor('community') }}>#</span>
                <span className="font-medium truncate">Community</span>
              </button>
            </div>
            <div className="p-3 border-b border-white/[0.06] flex-1 overflow-y-auto min-h-0">
              <p className="text-[10px] uppercase tracking-widest text-white/30 px-2 mb-2">Direct messages</p>
              {dms.length === 0 && <p className="text-[11px] text-white/25 px-2 py-2">No DMs yet.</p>}
              {dms.map(d => (
                <button key={d.id} onClick={() => openDm(d.other)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all ${room.id === d.id ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.04]'}`}>
                  <span className="relative shrink-0">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: avatarColor(d.other) }}>{dispOf(d.other).charAt(0).toUpperCase()}</span>
                    {isOnline(d.other) && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-black" />}
                  </span>
                  <span className="font-medium truncate">{dispOf(d.other)}</span>
                </button>
              ))}
              <p className="text-[10px] uppercase tracking-widest text-white/30 px-2 mt-4 mb-2">Group chats</p>
              {gcs.length === 0 && <p className="text-[11px] text-white/25 px-2 py-2">No groups yet.</p>}
              {gcs.map(g => (
                <div key={g.id} className={`w-full flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all ${room.id === g.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
                  <button onClick={() => openRoom({ kind: 'gc', id: g.id, label: g.members.filter(m => m !== me).slice(0, 2).join(', ') || 'Group' })} className="flex-1 flex items-center gap-2.5 text-left text-white/70 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-xs font-bold shrink-0">{g.members.length}</span>
                    <span className="font-medium truncate">{g.members.filter(m => m !== me).slice(0, 2).join(', ') || 'Group'}</span>
                  </button>
                  <button onClick={() => setMenuGc(g)} className="text-white/30 hover:text-white px-1">···</button>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/[0.06] space-y-2">
              <button onClick={() => setShowCreateDm(true)} className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-white/70 transition-all">+ create dms - here</button>
              <button onClick={() => { setShowJoin(true); setJoinMsg(''); }} className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-white/70 transition-all">Join a group</button>
              <button onClick={() => { loadNotes(); setShowNotes(true); }} className="w-full px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-white/70 transition-all">+ add personal notes</button>
            </div>
          </div>
          <div className="flex-1 flex flex-col bg-black/55 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden min-w-0">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-3">
              {room.kind !== 'community' && (
                <button onClick={() => setCard({ username: dmOther || '' })} className="w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: avatarColor(room.label) }}>{dispOf(room.label).charAt(0).toUpperCase()}</button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{roomLabel(room)}</p>
                {room.kind === 'dm' && <p className="text-[11px] text-white/35">{isOnline(dmOther) ? 'Active now' : 'Offline'}</p>}
                {room.kind === 'gc' && gcNow && <p className="text-[11px] text-white/35">{gcNow.members.length} members · owner: {gcNow.owner === me ? 'you' : gcNow.owner}</p>}
              </div>
              {room.kind === 'gc' && gcNow && <button onClick={() => setMenuGc(gcNow)} className="text-white/40 hover:text-white px-2 text-lg">···</button>}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0">
              {messages.length === 0 && <p className="text-white/25 text-xs text-center py-10">No messages yet. Say hi.</p>}
              {messages.map((m, i) => {
                if (m.sys) return <p key={m.id} className="text-center text-[11px] text-white/35 py-2">{m.text}</p>;
                const prev = messages[i - 1];
                const grouped = prev && !prev.sys && prev.user === m.user && (m.ts - prev.ts) < 60000;
                const mine = room.kind === 'dm' && m.user === me;
                const quote = m.replyTo ? (
                  <span className={`block text-[11px] px-2.5 py-1.5 rounded-lg mb-1.5 border-l-2 ${mine ? 'bg-black/20 border-white/50 text-white/85' : 'bg-white/[0.06] border-orange-400/70 text-white/60'}`}>
                    <span className="font-bold">{m.replyTo.user}: </span>{m.replyTo.text.slice(0, 120)}
                  </span>
                ) : null;
                const sel = selected === m.id;
                if (room.kind === 'dm') {
                  return (
                    <div key={m.id} data-mid={m.id} onMouseEnter={(e) => { if (e.shiftKey) setHoverMsg(m.id); }} onMouseLeave={() => setHoverMsg(h => h === m.id ? null : h)} className={`flex ${mine ? 'justify-end' : 'justify-start'} transition-opacity duration-300 ${deleting === m.id ? 'opacity-0' : 'opacity-100'}`}>
                      <div onClick={() => setSelected(sel ? null : m.id)} onDoubleClick={() => replyNow(m)} className={`relative max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap cursor-pointer ${mine ? 'text-white' : 'bg-white/[0.07] text-white/85'} ${sel ? 'ring-2 ring-orange-400' : ''}`} style={mine ? { background: 'var(--bp-accent)' } : undefined}>
                        {shiftDown && hoverMsg === m.id && (
                          <button onClick={(e) => { e.stopPropagation(); deleteMsg(m.id); }} title="Delete message" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-500 text-white text-xs flex items-center justify-center shadow-lg">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.15 21H7.85a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                          </button>
                        )}
                        {quote}
                        {renderText(m.text)}
                        <span className={`block text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-white/30'}`}>{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {sel && <button onClick={(e) => { e.stopPropagation(); replyNow(m); }} className="mt-1.5 text-[11px] px-3 py-1 rounded-lg bg-orange-500/25 border border-orange-400/50 text-orange-200">reply to message</button>}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} data-mid={m.id} onMouseEnter={(e) => { if (e.shiftKey) setHoverMsg(m.id); }} onMouseLeave={() => setHoverMsg(h => h === m.id ? null : h)} onClick={() => setSelected(sel ? null : m.id)} onDoubleClick={() => replyNow(m)} className={`relative flex gap-2.5 px-1 py-1 rounded-lg hover:bg-white/[0.02] group cursor-pointer transition-opacity duration-300 ${deleting === m.id ? 'opacity-0' : 'opacity-100'} ${sel ? 'ring-2 ring-orange-400/80 bg-orange-500/[0.06]' : ''}`}>
                    {shiftDown && hoverMsg === m.id && (
                      <button onClick={(e) => { e.stopPropagation(); deleteMsg(m.id); }} title="Delete message" className="absolute top-0 right-1 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-500 text-white text-xs flex items-center justify-center shadow-lg z-10">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.15 21H7.85a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    {!grouped ? (
                      <button onClick={(e) => { e.stopPropagation(); setCard({ username: m.user }); }} className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5" style={{ background: avatarColor(m.user) }}>
                        {(m.display || m.user).charAt(0).toUpperCase()}
                      </button>
                    ) : <span className="w-9 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <p className="text-xs mb-0.5">
                          <button onClick={(e) => { e.stopPropagation(); setCard({ username: m.user }); }} className="font-bold text-white hover:underline">{m.display || m.user}</button>
                          {rankPill(m.user)}
                          <span className="text-white/30 ml-2">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      )}
                      {quote}
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words">{renderText(m.text)}</p>
                      {sel && <button onClick={(e) => { e.stopPropagation(); replyNow(m); }} className="mt-1 text-[11px] px-3 py-1 rounded-lg bg-orange-500/25 border border-orange-400/50 text-orange-200">reply to message</button>}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {typing.length > 0 && <p className="px-5 pb-1 text-[11px] text-white/40">{typing.join(', ')} is typing..</p>}
            <form onSubmit={send} className="p-3 border-t border-white/[0.06]">
              {replyTo && (
                <div className="flex items-center gap-2 mx-1 mb-2 px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-400/30 text-xs">
                  <span className="text-white/60 truncate flex-1">replying to: <span className="text-orange-200 font-semibold">{replyTo.user}</span> — {replyTo.text.slice(0, 80)}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white">×</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-full pl-5 pr-1.5 py-1.5 focus-within:border-purple-500/50 transition-all">
                <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); beatTyping(); }} placeholder={`Message ${room.kind === 'community' ? 'Community' : dispOf(room.label)}`} className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none text-sm min-w-0" maxLength={500} />
                <button type="submit" className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-all" style={{ background: 'var(--bp-accent)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" /></svg>
                </button>
              </div>
              <p className="text-center text-[10px] text-white/25 mt-1.5">if you double click in chatroom, that will reply to the person message automatically.</p>
            </form>
          </div>
          <div className="w-52 shrink-0 hidden lg:flex flex-col bg-black/55 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
            <p className="text-[10px] uppercase tracking-widest text-white/30 px-4 pt-4 pb-2">Online — {online.filter(o => o.active).length}</p>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {online.length === 0 && <p className="text-[11px] text-white/25 px-2">Nobody online.</p>}
              {online.map(o => (
                <button key={o.username} onClick={() => setCard({ username: o.username })} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.05] text-left transition-all">
                  <span className="relative shrink-0">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: avatarColor(o.username) }}>{o.username.charAt(0).toUpperCase()}</span>
                    {o.active && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-black" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold truncate">{o.username}{o.username === me ? ' (you)' : ''}</span>
                    <span className="block text-[10px] text-white/30">{o.active ? 'Active now' : 'Idle'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
      {gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <form onSubmit={submitGate} className="bg-[#0b0b10] border border-white/15 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Enter your FIRST name, to continue.</h2>
            <input value={displayInput} onChange={e => setDisplayInput(e.target.value)} placeholder="enter here" autoFocus maxLength={24} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm text-center mt-4 mb-4" />
            <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all">submit</button>
          </form>
        </div>
      )}
      {card && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setCard(null)}>
          <div className="bg-[#0b0b10]/95 border border-white/15 rounded-2xl p-7 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {profiles[card.username]?.pfp ? (
              <img src={profiles[card.username].pfp} alt="" className={`w-20 h-20 rounded-full object-cover mx-auto mb-4 ${isOnline(card.username) ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-black' : ''}`} />
            ) : (
              <span className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 ${isOnline(card.username) ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-black' : ''}`} style={{ background: avatarColor(card.username) }}>{(names[card.username] || card.username).charAt(0).toUpperCase()}</span>
            )}
            <p className="text-base font-bold text-white">{profiles[card.username]?.display || names[card.username] || card.username}{rankPill(card.username)}</p>
            <p className="text-xs text-white/40 mt-0.5 mb-2">@{card.username}</p>
            {profiles[card.username]?.bio && <p className="text-xs text-white/60 leading-relaxed mb-4 whitespace-pre-wrap">{profiles[card.username].bio}</p>}
            {!profiles[card.username]?.bio && <div className="mb-4" />}
            <div className="flex gap-2 justify-center">
              {card.username === me ? (
                <button onClick={() => { setCard(null); setShowSettings(true); }} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold">Edit profile</button>
              ) : (
                <button onClick={() => { const u = card.username; setCard(null); openDm(u); }} className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: 'var(--bp-accent)' }}>Message</button>
              )}
              <button onClick={() => setCard(null)} className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">···</button>
            </div>
          </div>
        </div>
      )}
      {showCreateDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-semibold text-white mb-4">enter the display name of the user you want to have dms with:</p>
            <input value={dmTarget} onChange={e => setDmTarget(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createDm(); } }} placeholder="display name or username" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowCreateDm(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">Cancel</button>
              <button onClick={createDm} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">+ create chat room{dmTarget ? ` with ${dmTarget}` : ''}</button>
            </div>
          </div>
        </div>
      )}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-semibold text-white mb-4">Join a group</p>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); joinByCode(); } }} placeholder="gc-XXXXXX" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm mb-3 text-center font-mono" />
            {joinMsg && <p className="text-red-300 text-xs mb-3 text-center">{joinMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">Cancel</button>
              <button onClick={joinByCode} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">Join</button>
            </div>
          </div>
        </div>
      )}
      {menuGc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-bold text-white mb-1">Group · {menuGc.members.filter(m => m !== me).slice(0, 3).join(', ') || 'Group'}</p>
            <p className="text-[11px] text-white/35 mb-4">owner: {menuGc.owner === me ? 'you (Owner GC)' : menuGc.owner} · {menuGc.members.length} members</p>
            <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2">Members</p>
            <div className="max-h-32 overflow-y-auto mb-4 space-y-1">
              {menuGc.members.map(m => (
                <div key={m} className="flex items-center justify-between text-xs text-white/70 px-1 py-1">
                  <span>{m}{m === menuGc.owner ? ' · Owner GC' : ''}{m === me ? ' (you)' : ''}</span>
                  {(menuGc.owner === me || isStaff) && m !== me && (
                    <button onClick={async () => { await fetch('/api/chat/rooms/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: menuGc.id, user: me, remove: m }) }); loadLists(); setMenuGc({ ...menuGc, members: menuGc.members.filter(x => x !== m) }); }} className="text-red-300/70 hover:text-red-300 text-[11px]">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={addMembers} onChange={e => setAddMembers(e.target.value)} placeholder="add usernames, comma separated" className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-purple-500" />
              <button onClick={addToGc} className="px-4 py-2 rounded-xl bg-white/10 text-xs text-white">Add</button>
            </div>
            {!invite ? (
              <button onClick={makeInvite} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 mb-2">Invite people (get code)</button>
            ) : (
              <div className="rounded-xl bg-purple-600/10 border border-purple-500/25 p-3 mb-2 text-center">
                <p className="font-mono font-bold text-purple-200 tracking-widest">{invite.code}</p>
                <p className="text-[10px] text-white/40 mt-1">expires {new Date(invite.expiresAt).toLocaleString()} · {invite.maxUses} uses</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { try { navigator.clipboard.writeText(invite.code); } catch {} }} className="flex-1 py-1.5 rounded-lg bg-white/10 text-[11px]">Copy</button>
                  <button onClick={revokeInvites} className="flex-1 py-1.5 rounded-lg bg-red-600/20 text-red-300 text-[11px]">Revoke all</button>
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => leaveGc(menuGc)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/70">Leave group</button>
              {(menuGc.owner === me || isStaff) && <button onClick={() => deleteGc(menuGc)} className="flex-1 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-200 text-xs font-semibold">Delete group</button>}
            </div>
            <button onClick={() => { setMenuGc(null); setInvite(null); }} className="w-full py-2 mt-2 text-xs text-white/40">Close</button>
          </div>
        </div>
      )}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-md shadow-2xl">
            <p className="text-sm font-bold text-white mb-1">Personal notes</p>
            <p className="text-[11px] text-white/35 mb-4">Only you can see these. Saved to your account.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {notes.length === 0 && <p className="text-xs text-white/30 text-center py-4">No notes yet.</p>}
              {notes.map(n => (
                <div key={n.id} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="flex-1 text-xs text-white/75 whitespace-pre-wrap break-words">{n.text}</p>
                  <button onClick={() => saveNotes(notes.filter(x => x.id !== n.id))} className="text-white/30 hover:text-red-300 text-sm shrink-0">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (noteText.trim()) { saveNotes([...notes, { id: Date.now(), text: noteText.trim().slice(0, 1000), ts: Date.now() }]); setNoteText(''); } } }} placeholder="Write a note..." className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm" />
              <button onClick={() => { if (noteText.trim()) { saveNotes([...notes, { id: Date.now(), text: noteText.trim().slice(0, 1000), ts: Date.now() }]); setNoteText(''); } }} className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">Add</button>
            </div>
            <button onClick={() => setShowNotes(false)} className="w-full py-2 mt-3 text-xs text-white/40">Close</button>
          </div>
        </div>
      )}
      {dmAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-xs text-center shadow-2xl">
            <p className="text-sm text-white mb-5">would you like to start dms with {dmAsk.username}?</p>
            <div className="flex gap-2">
              <button onClick={() => setDmAsk(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">no</button>
              <button onClick={() => askDm(dmAsk.username)} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">yes</button>
            </div>
          </div>
        </div>
      )}
      {dmIncoming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-7 w-full max-w-xs text-center shadow-2xl">
            <p className="text-sm font-bold text-white mb-2">{confirm.title}</p>
            <p className="text-xs text-white/50 mb-5">{confirm.body}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm">Cancel</button>
              <button onClick={confirm.action} className="flex-1 py-2.5 rounded-xl bg-red-600/25 hover:bg-red-600/45 text-red-200 text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
