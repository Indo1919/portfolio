#!/usr/bin/env python3
"""
Layout review: full-page screenshots of a page at standard breakpoints.

  python3 tools/review.py                 # homepage at every width
  python3 tools/review.py brand/          # another page
  python3 tools/review.py --widths 1440,390

Writes .review/<page>-<width>-<part>.png (gitignored), in viewport-sized parts so each
image can be inspected at close to full resolution. Uses ?capture, which renders every
animation in its final state and hides the nav after the first part.
Needs Google Chrome (macOS).
"""

import argparse
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

from chrome import ROOT, chrome, serve

OUT = ROOT / ".review"
WIDTHS = [1440, 1280, 1024, 768, 390]
MIN_WINDOW = 500  # headless Chrome won't lay out narrower windows; those render inside a frame


def framed(url, width, height, port):
    return f"http://127.0.0.1:{port}/tools/review-frame.html?w={width}&h={height}&src={quote(url, safe='')}"


def page_height(url, width, port):
    if width < MIN_WINDOW:
        url, width = framed(url, width, 1200, port), MIN_WINDOW
    dom = chrome([f"--window-size={width},1200", "--virtual-time-budget=5000", "--dump-dom", url], timeout=20) or ""
    m = re.search(r'data-capture-height="(\d+)"', dom)
    return int(m.group(1)) if m else 6000


def shoot(url, width, height, name, part, offset, port):
    out = OUT / f"{name}-{width}-{part:02d}.png"
    out.unlink(missing_ok=True)
    sep = "&" if "?" in url else "?"
    target, win = f"{url}{sep}from={offset}", width
    if width < MIN_WINDOW:
        target, win = framed(target, width, height, port), MIN_WINDOW
    chrome([f"--window-size={win},{height}", "--force-device-scale-factor=1",
            "--virtual-time-budget=5000", f"--screenshot={out}", target], out=out)
    if out.exists() and win != width:  # the frame is centered; sips crops from the center
        subprocess.run(["sips", "-c", str(height), str(width), str(out)], capture_output=True)
    return out if out.exists() else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page", nargs="?", default="")
    ap.add_argument("--widths", default=",".join(map(str, WIDTHS)))
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    httpd, port = serve()
    name = args.page.strip("/").replace("/", "-") or "home"
    url = f"http://127.0.0.1:{port}/{args.page}?capture"
    jobs = []
    for w in map(int, args.widths.split(",")):
        chunk = 2000 if w < 700 else 1600
        total = page_height(url, w, port)
        parts = range(0, total, chunk)
        print(f"{w}px wide: page is {total}px tall, {len(parts)} parts")
        jobs += [(url, w, chunk, name, i + 1, off, port) for i, off in enumerate(parts)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        done = [p for p in pool.map(lambda j: shoot(*j), jobs) if p]
    httpd.shutdown()
    print(f"wrote {len(done)} of {len(jobs)} screenshots to {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
