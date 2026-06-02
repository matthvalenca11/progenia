#!/usr/bin/env python3
"""Gera ícones Android a partir do AppIcon do iOS (mesmo visual)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit(
        "Pillow não instalado. Rode: python3.9 -m pip install Pillow\n"
        "Ou use: npm run android:icons (já aponta para python3.9)."
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/1024.png"
RESOURCES = ROOT / "resources"
ANDROID_RES = ROOT / "android/app/src/main/res"

# Adaptive icon: área segura ~66% do canvas 108dp — logo menor evita corte na launcher.
ADAPTIVE_FILL = 0.58
# Ícones legados (fallback): podem usar um pouco mais de área.
LAUNCHER_FILL = 0.72

LAUNCHER_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

BG = (255, 255, 255, 255)


def fit_icon(source: Image.Image, canvas_size: int, fill: float, transparent: bool) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0) if transparent else BG)
    max_side = int(canvas_size * fill)
    icon = source.copy().convert("RGBA")
    icon.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (canvas_size - icon.width) // 2
    y = (canvas_size - icon.height) // 2
    canvas.paste(icon, (x, y), icon)
    if not transparent:
        return canvas.convert("RGB")
    return canvas


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode == "RGBA":
        img.save(path, "PNG")
    else:
        img.convert("RGB").save(path, "PNG")


def main() -> None:
    if not IOS_ICON.exists():
        raise SystemExit(f"Ícone iOS não encontrado: {IOS_ICON}")

    source = Image.open(IOS_ICON).convert("RGBA")

    RESOURCES.mkdir(exist_ok=True)
    save_png(fit_icon(source, 1024, ADAPTIVE_FILL, transparent=False), RESOURCES / "icon.png")

    for folder, size in LAUNCHER_SIZES.items():
        out = ANDROID_RES / folder
        icon = fit_icon(source, size, LAUNCHER_FILL, transparent=False)
        save_png(icon, out / "ic_launcher.png")
        save_png(icon, out / "ic_launcher_round.png")

    for folder, size in FOREGROUND_SIZES.items():
        out = ANDROID_RES / folder
        save_png(fit_icon(source, size, ADAPTIVE_FILL, transparent=True), out / "ic_launcher_foreground.png")

    bg_xml = ANDROID_RES / "values/ic_launcher_background.xml"
    bg_xml.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#FFFFFF</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    print("Ícones Android gerados a partir de", IOS_ICON)


if __name__ == "__main__":
    main()
