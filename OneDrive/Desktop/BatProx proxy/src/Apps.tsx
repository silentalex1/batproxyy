import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';
import Settings from './Settings';
import { startPresence } from './presence';
import { useLowPower } from './power';
import { launchAboutBlankCloak, isAboutBlankTabEnabled } from './cloak';

interface AppItem {
  id: string;
  label: string;
  desc: string;
  route: string;
  tint: string;
  icon: React.ReactNode;
}

export default function Apps() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  useLowPower();

  useEffect(() => {
    const token = localStorage.getItem('batprox-token');
    if (!token) { navigate('/'); return; }
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => {
      if (!d.user) { localStorage.removeItem('batprox-token'); localStorage.removeItem('batprox-user'); navigate('/'); }
      else if (isAboutBlankTabEnabled()) launchAboutBlankCloak();
    }).catch(() => navigate('/'));
    startPresence();
  }, [navigate]);

  const apps: AppItem[] = [
    {
      id: 'scripts',
      label: 'My Scripts',
      desc: 'js bookmarklets',
      route: '/my-scripts',
      tint: 'bg-[#0ea5e9]',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 16l-2-2 2-2M14 16l2-2-2-2M14 10l-2 2m0 0l-2-2m2 2v6m-7 4h14a2 2 0 002-2V8a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'youtube',
      label: 'Youtube',
      desc: 'video proxy',
      route: '/search-engine?url=' + encodeURIComponent('https://youtube.com'),
      tint: 'bg-[#ff0000]',
      icon: <img src="/assets/youtube.png" alt="Youtube" className="w-7 h-7 object-contain" />
    },
    {
      id: 'discord',
      label: 'Discord',
      desc: 'chat proxy',
      route: '/search-engine?url=' + encodeURIComponent('https://discord.com'),
      tint: 'bg-[#5865F2]',
      icon: <img src="/assets/discord.png" alt="Discord" className="w-7 h-7 object-contain" />
    },
    {
      id: 'roblox',
      label: 'Roblox',
      desc: 'game proxy',
      route: '/search-engine?url=' + encodeURIComponent('https://roblox.com'),
      tint: 'bg-[#1a1a1a]',
      icon: <img src="/assets/robloxcom.png" alt="Roblox" className="w-7 h-7 object-contain" />
    },
    {
      id: 'spotify',
      label: 'Spotify',
      desc: 'music proxy',
      route: '/search-engine?url=' + encodeURIComponent('https://open.spotify.com'),
      tint: 'bg-[#1DB954]',
      icon: <img src="/assets/spotify.png" alt="Spotify" className="w-7 h-7 object-contain" />
    },
    {
      id: 'movies',
      label: 'Movies',
      desc: 'watch films',
      route: '/movies',
      tint: 'bg-[#ef4444]',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path strokeLinecap="round" d="M7 5v14M17 5v14M3 9h18M3 15h18" />
        </svg>
      )
    },
    {
      id: 'games',
      label: 'Games',
      desc: 'play instantly',
      route: '/homework',
      tint: 'bg-[#10b981]',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4M8 10v4m7-1h.01M17.5 11h.01M7 7h10a4 4 0 014 4v2a4.5 4.5 0 01-7.5 3.3L12 15l-1.5 1.3A4.5 4.5 0 013 13v-2a4 4 0 014-4z" />
        </svg>
      )
    },
    {
      id: 'ai',
      label: 'AI',
      desc: 'assistant',
      route: '/ai-work',
      tint: 'bg-[#8b5cf6]',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      )
    }
  ];

  const filtered = apps.filter(a => !query.trim() || a.label.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col min-h-screen px-4 sm:pl-20 sm:pr-6 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--bp-accent)' }}>Apps</h1>
          <p className="text-white/40 text-sm mt-2 mb-6">Search and launch your tools</p>
          <div className="w-full max-w-xl relative mb-8">
            <svg className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for apps" className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder-white/35 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm" />
          </div>
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map(app => (
              <button key={app.id} onClick={() => navigate(app.route)} className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/15 backdrop-blur-md transition-all hover:scale-[1.02] hover:-translate-y-0.5 text-center">
                <span className={`w-14 h-14 rounded-2xl ${app.tint} flex items-center justify-center shadow-lg shadow-black/30 overflow-hidden`}>{app.icon}</span>
                <span className="text-sm font-semibold text-white group-hover:text-white">{app.label}</span>
                <span className="text-[11px] text-white/40">{app.desc}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && <p className="text-white/30 text-sm mt-8">No apps found for “{query}”</p>}
        </div>
      </main>
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
