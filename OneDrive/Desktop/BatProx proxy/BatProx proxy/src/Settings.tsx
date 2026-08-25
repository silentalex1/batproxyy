import React, { useState, useEffect } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsData {
  user: string;
  browserType: string;
  disableTypingAnimation: boolean;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SettingsData>({
    user: '',
    browserType: 'BatNight Engine',
    disableTypingAnimation: false
  });

  const [activeSection, setActiveSection] = useState<'ai' | 'user' | 'browser'>('ai');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('batprox-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('batprox-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900/95 border border-white/20 rounded-2xl w-full max-w-4xl h-[600px] shadow-2xl flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-black/40 border-r border-white/10 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveSection('ai')}
              className={`w-full px-4 py-3 rounded-xl text-left transition-all ${
                activeSection === 'ai'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🤖</span>
                <span className="font-medium">AI Settings</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('user')}
              className={`w-full px-4 py-3 rounded-xl text-left transition-all ${
                activeSection === 'user'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">👤</span>
                <span className="font-medium">User Settings</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('browser')}
              className={`w-full px-4 py-3 rounded-xl text-left transition-all ${
                activeSection === 'browser'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🌐</span>
                <span className="font-medium">Browser Settings</span>
              </div>
            </button>
          </nav>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-2 mt-4"
          >
            {saved ? (
              <>
                <span>✓</span>
                <span>Saved</span>
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-white mb-6">AI Settings</h3>
              
              <div className="bg-black/30 rounded-xl p-6 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-lg font-medium text-white mb-2">
                      Disable typing animation response
                    </label>
                    <p className="text-sm text-white/60">
                      AI will send messages instantly without typing effect
                    </p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, disableTypingAnimation: !settings.disableTypingAnimation })}
                    className={`relative w-16 h-9 rounded-full transition-colors ${
                      settings.disableTypingAnimation ? 'bg-purple-600' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-transform ${
                        settings.disableTypingAnimation ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'user' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-white mb-6">User Settings</h3>
              
              <div className="bg-black/30 rounded-xl p-6 border border-white/10">
                <label className="block text-lg font-medium text-white mb-3">
                  Username
                </label>
                <input
                  type="text"
                  value={settings.user}
                  onChange={(e) => setSettings({ ...settings, user: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  placeholder="Enter your username"
                />
                <p className="text-sm text-white/60 mt-2">
                  This will be used to identify your account and preferences.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'browser' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-white mb-6">Browser Settings</h3>
              
              <div className="bg-black/30 rounded-xl p-6 border border-white/10">
                <label className="block text-lg font-medium text-white mb-3">
                  Search Engine
                </label>
                <select
                  value={settings.browserType}
                  onChange={(e) => setSettings({ ...settings, browserType: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="BatNight Engine">BatNight Engine</option>
                  <option value="Google">Google</option>
                  <option value="Bing">Bing</option>
                  <option value="DuckDuckGo">DuckDuckGo</option>
                  <option value="Yahoo">Yahoo</option>
                  <option value="Ask">Ask</option>
                </select>
                <p className="text-sm text-white/60 mt-2">
                  Select your preferred search engine for browsing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
