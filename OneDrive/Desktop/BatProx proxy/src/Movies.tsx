import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Settings from './Settings';
import { AmbientBg, SideRail, TopBar, NavBtn, BatteryIndicator } from './Chrome';
import { startPresence } from './presence';
import { useLowPower } from './power';

export default function Movies() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [movies] = useState<Array<{ title: string }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [me] = useState(() => { try { return localStorage.getItem('batprox-user') || ''; } catch { return ''; } });
  useLowPower();

  useEffect(() => { startPresence(); }, []);

  const filtered = movies.filter(m => m.title.toLowerCase().includes(query.trim().toLowerCase()));

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    try {
      const r = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: suggestionTitle, content: suggestionText, userIdentifier: me || 'anonymous', genre: 'Feedback suggestions' }) });
      if (r.ok) { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); }
    } catch {}
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettings(true)} />
      <main className="relative z-10 flex flex-col min-h-screen px-4 sm:pl-20 sm:pr-6 py-4">
        <TopBar>
          <NavBtn onClick={() => navigate('/dashboard')}>Home</NavBtn>
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setShowSuggest(true)}>Suggestions</NavBtn>
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
            <BatteryIndicator />
          </div>
        </TopBar>
        <div className="flex-1 flex flex-col items-center w-full max-w-3xl mx-auto pt-8">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--bp-accent)' }}>Movies</h1>
          <p className="text-white/40 text-sm mt-2 mb-6">Search the collection</p>
          <div className="relative w-full max-w-xl mb-8">
            <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for movies" className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm" />
          </div>
          {filtered.length === 0 ? (
            <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-md">
              <p className="text-gray-400 text-sm">No movies yet.</p>
              <p className="text-gray-600 text-xs mt-1">New movies are being added soon. Suggest one below.</p>
              <button onClick={() => setShowSuggest(true)} className="mt-5 px-5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-sm">Suggest a movie</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
              {filtered.map(m => (
                <div key={m.title} className="px-4 py-6 rounded-xl bg-white/5 border border-white/10 text-center text-sm text-white">{m.title}</div>
              ))}
            </div>
          )}
        </div>
      </main>
      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <form onSubmit={submitSuggestion}>
              <input value={suggestionTitle} onChange={e => setSuggestionTitle(e.target.value)} placeholder="Enter suggestion title:" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-sm mb-3" />
              <textarea value={suggestionText} onChange={e => setSuggestionText(e.target.value)} placeholder="Enter your suggestion..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4 min-h-[120px] resize-none" />
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => { setShowSuggest(false); setSuggestionText(''); setSuggestionTitle(''); }} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-sm">Submit your suggestion</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
