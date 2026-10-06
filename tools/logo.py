"""
The "mi" mark — geometry and asset generator.

  mi = Matias Indacochea, and "my" in Spanish.

Construction (units, x-height = 64):
  - Stems sit on a 32-unit rhythm. The m's two shoulders are true semicircles
    (centerline radius 16), so the outer arch top lands exactly on the x-height.
  - The i stem is flat-topped at the x-height, the same height as the arches.
  - The dot is the only colour in the system: a gradient drawn from the four
    projects in the portfolio (Halo orange, Arriba Perú red, AI Native iOS
    violet, Scowtt blue).
  - Three optical sizes: Display (stroke 12) for large type, Text (stroke 14)
    as the default, and Small (stroke 18) for favicons and app icons, where a
    thin stroke would disappear.

Run:  python3 tools/logo.py   → writes assets/logo/*.svg
"""

from pathlib import Path

STOPS = [(0, "#FF7A1A"), (0.4, "#FF2E6A"), (0.72, "#A35BFF"), (1, "#2F7BFF")]
R = 16  # shoulder radius (centerline)

SIZES = {
    "display": dict(stroke=12, dot=8.5),
    "text": dict(stroke=14, dot=9.5),
    "small": dict(stroke=18, dot=12),
}


def gradient(gid):
    stops = "".join(f'<stop offset="{o:g}" stop-color="{c}"/>' for o, c in STOPS)
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient>'


def geometry(stroke, dot, gap=None):
    h = stroke / 2
    gap = stroke * 0.86 if gap is None else gap
    x1, x2, xi = h, h + 2 * R, h + 6 * R
    cy = R + h                      # arch centre, so outer top = 0
    dcy = -(gap + dot)              # dot centre
    left, right = 0, max(xi + h, xi + dot)
    top, bottom = dcy - dot, 64
    d = (
        f"M{x1:g} 64V{cy:g}a{R} {R} 0 0 1 {2*R} 0v{64-cy:g}"
        f"M{x2:g} {cy:g}a{R} {R} 0 0 1 {2*R} 0v{64-cy:g}"
        f"M{xi:g} 64V0"
    )
    return dict(d=d, xi=xi, dcy=dcy, box=(left, top, right - left, bottom - top))


def mark_svg(size="text", ink="currentColor", dot_fill=None, gid="mi-dot", pad=0, title="mi"):
    s = SIZES[size]
    g = geometry(s["stroke"], s["dot"])
    x, y, w, h = g["box"]
    vb = f"{x - pad:g} {y - pad:g} {w + 2*pad:g} {h + 2*pad:g}"
    fill = dot_fill or f"url(#{gid})"
    defs = "" if dot_fill else f"<defs>{gradient(gid)}</defs>"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">'
        f"{defs}"
        f'<path d="{g["d"]}" fill="none" stroke="{ink}" stroke-width="{s["stroke"]:g}"/>'
        f'<circle cx="{g["xi"]:g}" cy="{g["dcy"]:g}" r="{s["dot"]:g}" fill="{fill}"/>'
        f"</svg>"
    )


def icon_svg(size=512, light=False, rounded=True):
    """App icon / favicon: continuous-corner tile, Small optical size.
    rounded=False gives a full-bleed square for iOS, which applies its own mask."""
    s = SIZES["small"]
    g = geometry(s["stroke"], s["dot"])
    x, y, w, h = g["box"]
    # fit mark to 60% of tile width, optically centred (dot pulls the eye up)
    scale = (size * 0.6) / w
    tx = (size - w * scale) / 2 - x * scale
    ty = (size - h * scale) / 2 - y * scale + size * 0.02
    bg_top, bg_bot, ink = ("#FFFFFF", "#ECECEF", "#1D1D1F") if light else ("#2A2A2E", "#050505", "#FFFFFF")
    r = size * 0.225 if rounded else 0
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
        f"<defs>{gradient('mi-dot')}"
        f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg_top}"/>'
        f'<stop offset="1" stop-color="{bg_bot}"/></linearGradient></defs>'
        f'<rect width="{size}" height="{size}" rx="{r:g}" fill="url(#bg)"/>'
        f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">'
        f'<path d="{g["d"]}" fill="none" stroke="{ink}" stroke-width="{s["stroke"]:g}"/>'
        f'<circle cx="{g["xi"]:g}" cy="{g["dcy"]:g}" r="{s["dot"]:g}" fill="url(#mi-dot)"/></g></svg>'
    )


def main():
    out = Path(__file__).resolve().parent.parent / "assets" / "logo"
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "mi-mark.svg": mark_svg("text"),
        "mi-mark-display.svg": mark_svg("display"),
        "mi-mark-small.svg": mark_svg("small"),
        "mi-mark-white.svg": mark_svg("text", ink="#FFFFFF"),
        "mi-mark-black.svg": mark_svg("text", ink="#1D1D1F"),
        "mi-mark-mono-white.svg": mark_svg("text", ink="#FFFFFF", dot_fill="#FFFFFF"),
        "mi-mark-mono-black.svg": mark_svg("text", ink="#1D1D1F", dot_fill="#1D1D1F"),
        "mi-icon.svg": icon_svg(512),
        "mi-icon-light.svg": icon_svg(512, light=True),
        "mi-icon-fullbleed.svg": icon_svg(512, rounded=False),
    }
    for name, svg in files.items():
        (out / name).write_text(svg + "\n")
    print("wrote", ", ".join(files))


if __name__ == "__main__":
    main()
