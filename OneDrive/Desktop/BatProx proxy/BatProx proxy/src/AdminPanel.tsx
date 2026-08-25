import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'feedbacks';

  const handleApprove = async (suggestionId: number) => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/approve-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ suggestionId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Suggestion approved:', data);
        loadFeedbacks(token);
      } else {
        const error = await response.json();
        console.error('Approval error:', error);
        setError('Failed to approve suggestion: ' + error.error);
      }
    } catch (error) {
      console.error('Network error:', error);
      setError('Network error while approving suggestion');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setIsLoggedIn(true);
        loadFeedbacks(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async (authToken: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/feedbacks', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setFeedbacks(data.feedbacks || []);
      } else {
        console.error('Failed to load feedbacks:', data.error);
      }
    } catch (error) {
      console.error('Network error loading feedbacks:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn && token && currentTab === 'feedbacks') {
      loadFeedbacks(token);
    }
  }, [isLoggedIn, token, currentTab]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  if (!isLoggedIn) {
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

        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 backdrop-blur-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-8 text-center">Admin Panel</h1>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm">Enter admin username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-300 mb-2 text-sm">Enter admin password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md"
                />
              </div>
              {error && (
                <div className="mb-4 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
            <button
              onClick={() => navigate('/')}
              className="w-full mt-4 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="relative z-10 flex min-h-screen">
        <div className="w-64 bg-black/40 border-r border-white/10 backdrop-blur-md p-4">
          <h2 className="text-xl font-bold text-white mb-6">Admin Panel</h2>
          <button
            onClick={() => navigate('/admin-panel?tab=feedbacks')}
            className={`w-full px-4 py-3 rounded-xl text-left transition-all text-sm font-medium mb-2 ${
              currentTab === 'feedbacks' 
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
          >
            Users Feedback Suggestions
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 transition-all text-sm font-medium mt-4"
          >
            Logout
          </button>
        </div>

        <div className="flex-1 p-8">
          {currentTab === 'feedbacks' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Users Feedback Suggestions</h2>
              <div className="bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-md">
                {feedbacks.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    <p className="mb-4">No feedback suggestions yet.</p>
                    <p className="text-sm">Suggestions submitted by users will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((feedback) => (
                      <div key={feedback.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-400">
                            {new Date(feedback.submitted_at).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              feedback.status === 'pending' ? 'bg-yellow-600/20 text-yellow-300' :
                              feedback.status === 'reviewed' ? 'bg-blue-600/20 text-blue-300' :
                              'bg-green-600/20 text-green-300'
                            }`}>
                              {feedback.status}
                            </span>
                            {feedback.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(feedback.id)}
                                className="text-xs px-3 py-1 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30 transition-all"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-200">{feedback.content}</p>
                        {feedback.user_identifier && (
                          <p className="text-xs text-gray-500 mt-2">
                            User: {feedback.user_identifier}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
