import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail } from './Chrome';
import { GENRES, fmtTime, searchTracks, shouldRelayFirst, streamUrl, trending, type Track, type TrendTime } from './music/audius';
import {
  EMPTY_LIBRARY,
  addToPlaylist,
  askMusicAi,
  recordPlay,
  type AiMix,
  cachedLibrary,
  createPlaylist,
  deletePlaylist,
  hasAccount,
  loadLibrary,
  removeFromPlaylist,
  renamePlaylist,
  setLiked,
  type Library
} from './music/library';

type View = { kind: 'home' } | { kind: 'search' } | { kind: 'liked' } | { kind: 'library' } | { kind: 'ai' } | { kind: 'playlist'; id: string };
type AiTurn = { id: number; role: 'user' | 'ai'; text: string; mix?: AiMix; error?: boolean };

const AI_CHIPS: { label: string; prompt: string }[] = [
  { label: 'Make a playlist from my taste', prompt: '' },
  { label: 'Songs like my most played', prompt: 'songs that sound like my most played tracks' },
  { label: 'Something new for me', prompt: 'something new I have not heard that still fits my taste' },
  { label: 'Chill late night', prompt: 'chill late night music' },
  { label: 'Gym energy', prompt: 'high energy workout music' }
];
type Repeat = 'off' | 'all' | 'one';

const TIMES: { id: TrendTime; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'allTime', label: 'All time' }
];

