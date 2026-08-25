import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Settings from './Settings';

export default function SearchEngine() {
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [userIdentifier] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const targetUrl = searchParams.get('url');
    if (targetUrl) {
      setUrl(targetUrl);
      setIsLoading(true);
      setHasError(false);
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        if (!newHistory.includes(targetUrl)) {
          return [...newHistory, targetUrl];
        }
        return newHistory;
      });
      setHistoryIndex(prev => {
        const newHistory = history.slice(0, prev + 1);
        if (!newHistory.includes(targetUrl)) {
          return newHistory.length;
        }
        return prev;
      });
    }
  }, [location]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      navigate(`/search-engine?url=${encodeURIComponent(formattedUrl)}`);
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(`/search-engine?url=${encodeURIComponent(history[newIndex])}`);
    } else {
      navigate('/');
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(`/search-engine?url=${encodeURIComponent(history[newIndex])}`);
    }
  };

  const handleHome = () => {
    navigate('/');
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        iframeRef.current.requestFullscreen();
      }
    }
  };

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    setIsLoading(true);
    setHasError(false);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    console.log('Iframe loaded successfully');
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    console.log('Iframe loading error - backend server may not be running');
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestionText.trim()) {
      try {
        const response = await fetch('http://localhost:3000/api/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: suggestionText, userIdentifier }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Suggestion submitted:', data);
          setShowSuggestionsModal(false);
          setSuggestionText('');
          alert('Suggestion submitted successfully!');
        } else {
          const error = await response.json();
          console.error('Submission error:', error);
          alert('Failed to submit suggestion: ' + (error.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Network error:', error);
        alert('Network error. Please make sure the backend server is running.');
      }
    }
  };

  const searchParams = new URLSearchParams(location.search);
  const targetUrl = searchParams.get('url');

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-repeat opacity-60"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`,
            backgroundSize: '350px 350px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-purple-600/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-400/20 rounded-full blur-[60px] pointer-events-none" />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        <div className="flex justify-center py-4">
          <div className="flex gap-2 px-8 py-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md shadow-xl">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium hover:scale-105"
            >
              Settings
            </button>
            <button 
              onClick={() => setShowSuggestionsModal(true)}
              className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium hover:scale-105"
            >
              Suggestions
            </button>
            <button 
              onClick={() => navigate('/more-games')}
              className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium hover:scale-105"
            >
              More Games
            </button>
          </div>
        </div>

        <div className="flex justify-center py-2 gap-4">
          <button 
            onClick={handleHome}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all backdrop-blur-sm text-sm"
          >
            🏠 Home
          </button>
          <button 
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all backdrop-blur-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button 
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all backdrop-blur-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Forward →
          </button>
          {targetUrl && (
            <>
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 transition-all backdrop-blur-sm text-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button 
                onClick={handleFullscreen}
                className="px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 transition-all backdrop-blur-sm text-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Fullscreen
              </button>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="w-full px-4 pt-4">
            <form onSubmit={handleSearch} className="max-w-4xl mx-auto">
              <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md shadow-xl px-4 py-2">
                <div className="text-gray-400 text-sm">
                  🔒
                </div>
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onClick={() => setIsExpanded(true)}
                  onBlur={() => setIsExpanded(false)}
                  placeholder="Enter web address..."
                  className={`flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none transition-all ${
                    isExpanded ? 'py-2 text-base' : 'py-1 text-sm'
                  }`}
                />
                <button 
                  type="submit"
                  className="px-4 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm"
                >
                  Go
                </button>
              </div>
            </form>
          </div>

          <div className="flex-1 px-4 pt-4 pb-4 min-h-0">
            {targetUrl && (
              <div className="w-full h-full bg-white/5 rounded-xl border border-white/10 backdrop-blur-md overflow-hidden relative">
                {isLoading && (
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
                      <p className="text-gray-400 text-xs">The backend server may not be running or the URL is blocked</p>
                      <button 
                        onClick={handleRefresh}
                        className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition-all text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
                <iframe 
                  key={iframeKey}
                  ref={iframeRef}
                  src={`http://localhost:3000/proxy?url=${encodeURIComponent(targetUrl)}`}
                  className="w-full h-full border-0"
                  title="Proxy Content"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation allow-downloads allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share; xr-spatial-tracking; usb; serial; magnetometer"
                  loading="eager"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showSuggestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full mx-4 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <p className="text-gray-300 mb-4 text-center text-sm">
              Submit your suggestions for either: website improvements, what games to add, what features to add onto the website.
            </p>
            <form onSubmit={handleSuggestionSubmit}>
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

      <Settings 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  );
}
