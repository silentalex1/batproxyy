import { useNavigate } from 'react-router-dom';
import { AmbientBg, SideRail } from './Chrome';

export default function MusicPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail />
      <main className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-7 flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(167,139,250,0.32)' }}
          >
            <svg className="w-10 h-10 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Page is still under development please wait.</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/45">
            check changelogs for any changes.. And to always stay updated with batprox updates.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/changelog')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'var(--bp-accent, #7c3aed)' }}
            >
              Open changelogs
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-sm font-medium transition-all"
            >
              Go home
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
