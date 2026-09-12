from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import cv2
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMS = os.path.join(ROOT, "public", "assets", "cameras")
SRC = os.path.join(CAMS, "teachers-lounge.jpg")

FIGURES = {
    "history": (205, 178, 400, 862),
    "math": (372, 300, 694, 678),
    "gym": (880, 308, 1210, 634),
    "principal": (1290, 176, 1496, 860),
}

PAD = 20
FEATHER = 12
SHRINK = 6


def hole_mask(size, pad, radius, blur=0):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for x0, y0, x1, y1 in FIGURES.values():
        d.rounded_rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), radius=radius, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def coarse_fill(src, mask):
    w, h = src.size
    sw, sh = w // SHRINK, h // SHRINK
    small = np.asarray(src.resize((sw, sh), Image.LANCZOS))
    smask = (np.asarray(mask.resize((sw, sh), Image.BILINEAR)) > 40).astype(np.uint8) * 255
    out = cv2.inpaint(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), smask, 8, cv2.INPAINT_TELEA)
    big = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).resize((w, h), Image.LANCZOS)
    return big.filter(ImageFilter.GaussianBlur(7))


def shade(img, mask, amount=0.45):
    v = 1.0 - (np.asarray(mask).astype(np.float32) / 255.0) * amount
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def grade(img, lift=0.72, sat=0.58, cool=(0.92, 0.97, 1.10), gamma=1.16):
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb = np.power(a[..., :3], gamma) * lift
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = grey + (rgb - grey) * sat
    for i, k in enumerate(cool):
        rgb[..., i] *= k
    a[..., :3] = np.clip(rgb, 0.0, 1.0)
    return Image.fromarray((a * 255.0).astype(np.uint8), img.mode)


def vignette(img, strength=0.85):
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w]
    nx = (xs / (w - 1) - 0.5) * 2.0
    ny = (ys / (h - 1) - 0.5) * 2.0
    r = np.sqrt(nx * nx * 0.8 + ny * ny)
    v = np.clip(1.0 - strength * np.clip(r - 0.38, 0, None) ** 1.35, 0.0, 1.0)[..., None]
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= v
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def feather_mask(size, radius, blur):
    w, h = size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((blur, blur, w - blur, h - blur), radius=radius, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur * 0.5))


def build():
    src = Image.open(SRC).convert("RGB")
    paste = hole_mask(src.size, PAD, 30, blur=12)
    empty = src.copy()
    empty.paste(coarse_fill(src, hole_mask(src.size, PAD, 30)), (0, 0), paste)
    empty = shade(empty, hole_mask(src.size, PAD + 26, 60, blur=46))
    empty = vignette(grade(empty))
    empty.save(os.path.join(CAMS, "lounge-empty.jpg"), quality=92)

    for name, box in FIGURES.items():
        crop = grade(src.crop(box)).convert("RGBA")
        crop.putalpha(feather_mask(crop.size, 26, FEATHER))
        crop.save(os.path.join(CAMS, "lounge-%s.png" % name))
        print(
            "%s: left %.2f%% top %.2f%% width %.2f%% height %.2f%%"
            % (
                name,
                box[0] / src.width * 100,
                box[1] / src.height * 100,
                (box[2] - box[0]) / src.width * 100,
                (box[3] - box[1]) / src.height * 100,
            )
        )


build()
