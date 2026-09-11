export type BackgroundId = 'theme' | 'anime' | 'girl' | 'crows' | 'japanese' | 'boondocks' | 'synthwave' | 'bokeh' | 'rain' | 'hive' | 'stars' | 'grid' | 'upload';

export const BACKGROUNDS: { id: BackgroundId; name: string; kind: 'image' | 'design' | 'upload' }[] = [
  { id: 'theme', name: 'Theme scenery', kind: 'design' },
  { id: 'anime', name: 'anime background', kind: 'image' },
  { id: 'girl', name: 'for the girls', kind: 'image' },
  { id: 'crows', name: 'crows', kind: 'image' },
  { id: 'japanese', name: 'random japanese/chinese words', kind: 'image' },
  { id: 'boondocks', name: 'tuff background idk', kind: 'image' },
  { id: 'synthwave', name: 'Synthwave', kind: 'design' },
  { id: 'bokeh', name: 'Bokeh', kind: 'design' },
  { id: 'rain', name: 'Rain', kind: 'design' },
  { id: 'hive', name: 'Hive', kind: 'design' },
  { id: 'stars', name: 'Stars', kind: 'design' },
  { id: 'grid', name: 'Grid', kind: 'design' },
  { id: 'upload', name: 'Upload', kind: 'upload' }
];

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem('batprox-settings') || '{}');
  } catch {
    return {};
  }
}

const DESIGNS: Record<string, string> = {
  synthwave: 'linear-gradient(180deg, #12041f 0%, #2a0a4a 35%, #6d28d9 70%, #f97316 130%)',
  bokeh: 'radial-gradient(circle at 25% 35%, rgba(251,191,36,0.28) 0, transparent 28%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.25) 0, transparent 30%), radial-gradient(circle at 55% 20%, rgba(59,130,246,0.18) 0, transparent 26%), #0b0b10',
  rain: 'repeating-linear-gradient(110deg, transparent 0 26px, rgba(168,85,247,0.10) 26px 27px, transparent 27px 54px, rgba(255,255,255,0.06) 54px 55px), #08080d',
  hive: 'radial-gradient(circle, rgba(168,85,247,0.30) 1.6px, transparent 2.2px), #08080d',
  stars: 'radial-gradient(1.8px 1.8px at 8% 12%, #fff, transparent), radial-gradient(1.4px 1.4px at 18% 32%, #fff, transparent), radial-gradient(2px 2px at 34% 18%, #fff, transparent), radial-gradient(1.6px 1.6px at 48% 8%, #fff, transparent), radial-gradient(2.2px 2.2px at 62% 14%, #fff, transparent), radial-gradient(1.5px 1.5px at 78% 22%, #fff, transparent), radial-gradient(1.9px 1.9px at 88% 38%, #fff, transparent), radial-gradient(1.3px 1.3px at 12% 52%, #fff, transparent), radial-gradient(1.7px 1.7px at 32% 62%, #fff, transparent), radial-gradient(2px 2px at 52% 42%, #fff, transparent), radial-gradient(1.4px 1.4px at 68% 58%, #fff, transparent), radial-gradient(1.8px 1.8px at 84% 68%, #fff, transparent), radial-gradient(1.2px 1.2px at 18% 82%, #fff, transparent), radial-gradient(1.9px 1.9px at 42% 88%, #fff, transparent), radial-gradient(1.6px 1.6px at 64% 78%, #fff, transparent), radial-gradient(1.3px 1.3px at 78% 88%, #fff, transparent), #020208',
  grid: 'linear-gradient(rgba(168,85,247,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.14) 1px, transparent 1px), #06060b'
};

function applyEmbers() {
  const theme = document.documentElement.getAttribute('data-theme') || '';
  const want = theme === 'Blood Moon' || theme === 'Red Moon';
  const existing = Array.from(document.querySelectorAll('.bp-ember'));
  if (!want) {
    existing.forEach(e => e.remove());
    return;
  }
  if (existing.length >= 14) return;
  existing.forEach(e => e.remove());
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  if (reduce) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 14; i++) {
    const e = document.createElement('span');
    e.className = 'bp-ember';
    e.style.left = (Math.random() * 100).toFixed(2) + '%';
    e.style.animationDelay = (Math.random() * 9).toFixed(2) + 's';
    e.style.animationDuration = (7 + Math.random() * 7).toFixed(2) + 's';
    e.style.opacity = String(0.5 + Math.random() * 0.5);
    frag.appendChild(e);
  }
  document.body.appendChild(frag);
}

export function applyBackground() {
  const s = readSettings();
  const id: BackgroundId = s.background || 'synthwave';
  const root = document.documentElement;
  setTimeout(applyEmbers, 0);
  root.setAttribute('data-bp-bg', id);
  root.setAttribute('data-bp-has-bg', '1');
  let layer = document.getElementById('bp-bg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'bp-bg-layer';
    document.body.prepend(layer);
  }
  layer.className = 'bp-bg-layer bp-bg-scrim';
  layer.style.filter = '';
  if (id === 'theme') {
    layer.className = 'bp-bg-layer bp-theme-fx';
    layer.style.background = '';
    layer.style.backgroundSize = '';
    return;
  }
  if (id === 'anime') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/animebackground.jpg) center / cover no-repeat fixed';
  } else if (id === 'girl') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/backgroundgirl.png) center / cover no-repeat fixed';
  } else if (id === 'crows') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/crows.gif) center / cover no-repeat fixed';
  } else if (id === 'japanese') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/japanese%20words.png) center / cover no-repeat fixed';
  } else if (id === 'boondocks') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/boondocks-4hbyyrax1z1nnufn.png) center / cover no-repeat fixed';
  } else if (id === 'upload' && s.backgroundUpload) {
    layer.style.background = `linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(${s.backgroundUpload}) center / cover no-repeat fixed`;
  } else {
    layer.style.background = DESIGNS[id] || '';
    layer.style.backgroundSize = id === 'hive' ? '18px 18px' : id === 'grid' ? '14px 14px' : '';
  }
}
