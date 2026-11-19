#!/usr/bin/env python3
"""Builds the pictures in docs/swarm/ART.md from screenshots.

    npm run shots -- look-primitives --scale 2 --out .context/art
    npm run shots -- look-island     --scale 2 --out .context/art
    npm run shots -- look-swatches   --scale 2 --out .context/art --size 1600x900
    npm run shots -- look-dodont     --scale 2 --out .context/art --size 1600x700
    python3 docs/swarm/art/make-images.py

Needs Pillow. Every output is a JPEG under 300 kB.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SHOTS = os.path.join(ROOT, ".context", "art")
SPIKE = os.path.join(ROOT, "spike", "primitives", "shots")
OUT = os.path.dirname(os.path.abspath(__file__))
INK = (58, 47, 42)
PAPER = (242, 237, 227)


def font(size):
    for path in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def shot(name):
    return Image.open(os.path.join(SHOTS, name + ".png")).convert("RGB")


def save(im, name, quality=84):
    path = os.path.join(OUT, name)
    q = quality
    while True:
        im.save(path, quality=q, optimize=True)
        if os.path.getsize(path) < 295_000 or q <= 50:
            break
        q -= 6
    print(f"{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(path) // 1024} kB (q{q})")


def fit(im, width):
    return im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)


def label(draw, xy, text, size=18, anchor="la", fill=INK, bg=PAPER):
    f = font(size)
    box = draw.textbbox(xy, text, font=f, anchor=anchor)
    draw.rounded_rectangle((box[0] - 6, box[1] - 3, box[2] + 6, box[3] + 3), radius=8, fill=bg, outline=fill)
    draw.text(xy, text, font=f, anchor=anchor, fill=fill)


class Camera:
    """The same projection as src/render/camera.ts (CSS pixels of a w x h view)."""

    def __init__(self, yaw, pitch, zoom, target, w, h):
        y, p = math.radians(yaw), math.radians(pitch)
        cp, sp, cy, sy = math.cos(p), math.sin(p), math.cos(y), math.sin(y)
        self.right = (cy, 0, -sy)
        self.up = (-sp * sy, cp, -sp * cy)
        self.target = (target[0], target[1] * 0.8, target[2])
        self.half_h = 24 / zoom
        self.half_w = self.half_h * w / h
        self.w, self.h = w, h
        self.px = h * zoom / 48

    def project(self, p):
        d = [p[i] - self.target[i] for i in range(3)]
        dot = lambda a, b: sum(x * y for x, y in zip(a, b))
        return ((dot(d, self.right) / self.half_w + 1) / 2 * self.w, (1 - dot(d, self.up) / self.half_h) / 2 * self.h)


def hero():
    save(fit(shot("look-primitives-hero"), 1100), "hero.jpg")


def spike_vs_engine():
    a = fit(Image.open(os.path.join(SPIKE, "r2-02-joinery-closeup.png")).convert("RGB"), 800)
    b = fit(shot("look-primitives-joinery"), 800)
    h = min(a.size[1], b.size[1])
    out = Image.new("RGB", (1610, h), PAPER)
    out.paste(a.crop((0, 0, 800, h)), (0, 0))
    out.paste(b.crop((0, 0, 800, h)), (810, 0))
    d = ImageDraw.Draw(out)
    label(d, (14, 12), "the spike (throwaway mockup, ~2,100 draw calls)")
    label(d, (824, 12), "the engine (MeshBuilder fixtures, 10 draw calls)")
    save(out, "spike-vs-engine.jpg")


def proportions():
    im = shot("look-primitives-house")
    s = im.size[0] / 1280
    cam = Camera(35, 28, 13, (16.4, 1.7, 20.6), 1280, 800)
    d = ImageDraw.Draw(im)
    f = font(round(15 * s))
    red = (190, 55, 45)

    def dim(a, b, text, side):
        """A measured line from a to b (world points) with its label pushed to one side (dx, dy in CSS px)."""
        pa, pb = cam.project(a), cam.project(b)
        d.line((pa[0] * s, pa[1] * s, pb[0] * s, pb[1] * s), fill=red, width=round(3 * s))
        for p in (pa, pb):
            d.ellipse((p[0] * s - 4 * s, p[1] * s - 4 * s, p[0] * s + 4 * s, p[1] * s + 4 * s), fill=red)
        mid = (((pa[0] + pb[0]) / 2 + side[0]) * s, ((pa[1] + pb[1]) / 2 + side[1]) * s)
        anchor = ("l" if side[0] > 0 else "r" if side[0] < 0 else "m") + ("m" if side[0] else ("b" if side[1] < 0 else "t"))
        box = d.textbbox(mid, text, font=f, anchor=anchor)
        d.rounded_rectangle((box[0] - 6 * s, box[1] - 4 * s, box[2] + 6 * s, box[3] + 4 * s), radius=7 * s, fill=PAPER, outline=red)
        d.text(mid, text, font=f, anchor=anchor, fill=(140, 40, 34))

    y0, H = 0.8, 0.8
    # The yellow house stands in cell (16, 20): x 16..17, z 20..21, on ground at y = 0.8.
    dim((16.93, y0, 20.93), (16.93, y0 + H, 20.93), "storey 0.8", (14, 10))
    dim((16, y0, 21), (17, y0, 21), "cell 1.0 (walls stand 0.07 inside it)", (0, 34))
    dim((16.5, y0 + H, 21.0), (16.5, y0 + H + 0.47, 21.0), "roof rise 0.45 to 0.5", (-16, -6))
    dim((16.93, y0 + H, 21.0), (17.05, y0 + H, 21.0), "eave 0.12", (16, -14))
    dim((16.19, y0 + 0.05, 20.96), (16.19, y0 + 0.5, 20.96), "door 0.28 x 0.45", (-14, 0))
    dim((16.58, y0 + 0.3, 20.96), (16.8, y0 + 0.3, 20.96), "window 0.22 x 0.31", (0, 30))
    save(fit(im, 1200), "proportions.jpg")


def patterns():
    im = shot("look-swatches-all")
    s = im.size[0] / 1600
    cam = Camera(30, 36, 3.1, (25.2, 1.5, 21.4), 1600, 900)
    names = ["none", "grass", "shingles", "earth", "stone", "paving", "planks", "glass", "marble", "sand", "rock", "water", "plaster", "brick", "cobbles", "thatch",
             "timber", "leaves", "bark", "stripes", "crops", "cloth", "metal", "dirt", "foam", "glow", "planksAcross"]
    ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
    cols, cell, pad = 9, 176, 30
    rows = math.ceil(len(names) / cols)
    out = Image.new("RGB", (cols * cell, rows * (cell + pad)), PAPER)
    d = ImageDraw.Draw(out)
    half = cam.px * 1.2
    for i, name in enumerate(names):
        col, row = i % cols, i // cols
        x, z = 13 + col * 2.5, 19 + (rows - 1 - row) * 2.5
        cx, cy = cam.project((x + 0.75, 0.8 + 0.55, z + 0.75))
        box = tuple(round(v * s) for v in (cx - half, cy - half, cx + half, cy + half))
        tile = im.crop(box).resize((cell, cell), Image.LANCZOS)
        out.paste(tile, (col * cell, row * (cell + pad)))
        d.text((col * cell + cell / 2, row * (cell + pad) + cell + pad / 2 - 1), f"{ids[i]}  {name}", font=font(16), anchor="mm", fill=INK)
    save(out, "patterns.jpg", 88)


def do_dont():
    names = ["1 ink groups", "2 fine detail", "3 palette", "4 hand", "5 real edges", "6 light (at night)"]
    day, night = shot("look-dodont-day"), shot("look-dodont-night")
    s = day.size[0] / 1600
    cam = Camera(22, 36, 4.2, (22.9, 1.4, 23.6), 1600, 700)
    cw, ch = 260, 190
    out = Image.new("RGB", (len(names) * cw, ch * 2 + 34), PAPER)
    d = ImageDraw.Draw(out)
    hw, hh = cam.px * 1.72, cam.px * 1.72 * ch / cw
    for i, name in enumerate(names):
        src = night if i == 5 else day
        for k, z in enumerate((26, 21)):
            cx, cy = cam.project((14 + i * 3.4, 0.8 + 0.45, z))
            box = tuple(round(v * s) for v in (cx - hw, cy - hh, cx + hw, cy + hh))
            out.paste(src.crop(box).resize((cw, ch), Image.LANCZOS), (i * cw, 34 + k * ch))
            tag, colour = ("do", (60, 120, 70)) if k == 0 else ("don't", (180, 60, 50))
            label(d, (i * cw + 10, 34 + k * ch + 8), tag, 17, fill=colour)
        d.text((i * cw + cw / 2, 17), name, font=font(18), anchor="mm", fill=INK)
    save(out, "do-dont.jpg", 88)


def times():
    names = [("look-primitives-hero", "day"), ("look-primitives-dusk", "dusk"), ("look-primitives-night", "night"), ("look-primitives-dawn", "dawn")]
    w = 640
    tiles = [fit(shot(n), w) for n, _ in names]
    h = tiles[0].size[1]
    out = Image.new("RGB", (w * 2 + 8, h * 2 + 8), PAPER)
    d = ImageDraw.Draw(out)
    for i, (tile, (_, text)) in enumerate(zip(tiles, names)):
        x, y = (i % 2) * (w + 8), (i // 2) * (h + 8)
        out.paste(tile, (x, y))
        label(d, (x + 12, y + 10), text)
    save(out, "times.jpg", 80)


def night_close():
    save(fit(shot("look-primitives-night-close"), 1000), "night-close.jpg", 82)


def terrain():
    a, b = fit(shot("look-island-hill"), 800), fit(shot("look-island-sw"), 800)
    out = Image.new("RGB", (1608, a.size[1]), PAPER)
    out.paste(a, (0, 0))
    out.paste(b, (808, 0))
    save(out, "terrain.jpg", 80)


def quarters():
    names = ["hero", "hero-se", "hero-nw", "hero-ne"]
    w = 560
    tiles = [fit(shot("look-primitives-" + n), w) for n in names]
    h = tiles[0].size[1]
    out = Image.new("RGB", (w * 4 + 18, h), PAPER)
    for i, tile in enumerate(tiles):
        out.paste(tile, (i * (w + 6), 0))
    save(out, "quarters.jpg", 78)


if __name__ == "__main__":
    only = sys.argv[1:]
    for fn in (hero, spike_vs_engine, proportions, patterns, do_dont, times, night_close, terrain, quarters):
        if not only or fn.__name__ in only:
            fn()
