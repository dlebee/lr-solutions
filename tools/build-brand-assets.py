#!/usr/bin/env python3
"""Build every downloadable logo variant for the brand kit (site/brand/downloads/).

For each logo (stacked, horizontal, icon) and background (transparent-dark, transparent-light,
white, blue, navy) it writes SVG, PDF, PNG (two sizes) and, for solid backgrounds, JPG.
Also writes web/app icons and a zip of everything.

Requires: rsvg-convert (brew install librsvg) and macOS `sips` for JPG.
Run from the repo root:  python3 tools/build-brand-assets.py
"""
import os, re, shutil, subprocess, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "site/assets/img")
OUT = os.path.join(ROOT, "site/brand/downloads")
KIT = os.path.join(OUT, "kit")

BLUE, NAVY, SKY, WHITE = "#1D4ED8", "#0B1B3F", "#93C5FD", "#FFFFFF"

def read(name):
    return open(os.path.join(IMG, name)).read()

def parts(svg):
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    body = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", svg, flags=re.S)
    return float(vb.group(1)), float(vb.group(2)), body

icon_glyph = read("mark-mono.svg")
SOURCES = {
    # logo -> (artwork for light backgrounds, artwork for dark backgrounds)
    "stacked": (read("logo-stacked.svg"), read("logo-stacked-white.svg")),
    "horizontal": (read("logo.svg"), read("logo-white.svg")),
    "icon": (icon_glyph.replace("currentColor", BLUE), icon_glyph.replace("currentColor", WHITE)),
}
# background -> (fill or None for transparent, which artwork, icon colour override)
BACKGROUNDS = {
    "transparent-dark": (None, 0, NAVY),    # dark logo, no background: for light surfaces
    "transparent-light": (None, 1, WHITE),  # white logo, no background: for dark surfaces / photos
    "white": (WHITE, 0, BLUE),
    "blue": (BLUE, 1, WHITE),
    "navy": (NAVY, 1, SKY),
}
PNG_SIZES = {"stacked": (800, 3000), "horizontal": (1200, 3600), "icon": (512, 2048)}

def make_svg(logo, bg):
    fill, which, icon_color = BACKGROUNDS[bg]
    src = SOURCES[logo][which]
    if logo == "icon":
        src = icon_glyph.replace("currentColor", icon_color)
    w, h, body = parts(src)
    pad = 0.0 if fill is None else 0.2 * max(w, h) if logo != "horizontal" else 0.12 * w
    if logo == "icon" and fill is not None:
        pad = 0.0  # the glyph already sits centred in a square with breathing room
    W, H = w + 2 * pad, h + 2 * pad
    rect = f'<rect width="{W:.2f}" height="{H:.2f}" fill="{fill}"/>' if fill else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" role="img" '
            f'aria-label="L&amp;R Solutions">{rect}<g transform="translate({pad:.2f} {pad:.2f})">{body}</g></svg>\n')

def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(KIT)
    tmp = tempfile.mkdtemp()
    count = 0
    for logo in SOURCES:
        for bg, (fill, _, _) in BACKGROUNDS.items():
            base = os.path.join(KIT, f"lr-solutions-{logo}-{bg}")
            open(base + ".svg", "w").write(make_svg(logo, bg))
            run("rsvg-convert", "-f", "pdf", base + ".svg", "-o", base + ".pdf")
            small, large = PNG_SIZES[logo]
            for size in (small, large):
                run("rsvg-convert", "-w", str(size), base + ".svg", "-o", f"{base}-{size}px.png")
            count += 4
            if fill:
                run("sips", "-s", "format", "jpeg", "-s", "formatOptions", "92",
                    f"{base}-{large}px.png", "--out", base + ".jpg")
                count += 1

    icons = os.path.join(OUT, "icons")
    os.makedirs(icons)
    run("rsvg-convert", "-w", "180", os.path.join(IMG, "mark.svg"), "-o", os.path.join(icons, "apple-touch-icon.png"))
    run("rsvg-convert", "-w", "512", os.path.join(IMG, "mark.svg"), "-o", os.path.join(icons, "app-icon-512.png"))
    run("rsvg-convert", "-w", "1024", os.path.join(IMG, "mark-blue.svg"), "-o", os.path.join(icons, "social-avatar-1024.png"))
    pngs = []
    for s in (16, 32, 48):
        p = os.path.join(tmp, f"fav-{s}.png")
        run("rsvg-convert", "-w", str(s), os.path.join(IMG, "mark.svg"), "-o", p)
        pngs.append((s, open(p, "rb").read()))
    import struct
    head = struct.pack("<HHH", 0, 1, len(pngs)); off = 6 + 16 * len(pngs); ent = b""
    for s, d in pngs:
        ent += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(d), off); off += len(d)
    open(os.path.join(icons, "favicon.ico"), "wb").write(head + ent + b"".join(d for _, d in pngs))
    for f in ("favicon.ico", "apple-touch-icon.png"):
        shutil.copy(os.path.join(icons, f), os.path.join(ROOT, "site", f))
    shutil.copy(os.path.join(IMG, "mark.svg"), os.path.join(icons, "app-icon.svg"))

    with zipfile.ZipFile(os.path.join(OUT, "lr-solutions-brand-assets.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for folder in ("kit", "icons"):
            for f in sorted(os.listdir(os.path.join(OUT, folder))):
                z.write(os.path.join(OUT, folder, f), f"lr-solutions-brand-assets/{folder}/{f}")
    shutil.rmtree(tmp)
    print(f"built {count} logo files + icons + zip in {os.path.relpath(OUT, ROOT)}")

if __name__ == "__main__":
    main()
