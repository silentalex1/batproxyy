export interface Theme {
  name: string;
  filter: string;
}

export const THEMES: Theme[] = [
  { name: 'Bat Purple', filter: 'none' },
  { name: 'Cyberpunk Neon', filter: 'hue-rotate(160deg) saturate(1.45)' },
  { name: 'Ocean Deep', filter: 'hue-rotate(185deg) saturate(0.9)' },
  { name: 'Emerald Forest', filter: 'hue-rotate(110deg) saturate(1.1)' },
  { name: 'Sunset Blaze', filter: 'hue-rotate(-55deg) saturate(1.25)' },
  { name: 'Aurora Borealis', filter: 'hue-rotate(85deg) saturate(1.2)' },
  { name: 'Cherry Blossom', filter: 'hue-rotate(-30deg) saturate(0.85)' },
  { name: 'Midnight Silver', filter: 'saturate(0.12) brightness(1.05)' },
  { name: 'Golden Hour', filter: 'hue-rotate(-38deg) saturate(1.35)' }
];

export function applyTheme(name: string) {
  const theme = THEMES.find(t => t.name === name) || THEMES[0];
  document.body.style.filter = theme.filter;
  document.body.style.transition = 'filter 0.6s ease';
}

export function getSavedTheme() {
  try {
    const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
    return s.theme || 'Bat Purple';
  } catch {
    return 'Bat Purple';
  }
}
