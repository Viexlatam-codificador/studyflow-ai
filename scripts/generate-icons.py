#!/usr/bin/env python3
"""Generates StudyFlow AI app icons (gradient brand mark) with Pillow.
Run: python3 scripts/generate-icons.py
"""
from PIL import Image, ImageDraw
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "student-web", "public", "icons")
os.makedirs(OUT, exist_ok=True)

INDIGO = (79, 70, 229)
VIOLET = (124, 58, 237)


def gradient_bg(size, corner_radius_ratio=0.0):
    """Diagonal gradient from INDIGO (top-left) to VIOLET (bottom-right)."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(INDIGO[0] + (VIOLET[0] - INDIGO[0]) * t)
            g = int(INDIGO[1] + (VIOLET[1] - INDIGO[1]) * t)
            b = int(INDIGO[2] + (VIOLET[2] - INDIGO[2]) * t)
            px[x, y] = (r, g, b)
    if corner_radius_ratio > 0:
        mask = Image.new("L", (size, size), 0)
        mdraw = ImageDraw.Draw(mask)
        radius = int(size * corner_radius_ratio)
        mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        rgba = Image.new("RGBA", (size, size))
        rgba.paste(img, (0, 0), mask)
        return rgba
    return img


def draw_mark(img, size, scale=1.0):
    """Ascending rounded bars — abstract mark for flujo/avance/aprendizaje."""
    draw = ImageDraw.Draw(img, "RGBA")
    bar_w = size * 0.14 * scale
    gap = size * 0.08 * scale
    heights = [0.28, 0.44, 0.62]
    base_y = size * 0.66
    start_x = size * 0.5 - (bar_w * 3 + gap * 2) / 2
    for i, h_ratio in enumerate(heights):
        x0 = start_x + i * (bar_w + gap)
        x1 = x0 + bar_w
        h = size * h_ratio * scale
        y0 = base_y - h
        y1 = base_y
        radius = bar_w / 2
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=(255, 255, 255, 235))
    return img


def make_icon(size, filename, maskable=False, corner_radius_ratio=0.22):
    if maskable:
        # Maskable icons: keep the important content inside the inner ~80% safe zone.
        img = gradient_bg(size, corner_radius_ratio=0.0).convert("RGBA")
        draw_mark(img, size, scale=0.7)
    else:
        img = gradient_bg(size, corner_radius_ratio=corner_radius_ratio).convert("RGBA")
        draw_mark(img, size, scale=1.0)
    img.save(os.path.join(OUT, filename))
    print(f"wrote {filename} ({size}x{size})")


def make_apple_touch_icon(size, filename):
    # iOS ignores alpha/rounded corners on touch icons (it applies its own
    # mask), so this is a solid square — no transparency, no rounding.
    img = gradient_bg(size, corner_radius_ratio=0.0).convert("RGB")
    draw_mark(img, size, scale=1.0)
    img.save(os.path.join(OUT, filename))
    print(f"wrote {filename} ({size}x{size})")


make_icon(192, "icon-192.png")
make_icon(512, "icon-512.png")
make_icon(192, "icon-maskable-192.png", maskable=True)
make_icon(512, "icon-maskable-512.png", maskable=True)
make_apple_touch_icon(180, "apple-touch-icon.png")
make_icon(32, "favicon-32.png", corner_radius_ratio=0.28)

print("Done.")
