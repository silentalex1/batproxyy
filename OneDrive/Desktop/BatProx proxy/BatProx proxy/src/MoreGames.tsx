import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';

declare global {
  interface Window {
    Lumin: any;
  }
}

export default function MoreGames() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [myGamesSearch, setMyGamesSearch] = useState('');
  const [myGames, setMyGames] = useState<Array<{ name: string; filename: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [containerId] = useState(() => `games-container-${Date.now()}`);
  const [luminInitialized, setLuminInitialized] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const gamesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadMyGames();
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
        setAvailableCategories(categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadMyGames = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/my-games`, {
        signal: controller.signal
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response from my-games API:', contentType);
        setMyGames([]);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setMyGames(data.games || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Failed to load my games:', error);
      setMyGames([]);
    } finally {
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    const loadScript = () => {
      setLoading(true);
      
      const cleanupContainer = () => {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
          if (container.shadowRoot) {
            container.innerHTML = '';
          }
        }
      };

      cleanupContainer();

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      // Note: For production, use a specific version and add SRI hash
      // script.integrity = 'sha384-...';
      script.onload = () => {
        console.log('Lumin SDK loaded successfully');
        setTimeout(() => initializeLumin(), 200);
      };
      script.onerror = () => {
        console.error('Failed to load Lumin SDK');
        setError('Failed to load Lumin SDK. Please check your internet connection.');
        setLoading(false);
      };
      document.body.appendChild(script);
    };

    const timer = setTimeout(loadScript, 100);

    const handleGameErrors = (event: ErrorEvent) => {
      if (event.filename && (event.filename.includes('lumin') || event.filename.includes('scramjet') || event.filename.includes('fn'))) {
        console.warn('Game library warning:', event.message);
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && event.reason.message.includes('BareMux')) {
        console.warn('Game library dependency warning:', event.reason.message);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleGameErrors);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('error', handleGameErrors);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      const scripts = document.querySelectorAll('script[src*="luminsdk"]');
      scripts.forEach(script => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      });
      
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId]);

  const initializeLumin = () => {
    try {
      // Prevent multiple initializations
      if (luminInitialized) {
        console.log('LuminSDK already initialized');
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        console.error('Container not found:', containerId);
        setError('Games container not found. Retrying...');
        setTimeout(() => initializeLumin(), 500);
        return;
      }

      // Check if container already has shadow root
      if (container.shadowRoot) {
        console.log('Container already has shadow root, skipping initialization');
        setLoading(false);
        return;
      }

      if (window.Lumin) {
        window.Lumin.init({
          container: `#${containerId}`,
          theme: 'dark',
          columns: 4,
          rows: 3,
          gamesPerPage: 12,
          showSearch: false,
          showCategories: true,
          showRandom: true,
          onReady: () => {
            console.log('LuminSDK is ready');
            setLuminInitialized(true);
            setLoading(false);
            applyCustomStyles(containerId);
          },
          onError: (err: any) => {
            console.error('LuminSDK error:', err);
            if (err.message && err.message.includes('shadow')) {
              setError('SDK initialization conflict. Please refresh the page.');
            } else if (err.message && err.message.includes('Container not found')) {
              setError('Container initialization failed. Retrying...');
              setTimeout(() => initializeLumin(), 1000);
            } else {
              setError('LuminSDK error: ' + (err.message || 'Unknown error'));
            }
            setLoading(false);
            // Don't crash, just show error state
          },
          onGameStart: (game: any) => {
            console.log('Game started:', game);
          },
          onGameEnd: () => {
            console.log('Game ended');
          },
          onGameError: (err: any) => {
            console.error('Game error:', err);
            setError('Game failed to load: ' + (err.message || 'Unknown error'));
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

    // Sanitize input to prevent XSS attacks
    const sanitizedQuery = DOMPurify.sanitize(searchQuery.trim());
    
    setLoading(true);
    setError('');
    try {
      console.log('Searching for:', sanitizedQuery);
      const result = await window.Lumin.search(sanitizedQuery);
      console.log('Search results:', result);
      
      if (result && result.games) {
        console.log(`Found ${result.games.length} games`);
        if (result.games.length === 0) {
          setError('No games found for "' + sanitizedQuery + '"');
        }
      } else {
        console.log('No games found or unexpected result format');
        setError('No games found for "' + sanitizedQuery + '"');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      // Don't crash the app, just show error
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = async (genre: string) => {
    if (!window.Lumin || !luminInitialized) {
      setError('Games are still loading. Please wait...');
      return;
    }

    // Sanitize genre input
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

      <div className="relative z-10 flex flex-col min-h-screen px-4 py-8">
        <div className="w-full flex justify-center py-4">
          <div className="flex gap-3 px-10 py-3 rounded-2xl bg-black/60 border border-white/20 backdrop-blur-2xl shadow-2xl w-full max-w-6xl mx-4 justify-end">
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              Home
            </button>
            <button 
              onClick={() => navigate('/search-engine?url=https://youtube.com')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              YouTube
            </button>
            <button 
              onClick={() => navigate('/search-engine?url=https://music.octavestreaming.com/')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              Music
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center max-w-4xl mx-auto w-full">
          <h1 className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-8 drop-shadow-lg">
            More Games
          </h1>

          <form onSubmit={handleSearch} className="w-full max-w-2xl mb-6 flex gap-2">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search for games" 
              className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md text-center shadow-2xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (window.Lumin) {
                    window.Lumin.search('');
                  }
                }}
                className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all backdrop-blur-md shadow-2xl"
              >
                Clear
              </button>
            )}
          </form>

          {error && (
            <div className="text-red-400 mb-4 text-center">
              {error}
              <button 
                onClick={() => window.location.reload()}
                className="ml-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="text-gray-400 text-center">
              Loading games...
            </div>
          )}

          {/* Genre Filters inside game container */}
          <div className="w-full mb-4 flex flex-wrap gap-2 justify-center items-center">
            {/* Genre Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all flex items-center gap-2"
              >
                <span>{selectedGenre || 'Select genre'}</span>
                <svg className={`w-4 h-4 transition-transform duration-300 ${isGenreDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isGenreDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-black/90 border border-white/20 rounded-xl backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out z-50 max-h-64 overflow-y-auto min-w-[150px]">
                  {availableCategories.length > 0 ? (
                    availableCategories.map((category: string) => (
                      <button
                        key={category}
                        onClick={() => handleGenreSelect(category)}
                        className="w-full px-4 py-2 text-left text-gray-200 hover:bg-purple-600/30 hover:text-white transition-all first:rounded-t-xl last:rounded-b-xl text-sm"
                      >
                        {category}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">
                      Loading categories...
                    </div>
                  )}
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
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600/30 text-red-300 border border-red-500/30 hover:bg-red-600/50 transition-all"
              >
                Clear
              </button>
            )}
          </div>

          <div 
            key={containerId}
            id={containerId} 
            ref={gamesContainerRef} 
            className="w-full flex-1 bg-black/30 border border-white/10 rounded-2xl p-6 backdrop-blur-md"
          />
        </div>

        {/* My Games Section */}
        <div className="mt-16 mb-8 max-w-4xl mx-auto w-full flex flex-col items-center">
          <h2 className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 drop-shadow-lg text-center">
            My Games
          </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">
            (some are unofficial btw)
          </p>
          
          <form onSubmit={(e) => { e.preventDefault(); }} className="w-full max-w-2xl mb-6">
            <input 
              type="text" 
              value={myGamesSearch}
              onChange={(e) => setMyGamesSearch(e.target.value)}
              placeholder="Search my games..." 
              className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md text-center shadow-2xl"
            />
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {myGames
              .filter(game => game.name.toLowerCase().includes(myGamesSearch.toLowerCase()))
              .map((game) => (
                <a
                  key={game.filename}
                  href={game.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer font-medium backdrop-blur-sm text-sm text-gray-200 hover:text-white hover:scale-105 shadow-lg text-center"
                >
                  {game.name}
                </a>
              ))}
          </div>

          {myGames.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No games added yet. Add games to the public/my-games folder.
            </div>
          )}

          {myGames.length > 0 && myGames.filter(game => game.name.toLowerCase().includes(myGamesSearch.toLowerCase())).length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No games found matching "{myGamesSearch}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
