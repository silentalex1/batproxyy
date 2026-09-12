from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
TEACHERS = os.path.join(ASSETS, "teachers")
OFFICE = os.path.join(ASSETS, "office")
UI = os.path.join(ASSETS, "ui")
os.makedirs(OFFICE, exist_ok=True)
os.makedirs(TEACHERS, exist_ok=True)

lineup = Image.open(os.path.join(TEACHERS, "lineup.jpg")).convert("RGB")
w, h = lineup.size
col = w // 4
names = ["history-body.png", "math-body.png", "gym-body.png", "staff-body.png"]
for i, name in enumerate(names):
    inset = 6
    crop = lineup.crop((i * col + inset, 0, (i + 1) * col - inset, h))
    crop.save(os.path.join(TEACHERS, name), quality=94)

bg = Image.open(os.path.join(UI, "backgroundimagefnaf.png")).convert("RGB")
bg.save(os.path.join(OFFICE, "detention.png"))

moon = Image.new("RGBA", (900, 700), (0, 0, 0, 0))
md = ImageDraw.Draw(moon)
for r, a in ((420, 28), (300, 46), (190, 70), (110, 110), (50, 160)):
    md.ellipse((450 - r, 280 - r, 450 + r, 280 + r), fill=(186, 214, 255, a))
moon = moon.filter(ImageFilter.GaussianBlur(18))
moon.save(os.path.join(OFFICE, "moonlight.png"))


def steel_door(width, height, open_left=False, open_right=False, closed=True):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if open_left or open_right:
        for y in range(height):
            shade = 6 + int(10 * (y / height))
            d.line([(0, y), (width, y)], fill=(shade, shade + 1, shade + 2, 255))
        frame = 22
        d.rectangle((0, 0, width, height), outline=(48, 50, 54, 255), width=frame)
        slab_w = int(width * 0.22)
        if open_left:
            for x in range(slab_w):
                t = x / max(slab_w - 1, 1)
                c = int(58 + t * 40)
                d.line([(x, frame), (x, height - frame)], fill=(c, c + 2, c + 4, 255))
        if open_right:
            for x in range(slab_w):
                t = x / max(slab_w - 1, 1)
                c = int(98 - t * 40)
                px = width - 1 - x
                d.line([(px, frame), (px, height - frame)], fill=(c, c + 2, c + 4, 255))
        return img

    for y in range(height):
        t = y / height
        c = int(72 + 18 * t + random.randint(-6, 6))
        d.line([(0, y), (width, y)], fill=(c, c + 3, c + 6, 255))
    d.rectangle((0, 0, width - 1, height - 1), outline=(36, 38, 42, 255), width=10)
    d.rectangle((14, 14, width - 15, height - 15), outline=(120, 124, 130, 180), width=3)
    for y in range(30, height - 20, 46):
        for x in (18, width - 26):
            d.ellipse((x, y, x + 10, y + 10), fill=(40, 42, 46, 255), outline=(150, 154, 160, 255))
    wx0, wy0, wx1, wy1 = int(width * 0.28), int(height * 0.12), int(width * 0.72), int(height * 0.32)
    d.rectangle((wx0, wy0, wx1, wy1), fill=(8, 10, 14, 255), outline=(28, 30, 34, 255), width=8)
    d.rectangle((wx0 + 10, wy0 + 10, wx1 - 10, wy1 - 10), fill=(12, 16, 22, 255))
    d.line(((wx0 + wx1) // 2, wy0 + 8, (wx0 + wx1) // 2, wy1 - 8), fill=(30, 32, 36, 255), width=3)
    hx, hy = width - 48, int(height * 0.52)
    d.rounded_rectangle((hx, hy, hx + 22, hy + 70), radius=6, fill=(28, 30, 32, 255), outline=(160, 164, 168, 255), width=2)
    d.ellipse((hx + 4, hy + 8, hx + 18, hy + 22), fill=(90, 94, 98, 255))
    return img


steel_door(340, 900, closed=True).save(os.path.join(OFFICE, "door-closed.png"))
steel_door(420, 900, open_left=True, closed=False).save(os.path.join(OFFICE, "door-open-left.png"))
steel_door(420, 900, open_right=True, closed=False).save(os.path.join(OFFICE, "door-open-right.png"))

noise = Image.new("RGB", (256, 256))
nd = ImageDraw.Draw(noise)
for y in range(256):
    for x in range(256):
        v = random.randint(0, 255)
        nd.point((x, y), fill=(v, v, v))
noise.save(os.path.join(OFFICE, "noise.png"))

look = Image.open(os.path.join(TEACHERS, "math-portrait.png")).convert("RGB")
look = ImageEnhance.Contrast(look).enhance(1.18)
look = ImageEnhance.Color(look).enhance(0.72)
look.save(os.path.join(TEACHERS, "math-look.png"))

print("assets ready")
