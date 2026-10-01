import { runUpscale, offscreenSurface, offscreenEncode, type UpscaleJob } from './upscaleCore';

const post = (msg: unknown) => (self as unknown as { postMessage: (m: unknown) => void }).postMessage(msg);

self.onmessage = async (e: MessageEvent<UpscaleJob>) => {
  try {
    const result = await runUpscale(e.data, offscreenSurface, offscreenEncode, (pct, stage) => post({ type: 'progress', pct, stage }));
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'Upscaling failed.' });
  } finally {
    try { e.data.bitmap.close(); } catch {}
  }
};
