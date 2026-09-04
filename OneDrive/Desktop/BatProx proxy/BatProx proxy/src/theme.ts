export interface Theme {
  name: string;
  accent: string;
  accent2: string;
  glow: string;
  preview: string;
}

export const THEMES: Theme[] = [
  { name: 'Bat Purple', accent: '#c084fc', accent2: '#818cf8', glow: '168, 85, 247', preview: 'linear-gradient(135deg, #c084fc, #6366f1)' },
  { name: 'Cyberpunk Neon', accent: '#05d9e8', accent2: '#ff2a6d', glow: '5, 217, 232', preview: 'linear-gradient(135deg, #05d9e8, #ff2a6d)' },
  { name: 'Ocean Deep', accent: '#00b4d8', accent2: '#90e0ef', glow: '0, 180, 216', preview: 'linear-gradient(135deg, #0c1e35, #00b4d8)' },
  { name: 'Emerald Forest', accent: '#2ecc71', accent2: '#d4e157', glow: '46, 204, 113', preview: 'linear-gradient(135deg, #0a1f14, #2ecc71)' },
  { name: 'Sunset Blaze', accent: '#ff5e5b', accent2: '#ffb703', glow: '255, 107, 53', preview: 'linear-gradient(180deg, #2d1b4e, #ff6b35)' },
  { name: 'Aurora Borealis', accent: '#63f2c5', accent2: '#a78bfa', glow: '99, 242, 197', preview: 'linear-gradient(135deg, #3ef0a0, #63f2c5 40%, #a78bfa)' },
  { name: 'Cherry Blossom', accent: '#f9a8d4', accent2: '#fb7185', glow: '244, 114, 182', preview: 'linear-gradient(135deg, #fecdd3, #f9a8d4, #c084fc)' },
  { name: 'Midnight Silver', accent: '#c0c6d0', accent2: '#8fa3b8', glow: '192, 198, 208', preview: 'linear-gradient(135deg, #14161a, #c0c6d0)' },
  { name: 'Golden Hour', accent: '#ffc53d', accent2: '#e8871e', glow: '255, 197, 61', preview: 'linear-gradient(135deg, #1a120b, #ffc53d)' }
];

export function applyTheme(name: string) {
  const theme = THEMES.find(t => t.name === name) || THEMES[0];
  const root = document.documentElement;
  root.style.filter = 'none';
  document.body.style.filter = 'none';
  document.body.style.transition = 'background-color 0.45s ease, color 0.45s ease';
  root.setAttribute('data-theme', theme.name);
  root.style.setProperty('--bp-accent', theme.accent);
  root.style.setProperty('--bp-accent-2', theme.accent2);
  root.style.setProperty('--bp-glow', theme.glow);
  window.dispatchEvent(new CustomEvent('bp-theme'));
}

export function getSavedTheme() {
  try {
    const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
    return s.theme || 'Bat Purple';
  } catch {
    return 'Bat Purple';
  }
}
