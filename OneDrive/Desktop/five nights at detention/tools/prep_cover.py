from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public", "assets")
OUT = os.path.join(ROOT, "public", "cover.jpg")

W, H = 960, 600


def grade(img, lift, gamma, sat, cool):
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb = np.power(a[..., :3], gamma) * lift
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = grey + (rgb - grey) * sat
    for i, k in enumerate(cool):
        rgb[..., i] *= k
    a[..., :3] = np.clip(rgb, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), img.mode)


def vignette(img, strength):
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w]
    nx = (xs / (w - 1) - 0.5) * 2.0
    ny = (ys / (h - 1) - 0.5) * 2.0
    r = np.sqrt(nx * nx * 0.78 + ny * ny)
    v = np.clip(1.0 - strength * np.clip(r - 0.24, 0, None) ** 1.3, 0.0, 1.0)[..., None]
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= v
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def cover_crop(img, w, h):
    src_ratio = img.width / img.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:
        new_w = int(img.height * dst_ratio)
        box = ((img.width - new_w) // 2, 0, (img.width + new_w) // 2, img.height)
    else:
        new_h = int(img.width / dst_ratio)
        box = (0, int((img.height - new_h) * 0.42), img.width, int((img.height - new_h) * 0.42) + new_h)
    return img.crop(box).resize((w, h), Image.LANCZOS)


def glow(size, cx, cy, rx, ry, colour, power):
    layer = Image.new("RGB", size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=colour)
    layer = layer.filter(ImageFilter.GaussianBlur(rx * 0.55))
    a = np.asarray(layer).astype(np.float32) * power
    return a


def build():
    room = Image.open(os.path.join(PUB, "office", "detention.png")).convert("RGB")
    base = cover_crop(room, W, H)
    base = grade(base, 2.25, 0.86, 0.55, (0.92, 0.99, 1.16))

    lit = np.asarray(base).astype(np.float32)
    lit += glow((W, H), int(W * 0.54), int(H * 0.34), int(W * 0.33), int(H * 0.35), (150, 178, 226), 0.72)
    base = Image.fromarray(np.clip(lit, 0, 255).astype(np.uint8), "RGB")

    fig = Image.open(os.path.join(PUB, "teachers", "math-cut.png")).convert("RGBA")
    fh = int(H * 1.02)
    fig = fig.resize((int(fig.width * fh / fig.height), fh), Image.LANCZOS)
    sil = np.asarray(fig).astype(np.float32)
    sil[..., :3] *= 0.34
    sil[..., 0] *= 1.1
    fig = Image.fromarray(np.clip(sil, 0, 255).astype(np.uint8), "RGBA")
    base.paste(fig, (int(W * 0.06), int(H * 0.10)), fig)

    face = Image.open(os.path.join(PUB, "teachers", "scare-principal.png")).convert("RGBA")
    fs = int(H * 0.56)
    face = face.resize((fs, fs), Image.LANCZOS)
    fa = np.asarray(face).astype(np.float32)
    fa[..., 3] *= 0.62
    face = Image.fromarray(np.clip(fa, 0, 255).astype(np.uint8), "RGBA")
    base.paste(face, (int(W * 0.60), int(H * 0.08)), face)

    base = vignette(base, 0.9)

    noise = Image.open(os.path.join(PUB, "office", "noise.png")).convert("RGB").resize((W, H), Image.NEAREST)
    mixed = np.asarray(base).astype(np.float32) + (np.asarray(noise).astype(np.float32) - 128) * 0.06
    base = Image.fromarray(np.clip(mixed, 0, 255).astype(np.uint8), "RGB")

    base.save(OUT, quality=88)
    print("wrote", OUT, base.size)


build()
