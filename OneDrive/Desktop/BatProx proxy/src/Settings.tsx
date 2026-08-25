import React, { useState, useEffect, useRef } from 'react';
import { launchAboutBlankCloak } from './cloak';
import { THEMES, applyTheme } from './theme';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsData {
  browserType: string;
  disableTypingAnimation: boolean;
  autoLoginPage: boolean;
  aboutBlankTab: boolean;
  theme: string;
}

const defaultSettings: SettingsData = {
  browserType: 'BatNight Engine',
  disableTypingAnimation: false,
  autoLoginPage: true,
  aboutBlankTab: false,
  theme: 'Bat Purple'
};

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
      checked ? 'bg-purple-600' : 'bg-white/10'
    }`}
    style={{ height: '24px', width: '44px' }}
  >
    <span
      className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
        checked ? 'left-[23px] w-[18px] h-[18px] bg-white' : 'left-[3px] w-[18px] h-[18px] bg-white/70'
      }`}
    />
  </button>
);

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [activeSection, setActiveSection] = useState<'ai' | 'browser' | 'themes'>('ai');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const savedSettings = localStorage.getItem('batprox-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch {
        setSettings(defaultSettings);
      }
    } else {
      setSettings(defaultSettings);
    }
  }, [isOpen]);

  const updateSettings = (next: SettingsData) => {
    setSettings(next);
    localStorage.setItem('batprox-settings', JSON.stringify(next));
    applyTheme(next.theme);
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
    if (next.aboutBlankTab && !settings.aboutBlankTab) {
      setTimeout(() => launchAboutBlankCloak(), 400);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl h-[560px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex bg-[#0b0b10]/95">
        <div className="w-52 shrink-0 border-r border-white/5 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-1">
            <h2 className="text-sm font-semibold text-white/90">Settings</h2>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="space-y-0.5">
            {[
              { id: 'ai' as const, label: 'AI' },
              { id: 'browser' as const, label: 'Browser' },
              { id: 'themes' as const, label: 'Website themes' }
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full px-3 py-2 rounded-lg text-left text-[13px] transition-colors ${
                  activeSection === section.id
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03]'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-white/5 px-1">
            <p className="text-[11px] text-white/25">Saved automatically</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 pt-6 pb-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white/90">
              {activeSection === 'ai' ? 'AI' : activeSection === 'browser' ? 'Browser' : 'Website themes'}
            </h3>
            {saved && (
              <span className="text-[11px] text-white/40 ml-2">Saved</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === 'ai' && (
              <div className="space-y-2.5 max-w-xl">
                <div className="flex items-center justify-between gap-6 py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div>
                    <p className="text-[13px] text-white/90">Disable typing animation response</p>
                    <p className="text-xs text-white/35 mt-0.5">AI will send messages instantly without typing effect</p>
                  </div>
                  <Toggle
                    checked={settings.disableTypingAnimation}
                    onChange={() => updateSettings({ ...settings, disableTypingAnimation: !settings.disableTypingAnimation })}
                  />
                </div>
              </div>
            )}

            {activeSection === 'browser' && (
              <div className="space-y-2.5 max-w-xl">
                <div className="py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <p className="text-[13px] text-white/90 mb-0.5">Search engine</p>
                  <p className="text-xs text-white/35 mb-3">Used when you search instead of typing a web address</p>
                  <select
                    value={settings.browserType}
                    onChange={(e) => updateSettings({ ...settings, browserType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-[13px] focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer"
                  >
                    <option value="BatNight Engine">BatNight Engine</option>
                    <option value="Google">Google</option>
                    <option value="Bing">Bing</option>
                    <option value="DuckDuckGo">DuckDuckGo</option>
                    <option value="Yahoo">Yahoo</option>
                    <option value="Ask">Ask</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-6 py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div>
                    <p className="text-[13px] text-white/90">Auto login page</p>
                    <p className="text-xs text-white/35 mt-0.5">Once you leave the tab/website, the website will detect that and will instantly go back to login page.</p>
                  </div>
                  <Toggle
                    checked={settings.autoLoginPage}
                    onChange={() => updateSettings({ ...settings, autoLoginPage: !settings.autoLoginPage })}
                  />
                </div>

                <div className="flex items-center justify-between gap-6 py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div>
                    <p className="text-[13px] text-white/90">about:blank tab</p>
                    <p className="text-xs text-white/35 mt-0.5">Once enabled, this will make the website go in about:blank invisble mode for the teachers. (they wont be able to see your screen).</p>
                  </div>
                  <Toggle
                    checked={settings.aboutBlankTab}
                    onChange={() => updateSettings({ ...settings, aboutBlankTab: !settings.aboutBlankTab })}
                  />
                </div>
              </div>
            )}

            {activeSection === 'themes' && (
              <div className="space-y-2.5 max-w-xl">
                <div className="py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <p className="text-[13px] text-white/90 mb-0.5">our themes here</p>
                  <p className="text-xs text-white/35 mb-3">Pick a theme and the whole website recolors instantly.</p>
                  <div className="relative">
                    <select
                      value={settings.theme}
                      onChange={(e) => updateSettings({ ...settings, theme: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-[13px] focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer"
                    >
                      {THEMES.map((t) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {['#a855f7', '#00f0ff', '#14b8a6', '#10b981', '#f97316', '#22c55e', '#ec4899', '#c0c0c0', '#fbbf24'].map((c) => (
                      <span key={c} className="w-6 h-6 rounded-md border border-white/10" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
