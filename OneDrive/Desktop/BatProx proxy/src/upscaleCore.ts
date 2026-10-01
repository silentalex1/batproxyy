export type Detail = 'off' | 'natural' | 'crisp';
export type OutFormat = 'image/png' | 'image/webp' | 'image/jpeg';

export interface Ctx2D {
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(data: ImageData, dx: number, dy: number, dirtyX: number, dirtyY: number, dirtyW: number, dirtyH: number): void;
  putImageData(data: ImageData, dx: number, dy: number): void;
}

export interface Surface {
  canvas: CanvasImageSource;
  ctx: Ctx2D;
}

export interface UpscaleJob {
  bitmap: ImageBitmap;
  boxW: number;
  boxH: number;
  detail: Detail;
  denoise: boolean;
  format: OutFormat;
}

export interface UpscaleResult {
  blob: Blob;
  thumb: Blob;
  w: number;
  h: number;
  scale: number;
  ms: number;
}

export type MakeSurface = (w: number, h: number) => Surface;
export type Encode = (s: Surface, type: OutFormat, quality: number) => Promise<Blob>;
export type Progress = (pct: number, stage: string) => void;

export function fitSize(srcW: number, srcH: number, boxW: number, boxH: number) {
  const portrait = srcH > srcW;
  const bw = portrait ? Math.min(boxW, boxH) : Math.max(boxW, boxH);
  const bh = portrait ? Math.max(boxW, boxH) : Math.min(boxW, boxH);
  const scale = Math.min(bw / srcW, bh / srcH);
  return { w: Math.max(1, Math.round(srcW * scale)), h: Math.max(1, Math.round(srcH * scale)), scale };
}

function smoothNoise(img: ImageData, radius: number) {
  const { width: w, height: h, data: s } = img;
  const out = new Uint8ClampedArray(s.length);
  const lut = new Float32Array(766);
  const sigmaR = 34;
  for (let i = 0; i < lut.length; i++) lut[i] = Math.exp(-(i * i) / (2 * sigmaR * sigmaR));
  const spatial: number[] = [];
  const sigmaS = Math.max(0.8, radius * 0.75);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) spatial.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS)));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const r0 = s[p], g0 = s[p + 1], b0 = s[p + 2];
      let sr = 0, sg = 0, sb = 0, sw = 0, k = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -radius; dx <= radius; dx++, k++) {
          const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const q = (yy * w + xx) * 4;
          const diff = Math.abs(s[q] - r0) + Math.abs(s[q + 1] - g0) + Math.abs(s[q + 2] - b0);
          const wt = spatial[k] * lut[diff];
          sr += s[q] * wt; sg += s[q + 1] * wt; sb += s[q + 2] * wt; sw += wt;
        }
      }
      out[p] = sr / sw; out[p + 1] = sg / sw; out[p + 2] = sb / sw; out[p + 3] = s[p + 3];
    }
  }
  img.data.set(out);
}

function gaussianKernel(sigma: number) {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return { k, r };
}

function sharpenStrips(s: Surface, w: number, h: number, amount: number, sigma: number, threshold: number, progress: Progress, from: number, to: number) {
  const { k, r } = gaussianKernel(sigma);
  const strip = Math.max(64, Math.floor(2400000 / w));
  const maxRows = strip + r * 2;
  const luma = new Float32Array(w * maxRows);
  const tmp = new Float32Array(w * maxRows);
  const blur = new Float32Array(w * maxRows);
  for (let y0 = 0; y0 < h; y0 += strip) {
    const y1 = Math.min(h, y0 + strip);
    const top = Math.max(0, y0 - r);
    const bot = Math.min(h, y1 + r);
    const rows = bot - top;
    const img = s.ctx.getImageData(0, top, w, rows);
    const d = img.data;
    const n = w * rows;
    for (let i = 0, p = 0; i < n; i++, p += 4) luma[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
    for (let y = 0; y < rows; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let j = -r; j <= r; j++) {
          const xx = x + j < 0 ? 0 : x + j >= w ? w - 1 : x + j;
          acc += luma[row + xx] * k[j + r];
        }
        tmp[row + x] = acc;
      }
    }
    const firstRow = y0 - top;
    const lastRow = y1 - top;
    for (let y = firstRow; y < lastRow; y++) {
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let j = -r; j <= r; j++) {
          const yy = y + j < 0 ? 0 : y + j >= rows ? rows - 1 : y + j;
          acc += tmp[yy * w + x] * k[j + r];
        }
        blur[y * w + x] = acc;
      }
    }
    for (let y = firstRow; y < lastRow; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const diff = luma[i] - blur[i];
        if (diff < threshold && diff > -threshold) continue;
        const add = amount * (diff > 0 ? diff - threshold : diff + threshold);
        const p = i * 4;
        d[p] = d[p] + add;
        d[p + 1] = d[p + 1] + add;
        d[p + 2] = d[p + 2] + add;
      }
    }
    s.ctx.putImageData(img, 0, top, 0, firstRow, w, lastRow - firstRow);
    progress(Math.round(from + (to - from) * (y1 / h)), 'Sharpening detail');
  }
}

