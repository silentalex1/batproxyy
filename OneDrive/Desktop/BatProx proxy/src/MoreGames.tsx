import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Settings from './Settings';
import { AmbientBg, BatteryIndicator, SideRail, TopBar, NavBtn } from './Chrome';
import { startPresence, setPresenceGame, trackGameSeconds, commitRecent, bumpRecentSecs, markRecentUnavailable, removeRecent, clearRecents, getRecentGames, syncRecentIcons, loadServerRecents, extractGameMedia } from './presence';
import type { RecentGame } from './presence';
import { useLowPower } from './power';

declare global {
  interface Window {
    Lumin: any;
  }
}

const FALLBACK_GENRES = ['Action', 'Adventure', 'Arcade', 'Puzzle', 'Racing', 'Shooting', 'Sports', 'Strategy', 'Retro', 'Multiplayer', 'Idle', '2 Player'];

export default function MoreGames() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [myGamesSearch, setMyGamesSearch] = useState('');
  const [myGames, setMyGames] = useState<Array<{ name: string; filename: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const CONTAINER_ID = 'games';
  const [luminInitialized, setLuminInitialized] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [notice, setNotice] = useState('');
  const [showGamesNotice, setShowGamesNotice] = useState(() => !localStorage.getItem('batprox-games-seen'));
  const [suggestionGenre, setSuggestionGenre] = useState('Feedback suggestions');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [userIdentifier] = useState(() => localStorage.getItem('batprox-user') || 'anonymous');
  const [recentGames, setRecentGames] = useState(() => getRecentGames());
  const [recentSort, setRecentSort] = useState<'last' | 'most'>(() => { try { return (localStorage.getItem('batprox-recent-sort') as 'last' | 'most') || 'last'; } catch { return 'last'; } });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gamesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const luminReadyRef = useRef(false);
  const gameStartRef = useRef<{ name: string; at: number; media: { icon: string; url: string; id: string } } | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLowPower();

  useEffect(() => {
    loadMyGames();
    startPresence();
    loadServerRecents().then(g => setRecentGames(g));
    const onFs = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        const c = document.getElementById(CONTAINER_ID);
        if (c) c.classList.remove('bp-fill-mode');
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const setSort = (s: 'last' | 'most') => {
    setRecentSort(s);
    try { localStorage.setItem('batprox-recent-sort', s); } catch {}
  };

  const sortedRecents = [...recentGames].sort((a, b) => recentSort === 'last' ? b.ts - a.ts : b.plays - a.plays || b.ts - a.ts);

  const fmtAgo = (ts: number) => {
    if (!ts) return '—';
    const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const grabCardImage = (): string => {
    try {
      const container = document.getElementById(CONTAINER_ID);
      if (!container) return '';
      const roots: Array<Document | ShadowRoot> = [document];
      if (container.shadowRoot) roots.push(container.shadowRoot);
      for (const r of roots) {
        const imgs = r.querySelectorAll('#' + CONTAINER_ID + ' img, #' + CSS.escape(CONTAINER_ID) + ' img');
        for (const el of Array.from(imgs)) {
          const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src || '';
          if (src && src.startsWith('http') && !src.includes('data:')) return src;
        }
      }
      const all = container.shadowRoot ? container.shadowRoot.querySelectorAll('img') : [];
      for (const el of Array.from(all)) {
        const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src || '';
        if (src && src.startsWith('http')) return src;
      }
    } catch {}
    return '';
  };

  const gameSurface = (): HTMLElement | null => {
    try {
      const container = document.getElementById(CONTAINER_ID);
      if (!container) return null;
      const root = container.shadowRoot;
      if (root) {
        const inner = root.querySelector('[class*="player"], [class*="stage"], [class*="game"], [id*="player"], [id*="stage"], [id*="game"]');
        if (inner instanceof HTMLElement) return inner;
      }
      return container;
    } catch { return document.getElementById(CONTAINER_ID); }
  };

  const toggleGameFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const target = gameSurface();
    if (!target) return;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (target.requestFullscreen) { target.requestFullscreen().catch(() => fillMode(target)); return; }
    if (isIOS) { fillMode(target); return; }
    const c = document.getElementById(CONTAINER_ID);
    if (c && c.requestFullscreen) c.requestFullscreen().catch(() => {});
  };

  const fillMode = (el: HTMLElement) => {
    el.classList.add('bp-fill-mode');
    setIsFullscreen(true);
  };

  const exitFillMode = () => {
    const c = document.getElementById(CONTAINER_ID);
    if (c) c.classList.remove('bp-fill-mode');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
    removeFsButton();
  };

  const removeFsButton = () => {
    try {
      const container = document.getElementById(CONTAINER_ID);
      const roots: Array<Document | ShadowRoot> = [document];
      if (container && container.shadowRoot) roots.push(container.shadowRoot);
      for (const r of roots) {
        r.querySelectorAll('[data-bp-fs]').forEach(n => n.remove());
      }
    } catch {}
  };

  const fixGameIframes = () => {
    try {
      const container = document.getElementById(CONTAINER_ID);
      if (!container || !container.shadowRoot) return;
      const frames = container.shadowRoot.querySelectorAll('iframe');
      frames.forEach(f => {
        try {
          const el = f as HTMLIFrameElement;
          const allow = el.getAttribute('allow') || '';
          if (!allow.includes('fullscreen')) el.setAttribute('allow', (allow ? allow + '; ' : '') + 'fullscreen');
          if (!allow.includes('pointer-lock')) el.setAttribute('allow', (el.getAttribute('allow') || '') + '; pointer-lock');
          el.removeAttribute('allowfullscreen');
          el.removeAttribute('allowFullScreen');
        } catch {}
      });
    } catch {}
  };

  const mountFsButton = () => {
    try {
      const L = window.Lumin as any;
      if (L && ['fullscreen', 'setFullscreen', 'toggleFullscreen', 'enterFullscreen', 'requestFullscreen'].some(k => typeof L[k] === 'function')) return;
      const container = document.getElementById(CONTAINER_ID);
      if (!container || !container.shadowRoot) return;
      const root = container.shadowRoot;
      if (root.querySelector('[data-bp-fs]')) return;
      const all = Array.from(root.querySelectorAll('button, [role="button"], div, span'));
      const exitBtn = all.find(n => /exit game/i.test(n.textContent || '')) as HTMLElement | undefined;
      const btn = document.createElement('button');
      btn.setAttribute('data-bp-fs', '1');
      btn.textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
      btn.setAttribute('style', 'height:32px;padding:0 12px;margin:0 6px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.55);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;');
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleGameFullscreen(); });
      if (exitBtn && exitBtn.parentElement) {
        exitBtn.parentElement.insertBefore(btn, exitBtn.nextSibling);
      } else {
        const bar = (root.querySelector('[class*="toolbar"], [class*="header"], [class*="bar"]') as HTMLElement) || null;
        if (bar) bar.appendChild(btn);
        else return;
      }
      const sync = () => { btn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; };
      document.addEventListener('fullscreenchange', sync, { once: false });
    } catch {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const inGames = t.closest && (t.closest('#games') || t.closest('iframe'));
        if (inGames || tag === 'BODY' || tag === 'HTML') {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    if (luminInitialized) {
      loadCategories();
    }
  }, [luminInitialized]);

  const loadCategories = async () => {
    try {
      if (window.Lumin && luminInitialized) {
        const { categories } = await window.Lumin.getCategories();
        if (categories && categories.length > 0) {
          setAvailableCategories(categories);
        } else {
          setAvailableCategories(FALLBACK_GENRES);
        }
      }
    } catch {
      setAvailableCategories(FALLBACK_GENRES);
    }
  };

  const loadMyGames = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const response = await fetch('/api/my-games', {
        signal: controller.signal
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setMyGames([]);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setMyGames(data.games || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setMyGames([]);
    } finally {
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    const originalError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (/UnityLoader|UnityModule|Unity/i.test(message)) {
        return;
      }
      if (/firebase|Firebase/i.test(message)) {
        return;
      }
      if (/Unexpected identifier/i.test(message)) {
        return;
      }
      originalError.apply(console, args);
    };

    const loadScript = () => {
      setLoading(true);
      
      const cleanupContainer = () => {
        const container = document.getElementById(CONTAINER_ID);
        if (container) {
          container.innerHTML = '';
          if (container.shadowRoot) {
            container.innerHTML = '';
          }
        }
      };

      cleanupContainer();

      const LUMIN_CDN = 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/fonts.min.js';
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          const raw = String(scriptURL);
          if (/^(blob:|data:)/i.test(raw) || /cdn\.jsdelivr\.net\/gh\/luminsdk/i.test(raw) || /\/lumin\.(js|worker\.js)/i.test(raw)) {
            super(scriptURL, options);
            return;
          }
          if (/lumin\.worker|milpagan|drkesten|catholicrebuttals|hpsschools|luminsdk/i.test(raw)) {
            super(LUMIN_CDN, options);
            return;
          }
          super(scriptURL, options);
        }
      } as typeof Worker;

      const nativeFetch = window.fetch.bind(window);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (href && /https?:\/\/([a-z0-9.-]+\.)?luminsdk\.com/i.test(href)) {
          return nativeFetch('/proxy?url=' + encodeURIComponent(href), init);
        }
        return nativeFetch(input as RequestInfo, init);
      }) as typeof fetch;

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const loadCdn = () => {
        const fallback = document.createElement('script');
        fallback.src = LUMIN_CDN;
        fallback.async = true;
        fallback.crossOrigin = 'anonymous';
        fallback.onload = () => setTimeout(() => initializeLumin(), 120);
        fallback.onerror = () => {
          setError('Failed to load Lumin SDK. Please check your internet connection.');
          setLoading(false);
        };
        document.body.appendChild(fallback);
      };
      if (!isLocal) { loadCdn(); return; }
      const script = document.createElement('script');
      script.src = '/lumin.js';
      script.async = true;
      script.onload = () => {
        setTimeout(() => initializeLumin(), 120);
      };
      script.onerror = loadCdn;
      document.body.appendChild(script);
    };

    const timer = setTimeout(loadScript, 100);

    const handleGameErrors = (event: ErrorEvent) => {
      if (event.filename && (event.filename.includes('lumin') || event.filename.includes('scramjet') || event.filename.includes('fn'))) {
        event.preventDefault();
        return;
      }
      if (event.message && /domain fetch failed|luminsdk|lumin\.worker/i.test(event.message)) {
        event.preventDefault();
      }
      if (event.message && /UnityLoader|UnityModule|Unity/i.test(event.message)) {
        event.preventDefault();
        console.log('Unity game error suppressed:', event.message);
      }
      if (event.message && /firebase|Firebase/i.test(event.message)) {
        event.preventDefault();
        console.log('Firebase error suppressed:', event.message);
      }
      if (event.message && /Unexpected identifier/i.test(event.message)) {
        event.preventDefault();
        console.log('Script syntax error suppressed:', event.message);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason && (event.reason.message || String(event.reason));
      if (msg && /BareMux|domain fetch failed|luminsdk|lumin/i.test(msg)) {
        event.preventDefault();
        if (/domain fetch failed/i.test(msg) && !luminReadyRef.current) {
          setAvailableCategories(FALLBACK_GENRES);
          setLoading(false);
        }
      }
      if (msg && /UnityLoader|UnityModule|Unity/i.test(msg)) {
        event.preventDefault();
        console.log('Unity game promise rejection suppressed:', msg);
      }
      if (msg && /firebase|Firebase/i.test(msg)) {
        event.preventDefault();
        console.log('Firebase promise rejection suppressed:', msg);
      }
      if (msg && /Unexpected identifier/i.test(msg)) {
        event.preventDefault();
        console.log('Script syntax promise rejection suppressed:', msg);
      }
    };

    window.addEventListener('error', handleGameErrors);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('error', handleGameErrors);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalError;
      const scripts = document.querySelectorAll('script[src*="luminsdk"]');
      scripts.forEach(script => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      });
      
      const container = document.getElementById(CONTAINER_ID);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [CONTAINER_ID]);

  const initializeLumin = () => {
    try {
      if (luminInitialized) {
        console.log('LuminSDK already initialized');
        return;
      }

      const container = document.getElementById(CONTAINER_ID);
      if (!container) {
        console.error('Container not found:', CONTAINER_ID);
        setError('Games container not found. Retrying...');
        setTimeout(() => initializeLumin(), 500);
        return;
      }

      if (container.shadowRoot) {
        console.log('Container already has shadow root, skipping initialization');
        setLoading(false);
        return;
      }

      if (window.Lumin) {
        window.Lumin.init({
          container: `#${CONTAINER_ID}`,
          theme: 'dark',
          columns: 4,
          rows: 3,
          gamesPerPage: 12,
          showSearch: false,
          showCategories: true,
          showRandom: true,
          onReady: () => {
            console.log('LuminSDK is ready');
            luminReadyRef.current = true;
            setLuminInitialized(true);
            setLoading(false);
            applyCustomStyles(CONTAINER_ID);
          },
          onError: (err: any) => {
            const msg = err && err.message ? String(err.message) : '';
            if (/domain fetch failed|network|fetch/i.test(msg)) {
              setAvailableCategories(FALLBACK_GENRES);
              setNotice('Game network is slow right now. My Games below still work.');
              setTimeout(() => setNotice(''), 4000);
              setLoading(false);
              return;
            }
            if (!msg || /shadow/i.test(msg)) {
              setError('SDK initialization conflict. Please refresh the page.');
            } else if (msg.includes('Container not found')) {
              setError('Container initialization failed. Retrying...');
              setTimeout(() => initializeLumin(), 1000);
            } else {
              setError('LuminSDK error: ' + msg);
            }
            setLoading(false);
          },
          onGameStart: (game: any) => {
            const media = extractGameMedia(game);
            const name = String((game && (game.title || game.name || media.id)) || 'game');
            if (!media.icon) media.icon = grabCardImage();
            gameStartRef.current = { name, at: Date.now(), media };
            setPresenceGame(name);
            if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
            commitTimerRef.current = setTimeout(() => {
              const cur = gameStartRef.current;
              if (!cur) return;
              commitRecent(cur.name, cur.media);
              setRecentGames(getRecentGames());
            }, 12000);
            setTimeout(() => { mountFsButton(); fixGameIframes(); }, 600);
            setTimeout(() => { mountFsButton(); fixGameIframes(); }, 1800);
            setTimeout(() => { mountFsButton(); fixGameIframes(); }, 3500);
          },
          onGameEnd: () => {
            const s = gameStartRef.current;
            if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
            if (s) {
              const secs = (Date.now() - s.at) / 1000;
              trackGameSeconds(s.name, secs);
              bumpRecentSecs(s.name, secs);
              setRecentGames(getRecentGames());
              gameStartRef.current = null;
            }
            setPresenceGame('');
            exitFillMode();
          },
          onGameError: (err: any) => {
            console.error('Game error:', err);
            const errorMsg = err && err.message ? String(err.message) : String(err);
            if (/UnityLoader|UnityModule|Unity/i.test(errorMsg)) {
              console.log('Unity game error handled silently');
              return;
            }
            if (/firebase|Firebase/i.test(errorMsg)) {
              console.log('Firebase error handled silently');
              return;
            }
            setError('Game failed to load: ' + errorMsg);
          }
        });
      } else {
        setError('Lumin SDK not loaded properly');
        setLoading(false);
      }
    } catch (err) {
      console.error('Lumin initialization error:', err);
      if ((err as Error).message && (err as Error).message.includes('shadow')) {
        setError('Shadow DOM conflict. Please refresh the page to try again.');
      } else {
        setError('Failed to initialize games: ' + (err as Error).message);
      }
      setLoading(false);
    }
  };

  const searchTerms = (raw: string) => {
    const q = String(raw || '').trim();
    if (!q) return [];
    const last = q.includes('/') ? q.split('/').filter(Boolean).pop() || q : q;
    const spaced = q.replace(/[/_-]+/g, ' ').trim();
    return Array.from(new Set([q, last, spaced, last.replace(/[-_]+/g, ' ')].filter(Boolean)));
  };

  const searchLumin = async (raw: string) => {
    if (!window.Lumin) return null;
    let last: any = null;
    for (const term of searchTerms(raw)) {
      const result = await window.Lumin.search(term);
      last = result;
      if (result && Array.isArray(result.games) && result.games.length > 0) return result;
    }
    return last;
  };

  const playRecentGame = async (g: RecentGame) => {
    if (!window.Lumin) {
      setError('Games are still loading. Please wait...');
      return;
    }
    const L = window.Lumin as any;
    for (const k of ['playGame', 'openGame', 'launch', 'launchGame', 'startGame', 'play']) {
      try {
        if (typeof L[k] === 'function') {
          await L[k](g.id || g.title);
          return;
        }
      } catch {}
    }
    const queries = Array.from(new Set([g.title, g.id.replace(/[/_-]+/g, ' ').trim(), g.id.split('/').filter(Boolean).pop() || '', g.id]));
    setSearchQuery(g.title);
    setLoading(true);
    setError('');
    try {
      let found: any = null;
      for (const q of queries) {
        if (!q) continue;
        const result = await searchLumin(q);
        if (result && result.games && result.games.length > 0) {
          const exact = result.games.find((x: any) => String(x.title || x.name || '').toLowerCase() === g.title.toLowerCase());
          syncRecentIcons(result.games);
          setRecentGames(getRecentGames());
          found = exact || result.games[0];
          if (exact) break;
        }
      }
      if (!found) {
        markRecentUnavailable(g.id);
        setRecentGames(getRecentGames());
        setError('"' + g.title + '" is unavailable right now.');
      }
    } catch {
      setError('Could not reopen that game. Try searching for it.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.Lumin) {
      setError('Lumin SDK not loaded yet. Please wait...');
      return;
    }
    
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    const sanitizedQuery = DOMPurify.sanitize(searchQuery.trim());
    setLoading(true);
    setError('');
    try {
      const result = await searchLumin(sanitizedQuery);
      if (result && result.games && result.games.length > 0) {
        syncRecentIcons(result.games);
        setRecentGames(getRecentGames());
      } else {
        setError('No games found for "' + sanitizedQuery + '"');
      }
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = async (genre: string) => {
    if (!window.Lumin || !luminInitialized) {
      setError('Games are still loading. Please wait...');
      return;
    }

    const sanitizedGenre = DOMPurify.sanitize(genre);
    
    setSelectedGenre(sanitizedGenre);
    setIsGenreDropdownOpen(false);
    setLoading(true);
    setError('');

    try {
      console.log('Filtering by genre:', sanitizedGenre);
      const result = await window.Lumin.search(sanitizedGenre);
      console.log('Genre filter results:', result);
      if (result && result.games) {
        syncRecentIcons(result.games); setRecentGames(getRecentGames());
        console.log(`Found ${result.games.length} games for genre: ${sanitizedGenre}`);
        if (result.games.length === 0) {
          setError('No games found for "' + sanitizedGenre + '"');
        }
      } else {
        console.log('No games found or unexpected result format');
        setError('No games found for "' + sanitizedGenre + '"');
      }
    } catch (err) {
      console.error('Genre filter error:', err);
      setError('Genre filter failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyCustomStyles = (id: string) => {
    const style = document.createElement('style');
    style.textContent = `
      #${id} .lumin-game-card {
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        transition: all 0.3s ease !important;
      }
      
      #${id} .lumin-game-card:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        border-color: rgba(139, 92, 246, 0.5) !important;
        transform: scale(1.05) !important;
      }
      
      #${id} .lumin-game-title {
        color: white !important;
      }
      
      #${id} .lumin-game-category {
        color: rgba(255, 255, 255, 0.6) !important;
      }
      
      #${id} .lumin-search,
      #${id} .lumin-categories,
      #${id} .lumin-pagination {
        background: rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 8px !important;
      }
      
      #${id} .lumin-search input,
      #${id} .lumin-search button {
        background: rgba(255, 255, 255, 0.05) !important;
        color: white !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      
      #${id} .lumin-btn {
        background: rgba(139, 92, 246, 0.2) !important;
        color: white !important;
        border: 1px solid rgba(139, 92, 246, 0.3) !important;
      }
      
      #${id} .lumin-btn:hover {
        background: rgba(139, 92, 246, 0.4) !important;
      }
      
      #${id} .lumin-no-results {
        color: rgba(255, 255, 255, 0.6) !important;
        text-align: center !important;
        padding: 20px !important;
      }
    `;
    document.head.appendChild(style);
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettingsModal(true)} />
      <div className="fixed top-4 right-4 z-30">
        <BatteryIndicator />
      </div>

      <main className="relative z-10 flex flex-col min-h-screen px-4 py-8 sm:pl-20">
        {notice && (
          <div
            className="fixed top-6 left-1/2 z-[60] px-6 py-3.5 rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-100 text-sm font-medium shadow-2xl backdrop-blur-md animate-fade-down"
            style={{ transform: 'translateX(-50%)' }}
          >
            {notice}
          </div>
        )}
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSuggestionsModal(true)}>Suggestions</NavBtn>
            <NavBtn onClick={() => setShowSettingsModal(true)}>Settings</NavBtn>
          </div>
        </TopBar>

        <div className="flex-1 flex flex-col items-center max-w-5xl mx-auto w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--bp-accent)' }}>
              Games
            </h1>
            <p className="text-white/40 text-sm mt-2">Thousands of games, playable instantly</p>
          </div>

          <div className="relative z-30 w-full max-w-3xl bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-2xl mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for games"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/40 transition-all text-sm"
                  />
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (window.Lumin) {
                        window.Lumin.search('');
                      }
                    }}
                    className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-all text-sm"
                  >
                    Clear
                  </button>
                )}
              </form>

              <div className="flex gap-2">
                <div className="relative">
                  <button
                    onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                    className="h-full px-4 py-3 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all flex items-center gap-2"
                  >
                    <span>{selectedGenre || 'Select genre'}</span>
                    <svg className={`w-4 h-4 transition-transform duration-300 ${isGenreDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isGenreDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-[#12121a] border border-white/15 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto min-w-[160px]">
                      {(() => {
                        const cats = availableCategories.length > 0 ? availableCategories : FALLBACK_GENRES;
                        return cats.map((category: string) => (
                          <button
                            key={category}
                            onClick={() => handleGenreSelect(category)}
                            className={`w-full px-4 py-2.5 text-left text-sm transition-all first:rounded-t-xl last:rounded-b-xl ${
                              selectedGenre === category
                                ? 'bg-purple-600/30 text-white'
                                : 'text-gray-300 hover:bg-purple-600/20 hover:text-white'
                            }`}
                          >
                            {category}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {selectedGenre && (
                  <button
                    onClick={() => {
                      setSelectedGenre('');
                      setIsGenreDropdownOpen(false);
                      if (window.Lumin) {
                        window.Lumin.search('');
                      }
                    }}
                    className="px-4 py-3 rounded-xl text-sm font-medium bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="text-red-400 mt-3 text-sm text-center">
                {error}
                <button
                  onClick={() => window.location.reload()}
                  className="ml-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all text-xs"
                >
                  Retry
                </button>
              </div>
            )}

            {loading && (
              <div className="text-gray-400 text-sm text-center mt-3">
                Loading games...
              </div>
            )}
          </div>

          <div
            key={CONTAINER_ID}
            id={CONTAINER_ID}
            ref={gamesContainerRef}
            className="relative z-0 w-full flex-1 min-h-[420px] bg-black/30 border border-white/10 rounded-2xl p-6 backdrop-blur-md"
          />
          <div className="w-full max-w-3xl bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl mt-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-sm font-semibold text-white/90">your recent game played:</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setSort('last')} className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${recentSort === 'last' ? 'bg-purple-600/30 text-white border-purple-500/40' : 'bg-white/5 text-white/50 border-white/10'}`}>Last played</button>
                <button onClick={() => setSort('most')} className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${recentSort === 'most' ? 'bg-purple-600/30 text-white border-purple-500/40' : 'bg-white/5 text-white/50 border-white/10'}`}>Most played</button>
                {recentGames.length > 0 && <button onClick={() => { clearRecents(); setRecentGames([]); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-red-600/20 hover:text-red-300 transition-all">Clear recents</button>}
              </div>
            </div>
            <p className="text-xs text-white/35 mb-4">click a tile to replay it instantly.</p>
            {recentGames.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Play a game for a bit and it will show up here.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {sortedRecents.map((g) => (
                  <div key={g.id} className="relative group flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all text-center">
                    <button onClick={() => removeRecent(g.id)} title="Remove" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 border border-white/15 text-white/50 hover:text-red-300 hover:border-red-500/50 text-[11px] leading-none opacity-0 group-hover:opacity-100 transition-all">×</button>
                    <button onClick={() => playRecentGame(g)} className="flex flex-col items-center gap-1.5 w-full">
                      {g.icon && !g.unavailable ? (
                        <img src={g.icon} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} className="w-16 h-16 rounded-xl object-cover border border-white/10" loading="lazy" />
                      ) : (
                        <span className="w-16 h-16 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 text-xl font-bold">{(g.title || '?').charAt(0).toUpperCase()}</span>
                      )}
                      <span className="text-sm text-gray-200 group-hover:text-white font-medium break-words w-full truncate">{g.title}</span>
                      <span className="text-[11px] text-purple-300/80">{g.plays} play{g.plays === 1 ? '' : 's'} · {Math.round((g.secs || 0) / 60)}m</span>
                      <span className="text-[10px] text-white/35">{g.unavailable ? 'unavailable' : fmtAgo(g.ts)}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 mb-8 max-w-5xl mx-auto w-full flex flex-col items-center">
          <div className="w-full max-w-3xl bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 drop-shadow-lg">
                  My Games
                </h2>
                <p className="text-gray-500 text-xs mt-1">(some are unofficial btw)</p>
              </div>
              <div className="relative w-full sm:w-64">
                <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={myGamesSearch}
                  onChange={(e) => setMyGamesSearch(e.target.value)}
                  placeholder="Search my games..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/40 transition-all text-sm"
                />
              </div>
            </div>

            {myGames.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-10">
                No games added yet. Add games to the public/my-games folder.
              </div>
            ) : myGames.filter(game => game.name.toLowerCase().includes(myGamesSearch.toLowerCase())).length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-10">
                No games found matching "{myGamesSearch}"
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {myGames
                  .filter(game => game.name.toLowerCase().includes(myGamesSearch.toLowerCase()))
                  .map((game) => (
                    <a
                      key={game.filename}
                      href={game.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer text-center hover:scale-105 shadow-lg"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:text-white group-hover:bg-purple-600/40 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-200 group-hover:text-white font-medium break-words w-full">{game.name}</span>
                    </a>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showSuggestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full mx-4 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <p className="text-gray-300 mb-4 text-center text-sm">
              Submit your suggestions for either: website improvements, what games to add, what features to add onto the website.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!suggestionText.trim()) return;
              try {
                const response = await fetch('/api/suggestions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: suggestionTitle, content: suggestionText, userIdentifier, genre: suggestionGenre }),
                });
                if (response.ok) {
                  setShowSuggestionsModal(false);
                  setSuggestionText('');
                  setSuggestionTitle('');
                  setNotice('thank you for your feedback!'); setTimeout(() => setNotice(''), 3500);
                } else {
                  setNotice('Failed to submit suggestion'); setTimeout(() => setNotice(''), 3500);
                }
              } catch {
                setNotice('Network error. Is the backend running?'); setTimeout(() => setNotice(''), 3500);
              }
            }}>
              <select
                value={suggestionGenre}
                onChange={(e) => setSuggestionGenre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md mb-4 cursor-pointer"
              >
                <option value="Feedback suggestions">Feedback suggestions</option>
                <option value="Website bug">Website bug</option>
              </select>
              <input
                value={suggestionTitle}
                onChange={(e) => setSuggestionTitle(e.target.value)}
                placeholder="Enter suggestion title:"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md mb-3 text-sm"
              />
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder="Enter your suggestion..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md mb-4 min-h-[120px] resize-none"
              />
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestionsModal(false);
                    setSuggestionText('');
                    setSuggestionTitle('');
                  }}
                  className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium"
                >
                  Submit your suggestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGamesNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10] border border-white/15 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <p className="text-xs tracking-[0.3em] uppercase text-white/40 mb-3">[attention]</p>
            <p className="text-sm text-white/90 leading-relaxed mb-6">few of you might be waiting on five nights at detention game, my game thats being worked on. That game is still being worked on currently, so please understand that it will take awhile for that game to finish.</p>
            <button onClick={() => { localStorage.setItem('batprox-games-seen','1'); setShowGamesNotice(false); }} className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">Okay i understand.</button>
          </div>
        </div>
      )}
      <Settings 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  );
}
