from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEACHERS = os.path.join(ROOT, "public", "assets", "teachers")
CAMS = os.path.join(ROOT, "public", "assets", "cameras")

SOURCES = {
    "principal": (os.path.join(TEACHERS, "teacherupdate.png"), (118, 40, 436, 1044)),
    "huff": (os.path.join(TEACHERS, "mrs huff.jpg"), (316, 82, 642, 1126)),
}


def grade(img, lift, gamma, sat, cool):
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb = np.power(a[..., :3], gamma) * lift
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = grey + (rgb - grey) * sat
    for i, k in enumerate(cool):
        rgb[..., i] *= k
    a[..., :3] = np.clip(rgb, 0.0, 1.0)
    return Image.fromarray((a * 255.0).astype(np.uint8), img.mode)


def body_mask(size, feather, waist=0.9):
    w, h = size
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((int(w * 0.10), int(h * 0.005), int(w * 0.90), int(h * 0.995)), fill=255)
    d.rectangle((int(w * (0.5 - waist * 0.22)), int(h * 0.18), int(w * (0.5 + waist * 0.22)), int(h * 0.96)), fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather))


def edge_darken(img, strength=0.85):
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w]
    nx = (xs / (w - 1) - 0.5) * 2.0
    ny = (ys / (h - 1) - 0.5) * 2.0
    r = np.sqrt(nx * nx * 1.5 + ny * ny * 0.55)
    v = np.clip(1.0 - strength * np.clip(r - 0.35, 0, None) ** 1.2, 0.0, 1.0)[..., None]
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= v
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def cutout(key, lift, gamma, sat, cool, feather, out_w, out_h):
    path, box = SOURCES[key]
    src = Image.open(path).convert("RGB").crop(box)
    src = src.resize((out_w, out_h), Image.LANCZOS)
    src = edge_darken(grade(src, lift, gamma, sat, cool))
    out = src.convert("RGBA")
    out.putalpha(body_mask(out.size, feather))
    return out


def head_crop(key, box, size, lift, gamma, sat, cool, feather):
    path, _ = SOURCES[key]
    src = Image.open(path).convert("RGB").crop(box).resize(size, Image.LANCZOS)
    src = grade(src, lift, gamma, sat, cool)
    out = src.convert("RGBA")
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse((feather, feather, size[0] - feather, size[1] - feather), fill=255)
    out.putalpha(m.filter(ImageFilter.GaussianBlur(feather * 0.8)))
    return out


def build():
    lounge = cutout("principal", 0.52, 1.34, 0.5, (0.9, 0.96, 1.12), 12, 206, 684)
    lounge.save(os.path.join(CAMS, "lounge-principal.png"))

    body = cutout("principal", 0.66, 1.24, 0.5, (0.9, 0.96, 1.12), 13, 312, 1213)
    body.save(os.path.join(TEACHERS, "principal-cut.png"))

    portrait = cutout("principal", 1.0, 1.05, 0.7, (0.95, 0.98, 1.06), 10, 260, 900)
    portrait.save(os.path.join(TEACHERS, "principal-portrait.png"))

    scare = head_crop("principal", (250, 40, 430, 250), (523, 537), 1.45, 0.82, 0.85, (1.1, 0.95, 0.95), 16)
    scare.save(os.path.join(TEACHERS, "scare-principal.png"))

    huff_body = cutout("huff", 0.62, 1.26, 0.48, (0.9, 0.96, 1.12), 13, 312, 1213)
    huff_body.save(os.path.join(TEACHERS, "huff-cut.png"))

    huff_portrait = cutout("huff", 1.0, 1.05, 0.68, (0.95, 0.98, 1.06), 10, 260, 900)
    huff_portrait.save(os.path.join(TEACHERS, "huff-portrait.png"))

    huff_scare = head_crop("huff", (352, 90, 500, 260), (523, 537), 1.5, 0.8, 0.9, (1.1, 0.95, 0.95), 16)
    huff_scare.save(os.path.join(TEACHERS, "scare-huff.png"))

    print("principal + huff assets written")


build()