const DETAIL: Record<Detail, { amount: number; threshold: number }> = {
  off: { amount: 0, threshold: 0 },
  natural: { amount: 0.75, threshold: 2 },
  crisp: { amount: 1.35, threshold: 1.5 }
};

export async function runUpscale(job: UpscaleJob, make: MakeSurface, encode: Encode, progress: Progress): Promise<UpscaleResult> {
  const started = Date.now();
  const srcW = job.bitmap.width;
  const srcH = job.bitmap.height;
  if (!srcW || !srcH) throw new Error('That image has no pixels.');
  const fit = fitSize(srcW, srcH, job.boxW, job.boxH);
  if (fit.scale <= 1) throw new Error(`This image is already ${srcW} x ${srcH}, which is at or above that quality. Pick a higher one.`);

  progress(5, 'Reading image');
  const base = make(srcW, srcH);
  base.ctx.drawImage(job.bitmap, 0, 0, srcW, srcH);

  if (job.denoise) {
    progress(10, 'Cleaning compression noise');
    const img = base.ctx.getImageData(0, 0, srcW, srcH);
    smoothNoise(img, srcW * srcH > 4000000 ? 1 : 2);
    base.ctx.putImageData(img, 0, 0);
  }

  progress(25, 'Resampling to ' + fit.w + ' x ' + fit.h);
  let out: Surface;
  try {
    out = make(fit.w, fit.h);
  } catch {
    throw new Error(`Your browser could not allocate a ${fit.w} x ${fit.h} canvas. Try a lower quality.`);
  }
  out.ctx.imageSmoothingEnabled = true;
  out.ctx.imageSmoothingQuality = 'high';
  out.ctx.drawImage(base.canvas, 0, 0, fit.w, fit.h);

  const det = DETAIL[job.detail];
  if (det.amount > 0) {
    const sigma = Math.min(2.4, 0.55 + 0.35 * Math.log2(fit.scale + 1));
    sharpenStrips(out, fit.w, fit.h, det.amount, sigma, det.threshold, progress, 35, 85);
  }

  progress(88, 'Encoding');
  const blob = await encode(out, job.format, 0.95);

  progress(96, 'Saving');
  const tw = 320;
  const th = Math.max(1, Math.round((fit.h / fit.w) * tw));
  const t = make(tw, th);
  t.ctx.imageSmoothingEnabled = true;
  t.ctx.imageSmoothingQuality = 'high';
  t.ctx.drawImage(out.canvas, 0, 0, tw, th);
  const thumb = await encode(t, 'image/jpeg', 0.8);

  progress(100, 'Done');
  return { blob, thumb, w: fit.w, h: fit.h, scale: fit.scale, ms: Date.now() - started };
}

export function offscreenSurface(w: number, h: number): Surface {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  return { canvas, ctx: ctx as unknown as Ctx2D };
}

export function offscreenEncode(s: Surface, type: OutFormat, quality: number) {
  return (s.canvas as OffscreenCanvas).convertToBlob({ type, quality });
}

export function domSurface(w: number, h: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  return { canvas, ctx: ctx as unknown as Ctx2D };
}

export function domEncode(s: Surface, type: OutFormat, quality: number) {
  return new Promise<Blob>((res, rej) => {
    (s.canvas as HTMLCanvasElement).toBlob(b => (b ? res(b) : rej(new Error('Could not encode the result.'))), type, quality);
  });
}
