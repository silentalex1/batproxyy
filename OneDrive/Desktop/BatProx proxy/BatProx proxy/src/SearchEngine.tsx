import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Settings from './Settings';
import { initUltraviolet, getUvUrl, getSandboxUrl, decodeProxiedLocation } from './uv';
import { AmbientBg, BatteryIndicator, SideRail, NavBtn } from './Chrome';
import { buildSearchUrl, MOVIES_URL } from './engines';
import { startPresence } from './presence';
import { useLowPower } from './power';

export default function SearchEngine() {
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);
  const [src, setSrc] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [sites, setSites] = useState<Array<{ name: string; owner: string; updated_at: string }>>([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteHtml, setNewSiteHtml] = useState('');
  const [sitesNotice, setSitesNotice] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  useLowPower();
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const skipNext = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampRef = useRef(0);
  const skipLoading = (() => {
    try { return JSON.parse(localStorage.getItem('batprox-settings') || '{}').skipLoading === true; } catch { return false; }
  })();

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const openTarget = useCallback((target: string, forceSandbox = false) => {
    try {
      const u = new URL(target.includes('://') ? target : 'https://' + target);
      if (u.hostname.includes('stealthybat.org') || u.hostname.includes('stealthlybat.it.com')) { navigate('/dashboard'); return; }
    } catch {}
    if (target.includes('stealthybat.org') || target.includes('stealthlybat.it.com') || target.includes('banned.stealthybat.org')) { navigate('/dashboard'); return; }
    if (target.includes('triplethd') || target.includes('noordware')) forceSandbox = true;
    setUrl(target);
    setLoading(!skipLoading);
    setHasError(false);
    if (forceSandbox) {
      setUseSandbox(true);
      setSrc(getSandboxUrl(target));
      setKey(v => v + 1);
      return;
    }
    setUseSandbox(false);
    setSrc('');
    initUltraviolet().then(() => {
      if (!skipLoading) {
        const s = ++stampRef.current;
        clearTimer();
        timerRef.current = setTimeout(() => {
          if (stampRef.current === s) {
            setUseSandbox(true);
            setSrc(getSandboxUrl(target));
            setLoading(!skipLoading);
            setHasError(false);
            setKey(v => v + 1);
          }
        }, 1800);
      }
      setSrc(getUvUrl(target));
      setKey(v => v + 1);
    }).catch(() => {
      setUseSandbox(true);
      setSrc(getSandboxUrl(target));
      setKey(v => v + 1);
    });
  }, [clearTimer, skipLoading]);

  useEffect(() => { initUltraviolet().catch(() => {}); startPresence(); return () => clearTimer(); }, [clearTimer]);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('url');
    if (!t) return;
    if (skipNext.current) { skipNext.current = false; setUrl(t); return; }
    setHistory(prev => {
      const n = prev.slice(0, historyIndex + 1);
      if (!n.includes(t)) return [...n, t];
      return n;
    });
    setHistoryIndex(prev => {
      const n = history.slice(0, prev + 1);
      if (!n.includes(t)) return n.length;
      return prev;
    });
    openTarget(t);
  }, [location.search]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'batprox-nav' || !e.data.url) return;
      const next = e.data.url;
      if (next.includes('stealthybat.org') || next.includes('stealthlybat.it.com')) return;
      skipNext.current = true;
      setUrl(next);
      setHistory(prev => {
        const trim = prev.slice(0, historyIndex + 1);
        if (trim[trim.length - 1] === next) return trim;
        return [...trim, next];
      });
      setHistoryIndex(v => v + 1);
      navigate(`/search-engine?url=${encodeURIComponent(next)}`);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [historyIndex, navigate]);

  const INTERNAL: Record<string, string> = {
    home: '/dashboard', dashboard: '/dashboard', games: '/homework#help', homework: '/homework#help',
    ai: '/ai-work', changelog: '/changelog', changelogs: '/changelog', status: '/bat-status', 'api status': '/bat-status',
    movies: '/search-engine?url=' + encodeURIComponent(MOVIES_URL)
  };

  const resolveInternal = (q: string): string | null => {
    const v = q.trim().toLowerCase();
    if (INTERNAL[v]) return INTERNAL[v];
    if (/^(site|mysite):[\w.-]{1,40}$/i.test(q)) return `/site/${q.split(':')[1]}`;
    return null;
  };

  const loadSites = async () => {
    try {
      const r = await fetch('/api/sites');
      if (r.ok) setSites((await r.json()).sites || []);
    } catch { setSites([]); }
  };

  const saveSite = async () => {
    const name = newSiteName.trim();
    if (!name || !newSiteHtml.trim()) { setSitesNotice('Site name and HTML are required.'); return; }
    try {
      const r = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, html: newSiteHtml, owner: localStorage.getItem('batprox-user') || 'anonymous' }) });
      const d = await r.json();
      if (r.ok) {
        setSitesNotice(`Saved "${name}". Opening...`);
        setNewSiteName(''); setNewSiteHtml(''); setShowSites(false); loadSites();
        setTimeout(() => { setSitesNotice(''); navigate(`/search-engine?url=${encodeURIComponent(`/site/${d.name || name}`)}`); }, 600);
      } else setSitesNotice(d.error || 'Failed to save site.');
    } catch { setSitesNotice('Network error while saving site.'); }
  };

  const deleteSite = async (name: string) => {
    try { const r = await fetch(`/api/sites/${encodeURIComponent(name)}`, { method: 'DELETE' }); if (r.ok) setSites(p => p.filter(s => s.name !== name)); } catch {}
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const internal = resolveInternal(url);
    if (internal) {
      if (internal.startsWith('/site/')) navigate(`/search-engine?url=${encodeURIComponent(window.location.origin + internal)}`);
      else navigate(internal);
      return;
    }
    navigate(`/search-engine?url=${encodeURIComponent(buildSearchUrl(url))}`);
  };

  const handleBack = () => {
    if (historyIndex > 0) { const n = historyIndex - 1; setHistoryIndex(n); navigate(`/search-engine?url=${encodeURIComponent(history[n])}`); }
    else navigate('/dashboard');
  };
  const handleForward = () => {
    if (historyIndex < history.length - 1) { const n = historyIndex + 1; setHistoryIndex(n); navigate(`/search-engine?url=${encodeURIComponent(history[n])}`); }
  };
  const handleHome = () => navigate('/dashboard');
  const handleFullscreen = () => {
    const f = iframeRef.current;
    if (!f) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else f.requestFullscreen();
  };
  const handleRefresh = () => {
    const t = new URLSearchParams(location.search).get('url') || url;
    if (t) openTarget(t, useSandbox);
  };
  const handleLoad = () => {
    const f = iframeRef.current;
    try {
      const html = f?.contentDocument?.documentElement?.innerHTML || '';
      const title = f?.contentDocument?.title || '';
      if (html.includes('Error processing your request') || html.includes('Proxy failed to start') || html.includes('Failed to fetch') || title.includes('Error')) {
        if (!useSandbox) {
          clearTimer(); setUseSandbox(true); setSrc(getSandboxUrl(new URLSearchParams(location.search).get('url') || url)); setKey(v => v + 1); return;
        }
      }
    } catch {}
    clearTimer(); setLoading(false); setHasError(false);
    try {
      if (!useSandbox && f?.contentDocument) {
        f.contentDocument.addEventListener('click', (e) => {
          const a = (e.target as HTMLElement | null)?.closest('a');
          if (!a?.href) return;
          const d = decodeProxiedLocation(a.href);
          if (!d) return;
          e.preventDefault(); e.stopPropagation();
          navigate(`/search-engine?url=${encodeURIComponent(d)}`);
        }, true);
        f.contentDocument.addEventListener('submit', (e) => {
          const form = e.target as HTMLFormElement | null;
          if (!form?.action) return;
          const d = decodeProxiedLocation(form.action);
          if (!d) return;
          e.preventDefault(); e.stopPropagation();
          navigate(`/search-engine?url=${encodeURIComponent(d)}`);
        }, true);
      }
      const href = f?.contentWindow?.location.href;
      if (href) {
        if (href.includes('stealthybat.org') && !href.includes('/proxy?url=') && !href.includes('/__uv/') && !href.includes('/uv/')) { navigate('/dashboard'); return; }
        const d = decodeProxiedLocation(href);
        if (d) {
          if (d.includes('stealthybat.org') || d.includes('stealthlybat.it.com')) { navigate('/dashboard'); return; }
          setUrl(d);
        }
      }
    } catch {}
  };
  const handleError = () => {
    clearTimer();
    if (!useSandbox) { setUseSandbox(true); setSrc(getSandboxUrl(new URLSearchParams(location.search).get('url') || url)); setLoading(!skipLoading); setHasError(false); setKey(v => v + 1); return; }
    setLoading(false); setHasError(true);
  };
  const handleSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    try {
      const r = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: suggestionTitle, content: suggestionText, userIdentifier: 'user-' + Math.random().toString(36).slice(2, 9) }) });
      if (r.ok) { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); } else { const d = await r.json(); setSitesNotice(d.error || 'Failed'); }
    } catch { setSitesNotice('Network error'); }
  };

  const targetUrl = new URLSearchParams(location.search).get('url');

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col h-screen sm:pl-16">
        <div className="flex items-center gap-2 h-14 px-3 sm:px-4 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-1">
            <button onClick={handleBack} disabled={historyIndex <= 0} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30">←</button>
            <button onClick={handleForward} disabled={historyIndex >= history.length - 1} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30">→</button>
            <button onClick={handleRefresh} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10">↻</button>
            <button onClick={handleHome} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10">⌂</button>
          </div>
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative flex items-center gap-2 bg-[#14141a] rounded-full px-4 py-1.5">
              <svg className="w-4 h-4 text-white/35 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Search or type a URL" className="flex-1 bg-transparent text-white placeholder-white/35 focus:outline-none text-sm" />
            </div>
          </form>
          {targetUrl && <NavBtn className="hidden sm:inline-flex" onClick={handleFullscreen}>Fullscreen</NavBtn>}
          <NavBtn className="hidden md:inline-flex" onClick={() => setShowSettings(true)}>Settings</NavBtn>
          <BatteryIndicator />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 px-3 sm:px-4 pt-3 pb-3 min-h-0">
            {targetUrl && (
              <div className="w-full h-full bg-white/5 rounded-xl border border-white/10 backdrop-blur-md overflow-hidden relative">
                {loading && !skipLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-300 text-sm">Loading proxy...</p>
                    </div>
                  </div>
                )}
                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3 text-center px-4">
                      <div className="text-red-400 text-4xl">⚠️</div>
                      <p className="text-red-300 text-sm font-medium">Failed to load content</p>
                      <p className="text-gray-400 text-xs">Could not load this page through the proxy</p>
                      <button onClick={handleRefresh} className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-sm">Try Again</button>
                    </div>
                  </div>
                )}
                <iframe key={key} ref={iframeRef} src={src || 'about:blank'} className="w-full h-full border-0" title="Proxy" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation allow-downloads allow-storage-access-by-user-activation" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; pointer-lock; screen-wake-lock; web-share" loading="eager" onLoad={handleLoad} onError={handleError} />
              </div>
            )}
          </div>
        </div>
      </main>
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full mx-4 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <form onSubmit={handleSuggestion}>
              <input value={suggestionTitle} onChange={e => setSuggestionTitle(e.target.value)} placeholder="Enter suggestion title:" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-3 text-sm" />
              <textarea value={suggestionText} onChange={e => setSuggestionText(e.target.value)} placeholder="Enter your suggestion..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4 min-h-[120px] resize-none" />
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); }} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-sm">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showSites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10]/95 border border-white/10 rounded-3xl p-7 max-w-2xl w-full backdrop-blur-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="text-xl font-bold text-white">My Sites</h2><p className="text-xs text-gray-400 mt-1">Your own hosted pages.</p></div>
              <button onClick={() => setShowSites(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" /></svg></button>
            </div>
            {sitesNotice && <div className="mb-4 px-4 py-2.5 rounded-xl bg-purple-600/15 border border-purple-500/25 text-purple-200 text-sm">{sitesNotice}</div>}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
              <p className="text-sm font-medium text-white/90 mb-3">Create or update a site</p>
              <input type="text" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder="site name (e.g. my-page)" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3" />
              <textarea value={newSiteHtml} onChange={e => setNewSiteHtml(e.target.value)} placeholder="<h1>Hello world</h1>" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3 min-h-[110px] resize-none font-mono" />
              <button onClick={saveSite} className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold">Save & Open</button>
            </div>
            <div>
              <p className="text-sm font-medium text-white/90 mb-3">Saved sites</p>
              {sites.length === 0 ? <p className="text-gray-500 text-sm py-4 text-center">No sites yet.</p> : (
                <div className="space-y-2">{sites.map(s => (
                  <div key={s.name} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <div className="min-w-0"><p className="text-sm text-white font-medium truncate">{s.name}</p><p className="text-[11px] text-gray-500">by {s.owner} - {new Date(s.updated_at).toLocaleString()}</p></div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setShowSites(false); navigate(`/search-engine?url=${encodeURIComponent(`${window.location.origin}/site/${s.name}`)}`); }} className="px-4 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 text-xs">Open</button>
                      <button onClick={() => deleteSite(s.name)} className="px-4 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 text-xs">Delete</button>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      )}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
