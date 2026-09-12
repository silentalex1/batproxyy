from PIL import Image, ImageFilter
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMS = os.path.join(ROOT, "public", "assets", "cameras")

JOBS = {
    "hallway": ("hallway.png", None, 0.98, 1.06),
    "cafeteria": ("cafeteria.png", None, 0.74, 1.14),
    "principal": ("principal-office.png", (0, 96, 1168, 772), 1.7, 0.9),
    "basementHall": ("basement-hallway.png", None, 0.5, 1.2),
    "basement": ("basement.png", (0, 80, 1168, 712), 1.3, 0.96),
}


def grade(img, lift, gamma, sat=0.56, cool=(0.9, 0.97, 1.12)):
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb = np.power(a, gamma) * lift
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = grey + (rgb - grey) * sat
    for i, k in enumerate(cool):
        rgb[..., i] *= k
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")


def vignette(img, strength=0.9):
    w, h = img.size
    ys, xs = np.mgrid[0:h, 0:w]
    nx = (xs / (w - 1) - 0.5) * 2.0
    ny = (ys / (h - 1) - 0.5) * 2.0
    r = np.sqrt(nx * nx * 0.82 + ny * ny)
    v = np.clip(1.0 - strength * np.clip(r - 0.36, 0, None) ** 1.35, 0.0, 1.0)[..., None]
    a = np.asarray(img).astype(np.float32) * v
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def bloom(img, amount=0.22):
    glow = img.filter(ImageFilter.GaussianBlur(14))
    a = np.asarray(img).astype(np.float32)
    g = np.asarray(glow).astype(np.float32)
    out = a + np.clip(g - 110.0, 0, None) * amount
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


for key, (name, box, lift, gamma) in JOBS.items():
    im = Image.open(os.path.join(CAMS, name)).convert("RGB")
    if box:
        im = im.crop(box)
    im = bloom(vignette(grade(im, lift, gamma)))
    im.save(os.path.join(CAMS, "cam-%s.jpg" % key), quality=90)
    print(key, im.size)