const userKey = () => { try { return localStorage.getItem('batprox-user') || 'guest'; } catch { return 'guest'; } };
const readJson = <T,>(k: string, fb: T): T => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; } };
const writeJson = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const shuffled = <T,>(arr: T[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const totalTime = (list: Track[]) => {
  const s = list.reduce((n, t) => n + (t.duration || 0), 0);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
};

const fmtPlays = (n?: number) => {
  if (!n) return '';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

const Icon = {
  play: <path d="M8 5.14v13.72a1 1 0 001.52.85l11.05-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 4.5h3.2v15H7zM13.8 4.5H17v15h-3.2z" fill="currentColor" stroke="none" />,
  next: <path d="M5 5.5v13l9.5-6.5L5 5.5zM16.5 5h2.5v14h-2.5z" fill="currentColor" stroke="none" />,
  prev: <path d="M19 5.5v13L9.5 12 19 5.5zM5 5h2.5v14H5z" fill="currentColor" stroke="none" />,
  shuffle: <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  repeat: <path strokeLinecap="round" strokeLinejoin="round" d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" />,
  heart: <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />,
  plus: <path strokeLinecap="round" d="M12 5v14M5 12h14" />,
  queue: <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h8M17 15v6l4-3-4-3z" />,
  queueAdd: <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h12M3 12h12M3 18h7M17 14v8M13 18h8" />,
  vol: <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />,
  mute: <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />,
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />,
  library: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M9 4v16M14 4l6 16" />,
  trash: <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />,
  close: <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />,
  back: <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />,
  spark: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.8L20 10.7l-6.1 1.9L12 18.5l-1.9-5.9L4 10.7l6.1-1.9L12 3zM19 3v4M17 5h4" />,
  note: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z" />
};

function Svg({ children, className = 'w-5 h-5', fill = 'none', sw = 1.9 }: { children: ReactNode; className?: string; fill?: string; sw?: number }) {
  return <svg className={className} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw}>{children}</svg>;
}

function Art({ src, className }: { src: string; className: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'bad'>('loading');
  useEffect(() => setState('loading'), [src]);
  return (
    <div className={`${className} relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-600/40 to-fuchsia-500/20 text-white/60`}>
      {state !== 'ok' && <Svg className="w-1/2 h-1/2" sw={1.5}>{Icon.note}</Svg>}
      {src && state !== 'bad' && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setState('ok')}
          onError={() => setState('bad')}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

function AiBadge({ size }: { size: string }) {
  return (
    <span className={`${size} shrink-0 rounded-full flex items-center justify-center text-white shadow-lg`} style={{ background: 'linear-gradient(135deg, var(--bp-accent), #ec4899)' }}>
      <Svg className="w-1/2 h-1/2" sw={1.8}>{Icon.spark}</Svg>
    </span>
  );
}

function Bars() {
  return (
    <span className="flex items-end gap-[2px] h-3.5 w-4">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-[3px] rounded-sm" style={{ background: 'var(--bp-accent)', animation: `bpbar 0.9s ${i * 0.15}s ease-in-out infinite alternate`, height: '100%', transformOrigin: 'bottom' }} />
      ))}
    </span>
  );
}

function Seek({ value, max, onChange, buffered, className = '' }: { value: number; max: number; onChange: (v: number) => void; buffered?: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bpct = max > 0 && buffered ? Math.min(100, (buffered / max) * 100) : 0;
  return (
    <div className={`relative h-4 flex items-center group/seek ${className}`}>
      <div className="absolute inset-x-0 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-white/15" style={{ width: bpct + '%' }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-white group-hover/seek:bg-[var(--bp-accent)]" style={{ width: pct + '%' }} />
      </div>
      <div className="absolute w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/seek:opacity-100 -translate-x-1/2 pointer-events-none" style={{ left: pct + '%' }} />
      <input
        type="range"
        min={0}
        max={max || 0}
        step="any"
        value={Math.min(value, max || 0)}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        aria-label="Seek"
      />
    </div>
  );
}

export default function MusicPage() {
  const navigate = useNavigate();
  const owner = useMemo(userKey, []);
  const signedIn = useMemo(hasAccount, []);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [genre, setGenre] = useState('All');
  const [time, setTime] = useState<TrendTime>('week');
  const [reloadKey, setReloadKey] = useState(0);
  const [home, setHome] = useState<Track[]>([]);
  const [homeState, setHomeState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [lib, setLib] = useState<Library>(() => (signedIn ? cachedLibrary() : EMPTY_LIBRARY));
  const [recent, setRecent] = useState<Track[]>(() => readJson<Track[]>('bp-music-recent-' + owner, []));
  const [toast, setToast] = useState('');
  const [aiThread, setAiThread] = useState<AiTurn[]>(() => readJson<AiTurn[]>('bp-music-ai-' + userKey(), []));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const listened = useRef({ id: '', secs: 0, last: 0, counted: false });
  const [pickFor, setPickFor] = useState<Track | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const saved = useMemo(() => readJson<{ queue: Track[]; index: number; pos: number } | null>('bp-music-session-' + owner, null), [owner]);
  const [queue, setQueue] = useState<Track[]>(() => (saved && Array.isArray(saved.queue) ? saved.queue : []));
  const [index, setIndex] = useState(() => (saved && saved.queue?.[saved.index] ? saved.index : -1));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState(() => saved?.pos || 0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => { const v = Number(readJson('bp-music-volume', 0.8)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8; });
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(() => !!readJson('bp-music-shuffle', false));
  const [repeat, setRepeat] = useState<Repeat>(() => { const r = readJson<string>('bp-music-repeat', 'off'); return r === 'all' || r === 'one' ? r : 'off'; });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedId = useRef('');
  const relayTried = useRef(false);
  const originalRef = useRef<Track[] | null>(null);
  const resumeAt = useRef(saved?.pos || 0);
  const lastSave = useRef(0);
  const toastTimer = useRef<number | null>(null);

  const current = index >= 0 ? queue[index] || null : null;
  const likedIds = useMemo(() => new Set(lib.liked.map(t => t.id)), [lib.liked]);
  const topPlayed = useMemo(() => (lib.plays || []).slice().sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, 8), [lib.plays]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    loadLibrary().then(setLib).catch(e => flash(e instanceof Error ? e.message : 'Could not load your library.'));
  }, [signedIn, flash]);

  useEffect(() => {
    const ctrl = new AbortController();
    setHomeState('loading');
    trending(genre, time, ctrl.signal)
      .then(list => { setHome(list); setHomeState('ok'); })
      .catch(() => { if (!ctrl.signal.aborted) setHomeState('error'); });
    return () => ctrl.abort();
  }, [genre, time, reloadKey]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearchState('idle'); return; }
    const ctrl = new AbortController();
    setSearchState('loading');
    const t = window.setTimeout(() => {
      searchTracks(q, ctrl.signal)
        .then(list => { setResults(list); setSearchState('ok'); })
        .catch(() => { if (!ctrl.signal.aborted) setSearchState('error'); });
    }, 320);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => writeJson('bp-music-volume', volume), [volume]);
  useEffect(() => writeJson('bp-music-shuffle', shuffle), [shuffle]);
  useEffect(() => writeJson('bp-music-repeat', repeat), [repeat]);
  useEffect(() => writeJson('bp-music-recent-' + owner, recent.slice(0, 24)), [recent, owner]);
  useEffect(() => {
    if (index < 0 || !queue.length) return;
    writeJson('bp-music-session-' + owner, { queue: queue.slice(0, 200), index, pos: audioRef.current?.currentTime || 0 });
  }, [queue, index, owner]);

  const ctl = useRef<{ onEnded: () => void; onError: () => void; onTick: (a: HTMLAudioElement) => void }>({ onEnded: () => {}, onError: () => {}, onTick: () => {} });

  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    audioRef.current = a;
    const onTime = () => {
      setPos(a.currentTime);
      ctl.current.onTick(a);
      const now = Date.now();
      if (now - lastSave.current > 5000) {
        lastSave.current = now;
        const s = readJson<{ queue: Track[]; index: number; pos: number } | null>('bp-music-session-' + owner, null);
        if (s) writeJson('bp-music-session-' + owner, { ...s, pos: a.currentTime });
      }
    };
    const onDur = () => setDur(Number.isFinite(a.duration) ? a.duration : 0);
    const onProg = () => { try { if (a.buffered.length) setBuffered(a.buffered.end(a.buffered.length - 1)); } catch {} };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWait = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onMeta = () => {
      onDur();
      if (resumeAt.current > 0 && resumeAt.current < a.duration - 2) { try { a.currentTime = resumeAt.current; } catch {} }
      resumeAt.current = 0;
    };
    const onEnded = () => ctl.current.onEnded();
    const onError = () => ctl.current.onError();
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('progress', onProg);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWait);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('canplay', onPlaying);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('progress', onProg);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWait);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('canplay', onPlaying);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      try { a.pause(); a.removeAttribute('src'); a.load(); } catch {}
      audioRef.current = null;
    };
  }, [owner]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  const load = useCallback((t: Track, autoplay: boolean) => {
    const a = audioRef.current;
    if (!a) return;
    loadedId.current = t.id;
    relayTried.current = shouldRelayFirst();
    setDur(t.duration || 0);
    setPos(0);
    setBuffered(0);
    a.src = streamUrl(t.id, relayTried.current);
    if (autoplay) {
      setLoading(true);
      a.play().catch(() => setLoading(false));
      setRecent(r => [t, ...r.filter(x => x.id !== t.id)].slice(0, 24));
    }
  }, []);

  useEffect(() => {
    if (current && loadedId.current !== current.id && audioRef.current && !audioRef.current.src) load(current, false);
  }, [current, load]);

  const playIndex = useCallback((q: Track[], i: number) => {
    const t = q[i];
    if (!t) return;
    resumeAt.current = 0;
    setQueue(q);
    setIndex(i);
    load(t, true);
  }, [load]);

  const playList = useCallback((list: Track[], start: number) => {
    if (!list.length) return;
    if (shuffle) {
      originalRef.current = list;
      const first = list[start] || list[0];
      playIndex([first, ...shuffled(list.filter((_, i) => i !== start))], 0);
    } else {
      originalRef.current = null;
      playIndex(list, start);
    }
  }, [shuffle, playIndex]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (loadedId.current !== current.id || !a.src) { load(current, true); return; }
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, [current, load]);

  const next = useCallback((auto: boolean) => {
    const a = audioRef.current;
    if (!a || !queue.length) return;
    if (auto && repeat === 'one') { a.currentTime = 0; a.play().catch(() => {}); return; }
    if (index + 1 < queue.length) playIndex(queue, index + 1);
    else if (repeat !== 'off') playIndex(queue, 0);
    else if (auto) { a.pause(); a.currentTime = 0; }
  }, [queue, index, repeat, playIndex]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.currentTime > 3 || index <= 0) { a.currentTime = 0; return; }
    playIndex(queue, index - 1);
  }, [queue, index, playIndex]);

  const seek = useCallback((v: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(v)) return;
    try { a.currentTime = Math.max(0, Math.min(v, a.duration || v)); setPos(a.currentTime); } catch {}
  }, []);

  ctl.current.onEnded = () => { listened.current = { id: '', secs: 0, last: 0, counted: false }; next(true); };
  ctl.current.onTick = (a: HTMLAudioElement) => {
    const L = listened.current;
    if (!current || L.id !== current.id) {
      listened.current = { id: current ? current.id : '', secs: 0, last: a.currentTime, counted: false };
      return;
    }
    const d = a.currentTime - L.last;
    L.last = a.currentTime;
    if (d > 0 && d < 1.5 && !a.paused) L.secs += d;
    const need = Math.min(30, Math.max(5, (current.duration || a.duration || 60) * 0.5));
    if (!L.counted && L.secs >= need) {
      L.counted = true;
      if (signedIn) recordPlay(current).then(setLib).catch(() => {});
    }
  };
  ctl.current.onError = () => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (!relayTried.current) {
      relayTried.current = true;
      const at = a.currentTime;
      a.src = streamUrl(current.id, true);
      resumeAt.current = at;
      a.play().catch(() => {});
      return;
    }
    setLoading(false);
    flash(`Could not play "${current.title}". Skipping it.`);
    if (index + 1 < queue.length) playIndex(queue, index + 1);
  };

  const toggleShuffle = () => {
    if (!shuffle) {
      if (current && queue.length > 1) {
        originalRef.current = queue;
        setQueue([...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1))]);
      }
      setShuffle(true);
      return;
    }
    const orig = originalRef.current;
    if (orig && current) {
      const at = orig.findIndex(t => t.id === current.id);
      if (at >= 0) { setQueue(orig); setIndex(at); }
    }
    originalRef.current = null;
    setShuffle(false);
  };

  const cycleRepeat = () => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));

  const enqueue = (t: Track, nextUp: boolean) => {
    if (!current) { playIndex([t], 0); return; }
    const rest = queue.filter((x, i) => i <= index || x.id !== t.id);
    const at = nextUp ? index + 1 : rest.length;
    setQueue([...rest.slice(0, at), t, ...rest.slice(at)]);
    flash(nextUp ? `"${t.title}" plays next` : `Added "${t.title}" to the queue`);
  };

  const removeFromQueue = (i: number) => {
    if (i === index) return;
    setQueue(q => q.filter((_, k) => k !== i));
    if (i < index) setIndex(x => x - 1);
  };

  const guard = () => {
    if (signedIn) return true;
    flash('Sign in to BatProx to save music to your library.');
    return false;
  };

  const toggleLike = async (t: Track) => {
    if (!guard()) return;
    const was = likedIds.has(t.id);
    const before = lib;
    setLib(l => ({ ...l, liked: was ? l.liked.filter(x => x.id !== t.id) : [{ ...t, addedAt: Date.now() }, ...l.liked] }));
    try {
      setLib(await setLiked(t, !was));
      flash(was ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
    } catch (e) {
      setLib(before);
      flash(e instanceof Error ? e.message : 'Could not save that.');
    }
  };

  const libAction = async (fn: () => Promise<Library>, ok: string) => {
    if (!guard()) return false;
    try {
      setLib(await fn());
      if (ok) flash(ok);
      return true;
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not save that.');
      return false;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = audioRef.current;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight' && a) { e.preventDefault(); seek(a.currentTime + 5); }
      else if (e.key === 'ArrowLeft' && a) { e.preventDefault(); seek(a.currentTime - 5); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(v => Math.min(1, v + 0.05)); setMuted(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(v => Math.max(0, v - 0.05)); }
      else if (e.key === 'm' || e.key === 'M') setMuted(m => !m);
      else if (e.key === 'n' || e.key === 'N') next(false);
      else if (e.key === 'p' || e.key === 'P') prev();
      else if (e.key === 'Escape') { setQueueOpen(false); setPickFor(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek, next, prev]);

  useEffect(() => {
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms || !current) return;
    try {
      ms.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: 'BatProx Music', artwork: current.artwork ? [{ src: current.artwork, sizes: '480x480', type: 'image/jpeg' }] : [] });
      ms.setActionHandler('play', () => { audioRef.current?.play().catch(() => {}); });
      ms.setActionHandler('pause', () => audioRef.current?.pause());
      ms.setActionHandler('nexttrack', () => next(false));
      ms.setActionHandler('previoustrack', () => prev());
      ms.setActionHandler('seekto', d => { if (typeof d.seekTime === 'number') seek(d.seekTime); });
    } catch {}
  }, [current, next, prev, seek]);

  useEffect(() => {
    if (!current) return;
    const prevTitle = document.title;
    document.title = `${playing ? '▶ ' : ''}${current.title} · ${current.artist}`;
    return () => { document.title = prevTitle; };
  }, [current, playing]);

  const playlist = view.kind === 'playlist' ? lib.playlists.find(p => p.id === view.id) || null : null;
  useEffect(() => { setRenaming(''); setConfirmDelete(false); }, [view]);
  useEffect(() => { if (view.kind === 'playlist' && !playlist) setView({ kind: 'library' }); }, [view, playlist]);

  const go = (v: View) => { setView(v); document.getElementById('bp-music-scroll')?.scrollTo({ top: 0 }); };

  const row = (t: Track, i: number, list: Track[], opts: { onRemove?: () => void } = {}) => {
    const isCur = current?.id === t.id;
    const liked = likedIds.has(t.id);
    return (
      <div
        key={t.id + '-' + i}
        onClick={() => (isCur ? toggle() : playList(list, i))}
        className={`group grid grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,1fr)_9rem_4rem_auto] items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isCur ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'}`}
      >
        <div className="flex items-center justify-center text-[13px] text-white/40 tabular-nums">
          {isCur && playing ? (
            <span className="group-hover:hidden"><Bars /></span>
          ) : (
            <span className={`group-hover:hidden ${isCur ? 'text-[var(--bp-accent)]' : ''}`}>{i + 1}</span>
          )}
          <span className="hidden group-hover:block text-white"><Svg className="w-4 h-4">{isCur && playing ? Icon.pause : Icon.play}</Svg></span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <Art src={t.artwork} className="w-10 h-10 rounded-md shrink-0" />
          <div className="min-w-0">
            <p className={`text-[14px] truncate ${isCur ? 'text-[var(--bp-accent)] font-medium' : 'text-white'}`}>{t.title}</p>
            <p className="text-[12px] text-white/45 truncate">{t.artist}</p>
          </div>
        </div>
        <p className="hidden md:block text-[12px] text-white/35 truncate">{t.genre}{t.plays ? ` · ${fmtPlays(t.plays)} plays` : ''}</p>
        <p className="hidden md:block text-[12px] text-white/40 tabular-nums text-right">{fmtTime(t.duration)}</p>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => toggleLike(t)} title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'} className={`p-1.5 rounded-md transition-colors ${liked ? 'text-[var(--bp-accent)]' : 'text-white/35 opacity-100 md:opacity-0 group-hover:opacity-100 hover:text-white'}`}>
            <Svg className="w-[18px] h-[18px]" fill={liked ? 'currentColor' : 'none'}>{Icon.heart}</Svg>
          </button>
          <button onClick={() => enqueue(t, false)} title="Add to queue" className="hidden sm:block p-1.5 rounded-md text-white/35 md:opacity-0 group-hover:opacity-100 hover:text-white">
            <Svg className="w-[18px] h-[18px]">{Icon.queueAdd}</Svg>
          </button>
          <button onClick={() => { if (guard()) { setPickFor(t); setNewName(''); } }} title="Add to playlist" className="p-1.5 rounded-md text-white/35 md:opacity-0 group-hover:opacity-100 hover:text-white">
            <Svg className="w-[18px] h-[18px]">{Icon.plus}</Svg>
          </button>
          {opts.onRemove && (
            <button onClick={opts.onRemove} title="Remove from this playlist" className="p-1.5 rounded-md text-white/35 md:opacity-0 group-hover:opacity-100 hover:text-red-300">
              <Svg className="w-[18px] h-[18px]">{Icon.trash}</Svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const listOf = (list: Track[], empty: ReactNode, opts?: (t: Track) => { onRemove?: () => void }) =>
    list.length ? <div className="space-y-0.5">{list.map((t, i) => row(t, i, list, opts ? opts(t) : {}))}</div> : <div className="py-16 text-center text-sm text-white/35">{empty}</div>;

  const skeleton = (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="w-8" />
          <div className="w-10 h-10 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="flex-1 space-y-1.5"><div className="h-3 w-1/3 rounded bg-white/[0.06] animate-pulse" /><div className="h-2.5 w-1/5 rounded bg-white/[0.04] animate-pulse" /></div>
        </div>
      ))}
    </div>
  );

  const hero = (title: string, sub: string, list: Track[], art: ReactNode, extra?: ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6">
      {art}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-widest text-white/40">{sub}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1 truncate">{title}</h1>
        <p className="text-[13px] text-white/45 mt-2">{list.length} {list.length === 1 ? 'song' : 'songs'}{list.length ? ` · ${totalTime(list)}` : ''}</p>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button disabled={!list.length} onClick={() => { setShuffle(false); originalRef.current = null; playIndex(list, 0); }} className="h-11 px-6 rounded-full text-sm font-semibold text-white disabled:opacity-30 flex items-center gap-2" style={{ background: 'var(--bp-accent)' }}>
            <Svg className="w-4 h-4">{Icon.play}</Svg>Play
          </button>
          <button disabled={!list.length} onClick={() => { setShuffle(true); originalRef.current = list; playIndex(shuffled(list), 0); }} className="h-11 px-5 rounded-full text-sm font-medium bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 disabled:opacity-30 flex items-center gap-2">
            <Svg className="w-4 h-4">{Icon.shuffle}</Svg>Shuffle
          </button>
          {extra}
        </div>
      </div>
    </div>
  );

  const navBtn = (on: boolean, label: string, icon: ReactNode, onClick: () => void, count?: number) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors ${on ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white hover:bg-white/[0.04]'}`}>
      {icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {count !== undefined && <span className="text-[11px] text-white/30 tabular-nums">{count}</span>}
    </button>
  );

  useEffect(() => writeJson('bp-music-ai-' + owner, aiThread.slice(-8)), [aiThread, owner]);

  const runAi = async (prompt: string, shown?: string) => {
    if (aiBusy || !guard()) return;
    const q = prompt.trim();
    const uid = Date.now();
    setAiThread(t => [...t, { id: uid, role: 'user' as const, text: shown || q || 'Make me a playlist from my taste' }].slice(-12));
    setAiBusy(true);
    setAiInput('');
    window.setTimeout(() => document.getElementById('bp-ai-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
    try {
      const mix = await askMusicAi(q);
      setAiThread(t => [...t, { id: uid + 1, role: 'ai' as const, text: mix.reply, mix }].slice(-12));
    } catch (e) {
      setAiThread(t => [...t, { id: uid + 1, role: 'ai' as const, text: e instanceof Error ? e.message : 'BatProx AI could not answer right now.', error: true }].slice(-12));
    }
    setAiBusy(false);
    window.setTimeout(() => document.getElementById('bp-ai-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
  };

  const saveMix = (mix: AiMix) => libAction(() => createPlaylist(mix.name, undefined, mix.tracks), `Saved "${mix.name}" to your playlists`);

  const createFromPicker = async () => {
    const name = newName.trim();
    if (!name || !pickFor) return;
    if (await libAction(() => createPlaylist(name, pickFor), `Created "${name}" with this song`)) setPickFor(null);
  };

  let body: ReactNode = null;
  if (view.kind === 'home') {
    body = (
      <>
        <button
          onClick={() => { go({ kind: 'ai' }); if (!aiThread.length) void runAi('', 'Make a playlist from my taste'); }}
          className="w-full mb-8 text-left rounded-2xl p-5 flex items-center gap-4 border border-white/[0.08] hover:border-white/20 transition-colors"
          style={{ background: 'linear-gradient(120deg, rgba(var(--bp-glow), 0.28), rgba(236, 72, 153, 0.12) 60%, rgba(255, 255, 255, 0.02))' }}
        >
          <AiBadge size="w-12 h-12" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Made for you by BatProx AI</span>
            <span className="block text-[12px] text-white/55">{(lib.plays || []).length ? `Built from your most played songs and your likes` : 'Play and heart a few songs, then BatProx AI builds playlists from your taste'}</span>
          </span>
          <span className="hidden sm:block px-4 py-2 rounded-full bg-white text-black text-[13px] font-semibold">Make my mix</span>
        </button>
        {recent.length > 0 && (
          <section className="mb-9">
            <h2 className="text-lg font-semibold mb-3">Recently played</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recent.slice(0, 12).map((t, i) => (
                <button key={t.id} onClick={() => playList(recent, i)} className="group w-36 shrink-0 text-left p-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                  <div className="relative">
                    <Art src={t.artwork} className="w-32 h-32 rounded-lg" />
                    <span className="absolute right-2 bottom-2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all" style={{ background: 'var(--bp-accent)' }}>
                      <Svg className="w-4 h-4">{Icon.play}</Svg>
                    </span>
                  </div>
                  <p className="text-[13px] mt-2 truncate">{t.title}</p>
                  <p className="text-[11px] text-white/40 truncate">{t.artist}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        <section>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <h2 className="text-lg font-semibold">Trending{genre !== 'All' ? ` in ${genre}` : ''}</h2>
            <div className="ml-auto flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
              {TIMES.map(t => (
                <button key={t.id} onClick={() => setTime(t.id)} className={`px-3 py-1 rounded-full text-[12px] transition-colors ${time === t.id ? 'bg-white text-black font-medium' : 'text-white/55 hover:text-white'}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GENRES.map(g => (
              <button key={g} onClick={() => setGenre(g)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border transition-colors ${genre === g ? 'border-transparent text-white' : 'border-white/10 text-white/60 hover:text-white hover:border-white/25'}`} style={genre === g ? { background: 'var(--bp-accent)' } : undefined}>{g}</button>
            ))}
          </div>
          {homeState === 'loading' ? skeleton : homeState === 'error' ? (
            <div className="py-16 text-center">
              <p className="text-sm text-white/50">Could not load trending music right now.</p>
              <button onClick={() => setReloadKey(k => k + 1)} className="mt-3 text-[13px] underline text-white/60 hover:text-white">Try again</button>
            </div>
          ) : listOf(home, 'Nothing trending here yet. Try another genre.')}
        </section>
      </>
    );
  } else if (view.kind === 'search') {
    body = (
      <section>
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        {searchState === 'idle' && <p className="py-16 text-center text-sm text-white/35">Search for any song or artist. Every result plays in full.</p>}
        {searchState === 'loading' && skeleton}
        {searchState === 'error' && <p className="py-16 text-center text-sm text-white/50">Search is not responding right now. Try again in a moment.</p>}
        {searchState === 'ok' && listOf(results, `No songs found for "${query.trim()}".`)}
      </section>
    );
  } else if (view.kind === 'liked') {
    body = (
      <>
        {hero('Liked Songs', 'Your library', lib.liked, (
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl shrink-0 flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg, var(--bp-accent), #1e1b4b)' }}>
            <Svg className="w-16 h-16 text-white" fill="currentColor">{Icon.heart}</Svg>
          </div>
        ))}
        {listOf(lib.liked, signedIn ? 'Songs you heart show up here and stay saved to your BatProx account.' : 'Sign in to BatProx to save songs.')}
      </>
    );
  } else if (view.kind === 'library') {
    body = (
      <section>
        <h1 className="text-2xl font-bold mb-5">Your library</h1>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <button onClick={() => go({ kind: 'liked' })} className="text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06]">
            <div className="aspect-square rounded-lg flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, var(--bp-accent), #1e1b4b)' }}>
              <Svg className="w-12 h-12 text-white" fill="currentColor">{Icon.heart}</Svg>
            </div>
            <p className="text-[14px] font-medium">Liked Songs</p>
            <p className="text-[12px] text-white/40">{lib.liked.length} songs</p>
          </button>
          {lib.playlists.map(p => (
            <button key={p.id} onClick={() => go({ kind: 'playlist', id: p.id })} className="text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06]">
              <Art src={p.tracks[0]?.artwork || ''} className="w-full aspect-square rounded-lg mb-3" />
              <p className="text-[14px] font-medium truncate">{p.name}</p>
              <p className="text-[12px] text-white/40">{p.tracks.length} songs</p>
            </button>
          ))}
        </div>
        {!signedIn && <p className="mt-6 text-sm text-white/40">Sign in to BatProx to keep a library.</p>}
      </section>
    );
  } else if (view.kind === 'ai') {
    body = (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <AiBadge size="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-bold">BatProx AI</h1>
              <p className="text-[13px] text-white/45">Learns from what you play and heart, then finds songs you have not heard yet.</p>
            </div>
          </div>
          {aiThread.length === 0 && !aiBusy && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 mb-5">
              <p className="text-[14px] text-white/75">Ask for a vibe, an artist or a mood, or let me build a playlist from your taste.</p>
              <p className="text-[12px] text-white/40 mt-1.5">Songs count toward your taste after you listen for 30 seconds.</p>
            </div>
          )}
          <div className="space-y-5">
            {aiThread.map(turn => turn.role === 'user' ? (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-[14px] text-white" style={{ background: 'var(--bp-accent)' }}>{turn.text}</p>
              </div>
            ) : (
              <div key={turn.id} className="flex gap-3">
                <AiBadge size="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] leading-relaxed pt-1 ${turn.error ? 'text-red-300' : 'text-white/85'}`}>{turn.text}</p>
                  {turn.mix && turn.mix.tracks.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold truncate">{turn.mix.name}</p>
                          <p className="text-[11px] text-white/40">
                            {turn.mix.tracks.length} songs · {totalTime(turn.mix.tracks)}
                            {turn.mix.basedOn.artists.length ? ` · because you play ${turn.mix.basedOn.artists.slice(0, 2).join(' and ')}` : ''}
                          </p>
                        </div>
                        <button onClick={() => { const m = turn.mix; if (m) playList(m.tracks, 0); }} className="h-9 px-4 rounded-full text-[13px] font-semibold text-white flex items-center gap-1.5" style={{ background: 'var(--bp-accent)' }}>
                          <Svg className="w-3.5 h-3.5">{Icon.play}</Svg>Play
                        </button>
                        <button onClick={() => { const m = turn.mix; if (m) void saveMix(m); }} className="h-9 px-4 rounded-full text-[13px] bg-white/[0.07] hover:bg-white/[0.12] border border-white/10">Save as playlist</button>
                      </div>
                      {listOf(turn.mix.tracks, '')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiBusy && (
              <div className="flex gap-3 items-center">
                <AiBadge size="w-8 h-8" />
                <span className="text-[13px] text-white/50">BatProx AI is picking songs for you</span>
                <span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              </div>
            )}
            <div id="bp-ai-end" />
          </div>
          <div className="flex flex-wrap gap-2 mt-7">
            {AI_CHIPS.map(c => (
              <button key={c.label} disabled={aiBusy} onClick={() => void runAi(c.prompt, c.label)} className="px-3.5 py-2 rounded-full text-[13px] border border-white/10 text-white/70 hover:text-white hover:border-white/25 disabled:opacity-40">{c.label}</button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); if (aiInput.trim()) void runAi(aiInput); }} className="mt-3 flex gap-2">
            <input
              value={aiInput}
              maxLength={300}
              onChange={e => setAiInput(e.target.value)}
              placeholder="Ask BatProx AI for a vibe, an artist or a mood"
              className="flex-1 h-11 px-4 rounded-full bg-white/[0.07] border border-white/10 text-sm placeholder:text-white/35 focus:outline-none focus:border-white/30"
            />
            <button type="submit" disabled={aiBusy || !aiInput.trim()} className="h-11 px-5 rounded-full text-sm font-semibold text-white disabled:opacity-35" style={{ background: 'var(--bp-accent)' }}>Ask</button>
          </form>
          {aiThread.length > 0 && !aiBusy && <button onClick={() => setAiThread([])} className="mt-3 text-[12px] text-white/35 hover:text-white/70">Clear conversation</button>}
        </section>
        <aside className="min-w-0">
          <h2 className="text-sm font-semibold mb-3">Your most played</h2>
          {topPlayed.length === 0 ? (
            <p className="text-[12px] text-white/40 leading-relaxed">Songs you listen to for 30 seconds or more show up here. BatProx AI uses them to learn your taste.</p>
          ) : (
            <div className="space-y-0.5">
              {topPlayed.map((t, i) => (
                <button key={t.id} onClick={() => playList(topPlayed, i)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] text-left">
                  <span className="w-4 text-[12px] text-white/35 tabular-nums">{i + 1}</span>
                  <Art src={t.artwork} className="w-9 h-9 rounded shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] truncate">{t.title}</span>
                    <span className="block text-[11px] text-white/40 truncate">{t.artist}</span>
                  </span>
                  <span className="text-[11px] text-white/35 tabular-nums">{t.n || 1}x</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    );
  } else if (playlist) {
    body = (
      <>
        {hero(playlist.name, 'Playlist', playlist.tracks, (
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl shrink-0 overflow-hidden shadow-2xl grid grid-cols-2">
            {playlist.tracks.length >= 4
              ? playlist.tracks.slice(0, 4).map(t => <Art key={t.id} src={t.artwork} className="w-full h-full" />)
              : <Art src={playlist.tracks[0]?.artwork || ''} className="col-span-2 w-full h-full" />}
          </div>
        ), (
          <>
            {renaming ? (
              <form onSubmit={async e => { e.preventDefault(); if (await libAction(() => renamePlaylist(playlist.id, renaming.trim()), 'Playlist renamed')) setRenaming(''); }} className="flex items-center gap-2">
                <input autoFocus value={renaming} maxLength={60} onChange={e => setRenaming(e.target.value)} className="h-11 px-4 rounded-full bg-black/50 border border-white/15 text-sm focus:outline-none focus:border-[var(--bp-accent)]" />
                <button type="submit" disabled={!renaming.trim()} className="h-11 px-4 rounded-full bg-white text-black text-sm font-medium disabled:opacity-40">Save</button>
                <button type="button" onClick={() => setRenaming('')} className="h-11 px-3 text-sm text-white/50 hover:text-white">Cancel</button>
              </form>
            ) : (
              <button onClick={() => setRenaming(playlist.name)} className="h-11 px-4 rounded-full text-sm text-white/60 hover:text-white hover:bg-white/[0.06]">Rename</button>
            )}
            {confirmDelete ? (
              <>
                <button onClick={async () => { if (await libAction(() => deletePlaylist(playlist.id), `Deleted "${playlist.name}"`)) go({ kind: 'library' }); }} className="h-11 px-4 rounded-full text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white">Delete for good</button>
                <button onClick={() => setConfirmDelete(false)} className="h-11 px-3 text-sm text-white/50 hover:text-white">Keep it</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="h-11 px-4 rounded-full text-sm text-white/60 hover:text-red-300 hover:bg-red-500/10">Delete</button>
            )}
          </>
        ))}
        {listOf(playlist.tracks, 'This playlist is empty. Use the + on any song to add it here.', t => ({ onRemove: () => { void libAction(() => removeFromPlaylist(playlist.id, t.id), 'Removed from playlist'); } }))}
      </>
    );
  }

  const volIcon = muted || volume === 0 ? Icon.mute : Icon.vol;

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans text-white">
      <style>{'@keyframes bpbar{0%{transform:scaleY(.25)}100%{transform:scaleY(1)}}'}</style>
      <AmbientBg />
      <SideRail />

      <div className="relative z-10 h-full flex sm:pl-20">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-1 p-3 pb-28 border-r border-white/[0.06] bg-black/30 overflow-y-auto">
          <button onClick={() => navigate('/dashboard')} className="mb-3 h-9 px-3 flex items-center gap-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.05]">
            <Svg className="w-4 h-4" sw={2}>{Icon.back}</Svg>BatProx home
          </button>
          {navBtn(view.kind === 'home', 'Discover', <Svg className="w-5 h-5">{Icon.home}</Svg>, () => go({ kind: 'home' }))}
          {navBtn(view.kind === 'search', 'Search', <Svg className="w-5 h-5">{Icon.search}</Svg>, () => { go({ kind: 'search' }); window.setTimeout(() => document.getElementById('bp-music-q')?.focus(), 0); })}
          {navBtn(view.kind === 'library', 'Your library', <Svg className="w-5 h-5">{Icon.library}</Svg>, () => go({ kind: 'library' }))}
          {navBtn(view.kind === 'ai', 'BatProx AI', <AiBadge size="w-5 h-5" />, () => go({ kind: 'ai' }))}
          <div className="h-px bg-white/[0.06] my-3" />
          {navBtn(view.kind === 'liked', 'Liked Songs', <span className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--bp-accent)' }}><Svg className="w-3 h-3" fill="currentColor">{Icon.heart}</Svg></span>, () => go({ kind: 'liked' }), lib.liked.length)}
          <div className="flex items-center mt-4 mb-1 px-3">
            <p className="text-[11px] uppercase tracking-widest text-white/35 flex-1">Playlists</p>
            <button onClick={() => { if (guard()) { setPickFor({ id: '', title: '', artist: '', handle: '', artwork: '', duration: 0, genre: '' }); setNewName(''); } }} title="New playlist" className="p-1 rounded text-white/45 hover:text-white">
              <Svg className="w-4 h-4" sw={2}>{Icon.plus}</Svg>
            </button>
          </div>
          {lib.playlists.length === 0 && <p className="px-3 text-[12px] text-white/30">No playlists yet.</p>}
          {lib.playlists.map(p => navBtn(view.kind === 'playlist' && view.id === p.id, p.name, <Art src={p.tracks[0]?.artwork || ''} className="w-5 h-5 rounded" />, () => go({ kind: 'playlist', id: p.id }), p.tracks.length))}
        </aside>

        <main id="bp-music-scroll" className="flex-1 min-w-0 overflow-y-auto pb-36">
          <div className="sticky top-0 z-20 px-4 sm:px-8 py-3 flex items-center gap-3 bg-black/60 backdrop-blur-xl border-b border-white/[0.05]">
            <button onClick={() => navigate('/dashboard')} className="lg:hidden h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12]" aria-label="Home">
              <Svg className="w-4 h-4" sw={2}>{Icon.back}</Svg>
            </button>
            <div className="relative flex-1 max-w-md">
              <Svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">{Icon.search}</Svg>
              <input
                id="bp-music-q"
                value={query}
                onChange={e => { setQuery(e.target.value); if (view.kind !== 'search') setView({ kind: 'search' }); }}
                onFocus={() => { if (query.trim() && view.kind !== 'search') setView({ kind: 'search' }); }}
                placeholder="What do you want to listen to?"
                className="w-full h-10 pl-10 pr-9 rounded-full bg-white/[0.07] border border-white/10 text-sm placeholder:text-white/35 focus:outline-none focus:border-white/30 focus:bg-white/[0.1]"
              />
              {query && (
                <button onClick={() => { setQuery(''); document.getElementById('bp-music-q')?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white" aria-label="Clear search">
                  <Svg className="w-3.5 h-3.5" sw={2.2}>{Icon.close}</Svg>
                </button>
              )}
            </div>
            <div className="lg:hidden flex gap-1">
              {navBtnSmall(view.kind === 'home', 'Discover', () => go({ kind: 'home' }))}
              {navBtnSmall(view.kind === 'library' || view.kind === 'liked' || view.kind === 'playlist', 'Library', () => go({ kind: 'library' }))}
              {navBtnSmall(view.kind === 'ai', 'AI', () => go({ kind: 'ai' }))}
            </div>
            <p className="hidden md:block ml-auto text-[11px] text-white/30">Music by Audius</p>
          </div>
          <div className="px-4 sm:px-8 pt-6">{body}</div>
        </main>
      </div>

      <footer className="fixed bottom-0 inset-x-0 z-40 sm:pl-20 bg-[#08080c]/95 backdrop-blur-xl border-t border-white/[0.07]">
        <div className="h-[84px] px-4 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {current ? (
              <>
                <Art src={current.artwork} className="w-14 h-14 rounded-md shrink-0 shadow-lg" />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium truncate">{current.title}</p>
                  <p className="text-[12px] text-white/45 truncate">{current.artist}</p>
                </div>
                <button onClick={() => toggleLike(current)} title={likedIds.has(current.id) ? 'Remove from Liked Songs' : 'Save to Liked Songs'} className={`p-2 shrink-0 ${likedIds.has(current.id) ? 'text-[var(--bp-accent)]' : 'text-white/45 hover:text-white'}`}>
                  <Svg className="w-5 h-5" fill={likedIds.has(current.id) ? 'currentColor' : 'none'}>{Icon.heart}</Svg>
                </button>
              </>
            ) : (
              <p className="text-[13px] text-white/35">Pick a song to start listening</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={toggleShuffle} title="Shuffle" className={`hidden md:block p-2 relative ${shuffle ? 'text-[var(--bp-accent)]' : 'text-white/50 hover:text-white'}`}>
                <Svg className="w-[18px] h-[18px]">{Icon.shuffle}</Svg>
                {shuffle && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 h-1 rounded-full bg-current" />}
              </button>
              <button onClick={prev} disabled={!current} title="Previous" className="p-2 text-white/70 hover:text-white disabled:opacity-30"><Svg className="w-5 h-5">{Icon.prev}</Svg></button>
              <button onClick={toggle} disabled={!current} title={playing ? 'Pause' : 'Play'} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40">
                {loading && playing ? <span className="w-4 h-4 rounded-full border-2 border-black/70 border-t-transparent animate-spin" /> : <Svg className="w-5 h-5">{playing ? Icon.pause : Icon.play}</Svg>}
              </button>
              <button onClick={() => next(false)} disabled={!current} title="Next" className="p-2 text-white/70 hover:text-white disabled:opacity-30"><Svg className="w-5 h-5">{Icon.next}</Svg></button>
              <button onClick={cycleRepeat} title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'} className={`hidden md:block p-2 relative ${repeat !== 'off' ? 'text-[var(--bp-accent)]' : 'text-white/50 hover:text-white'}`}>
                <Svg className="w-[18px] h-[18px]">{Icon.repeat}</Svg>
                {repeat === 'one' && <span className="absolute top-0.5 right-0.5 text-[9px] font-bold">1</span>}
                {repeat !== 'off' && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 h-1 rounded-full bg-current" />}
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 w-full max-w-xl">
              <span className="text-[11px] text-white/45 tabular-nums w-10 text-right">{fmtTime(pos)}</span>
              <Seek value={pos} max={dur} buffered={buffered} onChange={seek} className="flex-1" />
              <span className="text-[11px] text-white/45 tabular-nums w-10">{fmtTime(dur)}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-end gap-2">
            <button onClick={() => setQueueOpen(o => !o)} title="Queue" className={`p-2 ${queueOpen ? 'text-[var(--bp-accent)]' : 'text-white/50 hover:text-white'}`}><Svg className="w-[18px] h-[18px]">{Icon.queue}</Svg></button>
            <button onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'} className="p-2 text-white/50 hover:text-white"><Svg className="w-[18px] h-[18px]">{volIcon}</Svg></button>
            <Seek value={muted ? 0 : volume} max={1} onChange={v => { setVolume(v); setMuted(false); }} className="w-28" />
          </div>
        </div>
        <div className="md:hidden absolute top-0 inset-x-0 sm:left-20">
          <div className="h-0.5 bg-white/10"><div className="h-full" style={{ width: dur ? `${(pos / dur) * 100}%` : '0%', background: 'var(--bp-accent)' }} /></div>
        </div>
      </footer>

      {queueOpen && (
        <aside className="fixed right-0 top-0 bottom-[84px] z-30 w-full sm:w-96 bg-[#0b0b11]/97 backdrop-blur-xl border-l border-white/[0.07] flex flex-col">
          <div className="h-14 px-4 flex items-center border-b border-white/[0.06]">
            <p className="font-semibold">Queue</p>
            <p className="ml-2 text-[12px] text-white/35">{queue.length} songs</p>
            <button onClick={() => setQueueOpen(false)} className="ml-auto p-1.5 text-white/50 hover:text-white" aria-label="Close queue"><Svg className="w-4 h-4" sw={2}>{Icon.close}</Svg></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {queue.length === 0 && <p className="py-12 text-center text-sm text-white/35">Your queue is empty.</p>}
            {queue.map((t, i) => (
              <div key={t.id + '-q-' + i} onClick={() => playIndex(queue, i)} className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer ${i === index ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'} ${i < index ? 'opacity-45' : ''}`}>
                <Art src={t.artwork} className="w-10 h-10 rounded shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] truncate ${i === index ? 'text-[var(--bp-accent)]' : ''}`}>{t.title}</p>
                  <p className="text-[11px] text-white/40 truncate">{t.artist}</p>
                </div>
                {i === index ? (playing ? <Bars /> : <span className="text-[10px] text-white/40">paused</span>) : (
                  <button onClick={e => { e.stopPropagation(); removeFromQueue(i); }} className="p-1 text-white/30 opacity-0 group-hover:opacity-100 hover:text-white" aria-label="Remove from queue">
                    <Svg className="w-3.5 h-3.5" sw={2}>{Icon.close}</Svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {pickFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPickFor(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-[#111118] border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
              {pickFor.id && <Art src={pickFor.artwork} className="w-11 h-11 rounded-md shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{pickFor.id ? 'Add to playlist' : 'New playlist'}</p>
                {pickFor.id && <p className="text-[12px] text-white/45 truncate">{pickFor.title} · {pickFor.artist}</p>}
              </div>
              <button onClick={() => setPickFor(null)} className="p-1.5 text-white/50 hover:text-white" aria-label="Close"><Svg className="w-4 h-4" sw={2}>{Icon.close}</Svg></button>
            </div>
            {pickFor.id && lib.playlists.length > 0 && (
              <div className="max-h-64 overflow-y-auto p-2">
                {lib.playlists.map(p => {
                  const has = p.tracks.some(t => t.id === pickFor.id);
                  return (
                    <button key={p.id} disabled={has} onClick={async () => { if (await libAction(() => addToPlaylist(p.id, pickFor), `Added to "${p.name}"`)) setPickFor(null); }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] disabled:opacity-45 disabled:hover:bg-transparent text-left">
                      <Art src={p.tracks[0]?.artwork || ''} className="w-9 h-9 rounded shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] truncate">{p.name}</span>
                        <span className="block text-[11px] text-white/35">{has ? 'already in this playlist' : `${p.tracks.length} songs`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (pickFor.id) { await createFromPicker(); return; }
                const name = newName.trim();
                if (name && (await libAction(() => createPlaylist(name), `Created "${name}"`))) setPickFor(null);
              }}
              className="p-4 border-t border-white/[0.06] flex gap-2"
            >
              <input autoFocus value={newName} maxLength={60} onChange={e => setNewName(e.target.value)} placeholder="New playlist name" className="flex-1 h-10 px-3 rounded-lg bg-black/50 border border-white/10 text-sm focus:outline-none focus:border-[var(--bp-accent)]" />
              <button type="submit" disabled={!newName.trim()} className="h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-35" style={{ background: 'var(--bp-accent)' }}>Create</button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[100px] z-50 px-4 py-2.5 rounded-full bg-white text-black text-[13px] font-medium shadow-2xl max-w-[90vw] truncate">{toast}</div>
      )}
    </div>
  );
}

function navBtnSmall(on: boolean, label: string, onClick: () => void) {
  return (
    <button key={label} onClick={onClick} className={`h-9 px-3 rounded-full text-[13px] ${on ? 'bg-white text-black font-medium' : 'bg-white/[0.06] text-white/70'}`}>{label}</button>
  );
}
