import { useEffect, useState } from 'react';

export default function Advertisement() {
  const [eyesIn, setEyesIn] = useState(false);
  const [blink, setBlink] = useState(false);
  const [winkRight, setWinkRight] = useState(false);
  const [bgWhite, setBgWhite] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    document.body.style.background = '#000000';
    document.documentElement.style.background = '#000000';
    (document.body as any).style.backgroundImage = 'none';
    const prev = document.body.style.transition;
    document.body.style.transition = 'background-color 1.2s ease';
    const a = setTimeout(() => setEyesIn(true), 820);
    const b = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 220); }, 2100);
    const c = setTimeout(() => { setWinkRight(true); setTimeout(() => setWinkRight(false), 360); }, 3220);
    const d = setTimeout(() => setBgWhite(true), 4120);
    const p = setInterval(() => setPulse(v => v + 1), 4600);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); clearTimeout(d); clearInterval(p); document.body.style.transition = prev; };
  }, []);

  useEffect(() => {
    if (bgWhite) {
      document.body.style.background = '#ffffff';
      document.documentElement.style.background = '#ffffff';
      (document.body as any).style.backgroundImage = 'none';
      document.body.style.transition = 'background-color 1.6s ease';
    }
  }, [bgWhite]);

  useEffect(() => {
    if (pulse === 0) return;
    const x = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 200); }, 600);
    const y = setTimeout(() => { if (Math.random() > 0.5) { setWinkRight(true); setTimeout(() => setWinkRight(false), 320); } }, 1700);
    return () => { clearTimeout(x); clearTimeout(y); };
  }, [pulse]);

  const leftScale = blink ? 0.07 : 1;
  const rightScale = blink ? 0.07 : winkRight ? 0.07 : 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bgWhite ? '#ffffff' : '#000000',
        transition: 'background-color 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        overflow: 'hidden'
      }}
    >
      <style>{`@keyframes adFloat2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          willChange: 'transform, opacity, filter',
          animation: eyesIn ? 'adFloat2 6.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' : 'none',
          filter: bgWhite ? 'drop-shadow(0 20px 44px rgba(0,0,0,0.14))' : 'drop-shadow(0 20px 44px rgba(168,85,247,0.32))',
          transition: 'filter 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        <svg width={330} height={330} viewBox="-6 0 112 100" fill="none" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="adGlowW3" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.9" /></filter>
            <filter id="adGlowO3" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" /></filter>
            <filter id="adSoft3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
            <linearGradient id="adWing3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1c1533" /><stop offset="100%" stopColor="#241a4a" /></linearGradient>
          </defs>
          <g style={{ opacity: bgWhite ? 1 : 0, transition: 'opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1)', willChange: 'opacity' }}>
            <ellipse cx="50" cy="57" rx="32" ry="15" fill={bgWhite ? '#f5f0ff' : '#130d2a'} opacity={bgWhite ? 0.5 : 0.2} style={{ transition: 'fill 2s ease, opacity 2s ease' }} filter="url(#adSoft3)" />
            <path d="M30 50 C16 44 2 44 -4 54 L6 55 C2 60 3 67 9 71 L7 77 C15 80 24 78 29 72 C31 64 31 56 30 50 Z" fill="url(#adWing3)" stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.4} strokeWidth="1.4" strokeLinejoin="round" style={{ transition: 'stroke-opacity 2s ease' }} />
            <path d="M22 56 C14 53 7 54 3 58" stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.34} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M21 64 C15 63 10 66 8 70" stroke="#a855f7" strokeOpacity={bgWhite ? 0.13 : 0.28} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M70 50 C84 44 98 44 104 54 L94 55 C98 60 97 67 91 71 L93 77 C85 80 76 78 71 72 C69 64 69 56 70 50 Z" fill="url(#adWing3)" stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.4} strokeWidth="1.4" strokeLinejoin="round" style={{ transition: 'stroke-opacity 2s ease' }} />
            <path d="M78 56 C86 53 93 54 97 58" stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.34} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M79 64 C85 63 90 66 92 70" stroke="#a855f7" strokeOpacity={bgWhite ? 0.13 : 0.28} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M19 26 C20 15 27 7.5 36 5 C43 3.2 50 3.2 56 5.5 C62 8 66 11.5 68 15.5" stroke={bgWhite ? '#111111' : '#F5F2FF'} strokeWidth="4.6" strokeLinecap="round" fill="none" style={{ transition: 'stroke 2s ease' }} />
            <path d="M20.5 28 C23 18 28 10.5 37 8.2 C43 6.5 49 6.5 54.5 8.5" stroke={bgWhite ? '#2e2e2e' : '#c9c2e0'} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={bgWhite ? 0.52 : 0.78} style={{ transition: 'stroke 2s ease' }} />
            <path d="M 24,48 C 16,44 10.5,36 12,27 L 14.5,24.5 C 19,25.5 24,29 30,31.5 C 33.5,30 38,29 43,28.6 C 46,28.3 49.5,28 52,28 C 54.5,20 57.5,12 61.5,5.5 L 65,9 C 70,16 73.5,26 75.5,35 C 78,39 80,43 80,46 C 85,53 87,65 83,74 C 77,84 65,88.5 50,88.5 C 35,88.5 23,84 17,74 C 13,66 15,55 24,48 Z" fill={bgWhite ? '#0a0a0a' : '#0B0B12'} stroke="#a855f7" strokeOpacity={bgWhite ? 0.2 : 0.5} strokeWidth="1.6" strokeLinejoin="round" style={{ transition: 'fill 2s ease, stroke-opacity 2s ease' }} />
            <g transform="rotate(-90 19 31)">
              <rect x="12" y="22" width="14" height="18" rx="7" fill={bgWhite ? '#ffffff' : '#F5F2FF'} stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.28} strokeWidth="1" style={{ transition: 'fill 2s ease' }} />
              <rect x="16.75" y="24" width="4.5" height="7.5" rx="2.25" fill="#a855f7" opacity={bgWhite ? 0.42 : 0.52} />
              <circle cx="14.5" cy="37.5" r="1" fill={bgWhite ? '#9ca3af' : '#c9c2e0'} />
              <circle cx="23.5" cy="37.5" r="1" fill={bgWhite ? '#9ca3af' : '#c9c2e0'} />
            </g>
            <g transform="rotate(-8 60 22)">
              <rect x="52.5" y="13" width="15" height="18" rx="7.5" fill={bgWhite ? '#ffffff' : '#F5F2FF'} stroke="#a855f7" strokeOpacity={bgWhite ? 0.16 : 0.28} strokeWidth="1" style={{ transition: 'fill 2s ease' }} />
              <rect x="56.5" y="17.5" width="4.5" height="9.5" rx="2.25" fill="#a855f7" opacity={bgWhite ? 0.42 : 0.52} />
              <circle cx="55.5" cy="16" r="1" fill={bgWhite ? '#9ca3af' : '#c9c2e0'} />
              <circle cx="55.5" cy="28" r="1" fill={bgWhite ? '#9ca3af' : '#c9c2e0'} />
            </g>
            <path d="M10 34 C8 38 8 42 10 45" stroke={bgWhite ? '#111111' : '#F5F2FF'} strokeWidth="2" strokeLinecap="round" fill="none" style={{ transition: 'stroke 2s ease' }} />
            <circle cx="10.5" cy="46.5" r="2.2" fill={bgWhite ? '#111111' : '#F5F2FF'} style={{ transition: 'fill 2s ease' }} />
            <ellipse cx="29" cy="66" rx="4.5" ry="2.8" fill="#f472b6" opacity={bgWhite ? 0.16 : 0.3} style={{ transition: 'opacity 2s ease' }} />
            <ellipse cx="71" cy="66" rx="4.5" ry="2.8" fill="#f472b6" opacity={bgWhite ? 0.16 : 0.3} style={{ transition: 'opacity 2s ease' }} />
          </g>
          <g style={{ transformOrigin: '39px 55.3px', transform: `rotate(8deg) scaleY(${leftScale})`, transition: 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1)', opacity: eyesIn ? 1 : 0, willChange: 'transform, opacity' }}>
            <rect x="31" y="53" width="16" height="4.6" rx="2.3" transform="rotate(8 39 55.3)" fill="#ffffff" filter="url(#adGlowW3)" opacity="0.85" />
            <rect x="31" y="53" width="16" height="4.6" rx="2.3" transform="rotate(8 39 55.3)" fill="#ffffff" />
            <circle cx="39" cy="55.3" r="0.9" fill="#e5e7eb" opacity="0.95" />
          </g>
          <g style={{ transformOrigin: '61px 55.3px', transform: `rotate(-8deg) scaleY(${rightScale})`, transition: 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1)', opacity: eyesIn ? 1 : 0, willChange: 'transform, opacity' }}>
            <rect x="53" y="53" width="16" height="4.6" rx="2.3" transform="rotate(-8 61 55.3)" fill="#f97316" filter="url(#adGlowO3)" opacity="0.92" />
            <rect x="53" y="53" width="16" height="4.6" rx="2.3" transform="rotate(-8 61 55.3)" fill="#fb923c" />
            <rect x="53" y="53" width="16" height="4.6" rx="2.3" transform="rotate(-8 61 55.3)" fill="#fff7ed" opacity="0.32" />
            <circle cx="61" cy="55.3" r="0.9" fill="#fff7ed" opacity="0.9" />
          </g>
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: bgWhite ? 'radial-gradient(ellipse at center, rgba(255,255,255,0) 42%, rgba(0,0,0,0.04) 100%)' : 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
          transition: 'background 2s ease, opacity 1.2s ease',
          opacity: eyesIn ? 1 : 0
        }}
      />
    </div>
  );
}
