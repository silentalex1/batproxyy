from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFFICE = os.path.join(ROOT, "public", "assets", "office")
TEACHERS = os.path.join(ROOT, "public", "assets", "teachers")


def mask_body(src_name, dest_name, inset=0.08):
    im = Image.open(os.path.join(TEACHERS, src_name)).convert("RGBA")
    w, h = im.size
    alpha = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(alpha)
    d.ellipse(
        (int(w * inset), int(h * 0.02), int(w * (1 - inset)), int(h * 0.98)),
        fill=255,
    )
    alpha = alpha.filter(ImageFilter.GaussianBlur(12))
    im.putalpha(alpha)
    im.save(os.path.join(TEACHERS, dest_name))


mask_body("math-body.png", "math-cut.png", 0.1)
mask_body("gym-body.png", "gym-cut.png", 0.1)
mask_body("history-body.png", "history-cut.png", 0.1)
mask_body("staff-body.png", "staff-cut.png", 0.1)

desk = Image.new("RGBA", (1920, 280), (0, 0, 0, 0))
dd = ImageDraw.Draw(desk)
for y in range(280):
    t = y / 279
    a = int(20 + t * 210)
    c = int(18 + t * 16)
    dd.line([(0, y), (1920, y)], fill=(c + 8, c + 4, c, a))
dd.rectangle((0, 18, 1919, 34), fill=(42, 32, 22, 180))
desk = desk.filter(ImageFilter.GaussianBlur(1.2))
desk.save(os.path.join(OFFICE, "desk.png"))


def steel(width, height, kind):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind != "closed":
        for y in range(height):
            v = 4 + int(8 * (y / height))
            d.line([(0, y), (width, y)], fill=(v, v + 1, v + 2, 255))
        d.rectangle((0, 0, width - 1, height - 1), outline=(38, 40, 44, 255), width=18)
        slab = int(width * 0.2)
        for x in range(slab):
            t = x / max(slab - 1, 1)
            c = int(46 + t * 36) if kind == "open-left" else int(82 - t * 36)
            px = x if kind == "open-left" else width - 1 - x
            d.line([(px, 18), (px, height - 18)], fill=(c, c + 2, c + 5, 255))
        return img
    for y in range(height):
        t = y / height
        c = int(64 + 14 * t + random.randint(-5, 5))
        d.line([(0, y), (width, y)], fill=(c, c + 2, c + 5, 255))
    d.rectangle((0, 0, width - 1, height - 1), outline=(28, 30, 34, 255), width=12)
    d.rectangle((16, 16, width - 17, height - 17), outline=(128, 132, 138, 160), width=3)
    for y in range(36, height - 24, 48):
        for x in (20, width - 30):
            d.ellipse((x, y, x + 11, y + 11), fill=(34, 36, 40, 255), outline=(158, 162, 168, 255))
    wx0, wy0, wx1, wy1 = int(width * 0.26), int(height * 0.1), int(width * 0.74), int(height * 0.3)
    d.rectangle((wx0, wy0, wx1, wy1), fill=(6, 8, 12, 255), outline=(24, 26, 30, 255), width=8)
    hx, hy = width - 52, int(height * 0.5)
    d.rounded_rectangle((hx, hy, hx + 24, hy + 74), radius=6, fill=(24, 26, 28, 255), outline=(168, 172, 176, 255), width=2)
    return img


steel(360, 980, "closed").save(os.path.join(OFFICE, "door-closed.png"))
steel(440, 980, "open-left").save(os.path.join(OFFICE, "door-open-left.png"))
steel(440, 980, "open-right").save(os.path.join(OFFICE, "door-open-right.png"))
print("ok")
