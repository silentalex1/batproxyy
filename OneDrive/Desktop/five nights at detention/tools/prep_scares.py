from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import cv2
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEACHERS = os.path.join(ROOT, "public", "assets", "teachers")

SOURCES = {
    "math": "math-portrait.png",
    "gym": "gym-portrait.png",
    "principal": "principal-portrait.png",
    "history": "history-body.png",
}

FACES = {
    "math": (165, 75, 205, 240),
    "gym": (55, 45, 95, 145),
    "principal": (120, 65, 165, 235),
    "history": (128, 110, 77, 105),
}

OUT = 640


GAIN = {"math": 1.0, "gym": 0.78, "principal": 0.9, "history": 1.28}


def crop_face(img, face):
    x, y, w, h = face
    cx, cy = x + w / 2, y + h * 0.46
    side = w * 2.3
    box = (
        int(cx - side / 2),
        int(cy - side * 0.52),
        int(cx + side / 2),
        int(cy + side * 0.48),
    )
    pad = Image.new("RGB", img.size, (0, 0, 0))
    pad.paste(img.convert("RGB"), (0, 0))
    return pad.crop(box).resize((OUT, OUT), Image.LANCZOS)


def terrify(img, gain):
    a = np.asarray(img).astype(np.float32) / 255.0 * gain
    grey = a.mean(axis=2, keepdims=True)
    a = grey + (a - grey) * 0.2
    a = np.clip((a - 0.44) * 2.15 + 0.33, 0.0, 1.0)
    a = np.power(a, 1.15)
    a[..., 0] *= 1.07
    a[..., 1] *= 0.92
    a[..., 2] *= 0.88

    hot = np.clip((a.mean(axis=2, keepdims=True) - 0.8) * 3.0, 0, 1)
    a = a + hot * np.array([0.26, 0.22, 0.18])

    ys, xs = np.mgrid[0:OUT, 0:OUT]
    r = np.sqrt(((xs / OUT - 0.5) * 2) ** 2 + ((ys / OUT - 0.5) * 2) ** 2)
    a *= np.clip(1.0 - np.clip(r - 0.28, 0, None) * 1.7, 0.0, 1.0)[..., None]
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGB")


def oval(size, inset=0.03, blur=34):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((size * inset, size * inset, size * (1 - inset), size * (1 - inset)), fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


for name, file in SOURCES.items():
    src = Image.open(os.path.join(TEACHERS, file))
    face = terrify(crop_face(src, FACES[name]), GAIN[name]).convert("RGBA")
    face.putalpha(oval(OUT))
    face.save(os.path.join(TEACHERS, "scare-%s.png" % name))
    print(name, file, src.size)
