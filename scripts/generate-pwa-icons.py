#!/usr/bin/env python3
"""Rasterize Red Square 4 app icons for PWA / iOS home screen."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"

SKY = (92, 148, 252, 255)
INK = (26, 8, 8, 255)
BODY = (255, 61, 66, 255)
SHADE = (196, 28, 40, 255)
GLOSS = (255, 154, 160, 255)
EYE = (255, 255, 255, 255)
PUPIL = (20, 8, 8, 255)
BOOT = (42, 24, 20, 255)


def rounded(draw: ImageDraw.ImageDraw, xy: tuple[float, float, float, float], radius: float, fill: tuple[int, int, int, int]) -> None:
    draw.rounded_rectangle(xy, radius=max(1, radius), fill=fill)


def paint_hero(draw: ImageDraw.ImageDraw, origin_x: float, origin_y: float, size: float) -> None:
    s = size / 48.0

    def x(v: float) -> float:
        return origin_x + v * s

    def y(v: float) -> float:
        return origin_y + v * s

    def box(l: float, t: float, w: float, h: float) -> tuple[float, float, float, float]:
        return (x(l), y(t), x(l + w), y(t + h))

    rounded(draw, box(7, 39, 13, 8), 3 * s, BOOT)
    rounded(draw, box(28, 39, 13, 8), 3 * s, BOOT)
    rounded(draw, box(1, 1, 46, 40), 8 * s, INK)
    rounded(draw, box(5, 5, 38, 32), 5 * s, BODY)
    rounded(draw, box(5, 24, 38, 13), 5 * s, SHADE)
    rounded(draw, box(7, 6, 11, 5), 2.5 * s, GLOSS)

    def eye(cx: float, cy: float) -> None:
        ow, oh = 16 * s, 18 * s
        ew, eh = 14 * s, 16 * s
        draw.ellipse((x(cx) - ow / 2, y(cy) - oh / 2, x(cx) + ow / 2, y(cy) + oh / 2), fill=INK)
        draw.ellipse((x(cx) - ew / 2, y(cy) - eh / 2, x(cx) + ew / 2, y(cy) + eh / 2), fill=EYE)
        pw, ph = ew * 0.52, eh * 0.58
        px, py = x(cx) + 1.6 * s, y(cy) + 0.4 * s
        draw.ellipse((px - pw / 2, py - ph / 2, px + pw / 2, py + ph / 2), fill=PUPIL)
        spark = 2.2 * s
        draw.ellipse(
            (px - 2.2 * s - spark, py - 2.6 * s - spark, px - 2.2 * s + spark, py - 2.6 * s + spark),
            fill=EYE,
        )
        rounded(draw, (x(cx) - 6 * s, y(cy) - eh * 0.62 - 1 * s, x(cx) + 6 * s, y(cy) - eh * 0.62 + 1 * s), s, INK)

    eye(16, 19)
    eye(32, 19)
    draw.arc((x(24) - 6 * s, y(32) - 7 * s, x(24) + 6 * s, y(32) + 5 * s), start=20, end=160, fill=INK, width=max(2, int(3 * s)))


def make_icon(size: int, *, maskable: bool = False) -> Image.Image:
    image = Image.new("RGBA", (size, size), SKY)
    draw = ImageDraw.Draw(image)
    pad = 0.22 if maskable else 0.12
    hero = size * (1 - pad * 2)
    paint_hero(draw, size * pad, size * pad * 0.7, hero)
    return image


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    specs: list[tuple[str, int, bool]] = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in specs:
        make_icon(size, maskable=maskable).save(ICONS / name, "PNG")
    apple = make_icon(180)
    apple.save(PUBLIC / "apple-touch-icon.png", "PNG")
    make_icon(32).save(PUBLIC / "favicon.png", "PNG")
    print("wrote", ICONS)


if __name__ == "__main__":
    main()
