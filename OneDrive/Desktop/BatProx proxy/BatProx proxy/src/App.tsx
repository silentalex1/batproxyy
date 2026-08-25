import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SearchEngine from './SearchEngine';
import AdminPanel from './AdminPanel';
import MoreGames from './MoreGames';
import AIWork from './AIWork';
import Settings from './Settings';

function Home() {
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [userIdentifier] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    document.title = "Bat Prox";

    const updateTimer = () => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString();
      const currentDate = now.toLocaleDateString();
      setTimeStr(`${currentTime} - ${currentDate}`);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    let notificationTimeout: number | null = null;
    const checkNotifications = async () => {
      // Debounce the notification check
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      
      notificationTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/suggestions/${userIdentifier}`);
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
              console.log(`Rate limited. Retry after ${retryAfter} seconds`);
              return;
            }
          }
          
          // Check if response is JSON before parsing
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.log('Non-JSON response from notifications API:', contentType);
            return;
          }
          
          const data = await response.json();
          
          if (data.notifications && data.notifications.length > 0) {
            setNotification({
              show: true,
              message: `Your suggestion has been approved and will get added soon.`
            });
            
            setTimeout(() => {
              setNotification({ show: false, message: '' });
            }, 3000);
          }
        } catch (error) {
          console.error('Error checking notifications:', error);
        }
      }, 300); // 300ms debounce
    };

    const notificationInterval = setInterval(checkNotifications, 10000); // Increased to 10 seconds

    return () => {
      clearInterval(intervalId);
      clearInterval(notificationInterval);
    };
  }, [userIdentifier]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      navigate(`/search-engine?url=${encodeURIComponent(formattedUrl)}`);
    }
  };

  const handleButtonClick = (label: string) => {
    let targetUrl = '';
    switch (label) {
      case 'Youtube':
        targetUrl = 'https://youtube.com';
        break;
      case 'Music':
        targetUrl = 'https://music.octavestreaming.com/';
        break;
      case 'Movies':
        targetUrl = 'https://goated.cx/';
        break;
      case 'AI':
        navigate('/ai-work');
        return;
      default:
        return;
    }
    navigate(`/search-engine?url=${encodeURIComponent(targetUrl)}`);
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

  const proxyLinks = [
    { label: "AI", image: null },
    { label: "Youtube", image: "/assets/youtubelogo.png" },
    { label: "Movies", image: "/assets/movielogo.png" },
    { label: "Music", image: "/assets/musiclogo.png", isMusic: true }
  ];

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

      <div className="relative z-10 flex flex-col items-center min-h-screen px-4">
        <div className="w-full flex justify-center py-4">
          <div className="flex gap-3 px-10 py-3 rounded-2xl bg-black/60 border border-white/20 backdrop-blur-2xl shadow-2xl w-full max-w-6xl mx-4 justify-end">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              Settings
            </button>
            <button 
              onClick={() => setShowSuggestionsModal(true)}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              Suggestions
            </button>
            <button 
              onClick={() => navigate('/more-games')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              More Games
            </button>
          </div>
        </div>

        <div className="w-full flex justify-center py-4">
          <a 
            href="https://discord.gg/yourlink" 
            className="px-6 py-2 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 hover:text-white transition-all backdrop-blur-sm font-medium"
          >
            Join Our Discord
          </a>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl pb-20">
          {notification.show && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-300 backdrop-blur-md shadow-xl animate-fade-in">
              {notification.message}
            </div>
          )}

          <h1 className="text-5xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-6 drop-shadow-lg">
            Bat Prox
          </h1>

          <div className="text-gray-300 mb-8 font-mono text-lg bg-black/40 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-md shadow-xl">
            {timeStr}
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-2xl relative mb-12">
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onClick={() => setIsExpanded(true)}
              onBlur={() => setIsExpanded(false)}
              placeholder="Enter any web address domain." 
              className={`w-full px-6 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md text-center shadow-2xl ${
                isExpanded ? 'py-5 text-lg' : 'py-3 text-base'
              }`}
            />
          </form>

          <div className="flex flex-wrap justify-center gap-3 w-full">
            {proxyLinks.map((item) => (
              <button 
                key={item.label}
                onClick={() => handleButtonClick(item.label)}
                className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 transition-all cursor-pointer font-medium backdrop-blur-sm text-sm text-gray-200 hover:text-white hover:scale-105 shadow-lg min-w-[80px]"
              >
                {item.isMusic && item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.label}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : item.isMusic ? (
                  <div className="w-12 h-12 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                ) : item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.label}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{item.label}</span>
              </button>
            ))}
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

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search-engine" element={<SearchEngine />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/more-games" element={<MoreGames />} />
        <Route path="/ai-work" element={<AIWork />} />
      </Routes>
    </Router>
  );
}
