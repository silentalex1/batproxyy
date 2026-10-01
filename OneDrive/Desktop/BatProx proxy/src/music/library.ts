import type { Track } from './audius';

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export interface Library {
  liked: Track[];
  playlists: Playlist[];
}

export const EMPTY_LIBRARY: Library = { liked: [], playlists: [] };

const token = () => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } };
const cacheKey = () => { try { return 'bp-music-lib-' + (localStorage.getItem('batprox-user') || 'guest'); } catch { return 'bp-music-lib-guest'; } };

export function hasAccount() {
  return !!token();
}

export function cachedLibrary(): Library {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return EMPTY_LIBRARY;
    const p = JSON.parse(raw);
    return { liked: Array.isArray(p.liked) ? p.liked : [], playlists: Array.isArray(p.playlists) ? p.playlists : [] };
  } catch {
    return EMPTY_LIBRARY;
  }
}

function remember(lib: Library) {
  try { localStorage.setItem(cacheKey(), JSON.stringify(lib)); } catch {}
  return lib;
}

async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Library> {
  const t = token();
  if (!t) throw new Error('Sign in to BatProx to save music to your library.');
  const r = await fetch('/api/music/' + path, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j: any = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || !j || j.error) throw new Error((j && j.error) || 'Could not reach your library.');
  return remember({ liked: Array.isArray(j.liked) ? j.liked : [], playlists: Array.isArray(j.playlists) ? j.playlists : [] });
}

const slim = (t: Track) => ({ id: t.id, title: t.title, artist: t.artist, handle: t.handle, artwork: t.artwork, duration: t.duration, genre: t.genre });

export const loadLibrary = () => call('library', 'GET');
export const setLiked = (track: Track, liked: boolean) => call('like', 'POST', { track: slim(track), liked });
export const createPlaylist = (name: string, track?: Track) => call('playlists', 'POST', { action: 'create', name, track: track ? slim(track) : undefined });
export const renamePlaylist = (playlistId: string, name: string) => call('playlists', 'POST', { action: 'rename', playlistId, name });
export const deletePlaylist = (playlistId: string) => call('playlists', 'POST', { action: 'delete', playlistId });
export const addToPlaylist = (playlistId: string, track: Track) => call('playlists', 'POST', { action: 'add', playlistId, track: slim(track) });
export const removeFromPlaylist = (playlistId: string, trackId: string) => call('playlists', 'POST', { action: 'remove', playlistId, trackId });
