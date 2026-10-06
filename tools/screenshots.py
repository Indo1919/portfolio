#!/usr/bin/env python3
"""
Refresh the homepage images of the projects from the live builds in work/.

  python3 tools/screenshots.py            every project
  python3 tools/screenshots.py scowtt     one project

Each project's "shots" in assets/data/projects.json says what to capture:
  {"from_repo": "docs/screenshots/home.png", "out": "halo-home.jpg"}
      copy an image that lives in the project's GitHub repo
  {"page": "index.html", "out": "arriba-hero.jpg"}
      screenshot the page's first screen at 1440x900, 2x
  {"page": ..., "section": "product", "css": "...", "crop": [x, y, w, h], "out": ...}
      start the screenshot at the element with that id, add CSS for the capture only
      (hide a header, tighten padding), then crop (pixels at 2x)
  "wait": 5000
      milliseconds of page time before the capture, for animated pages
      (the same number always lands on the same moment)

Images land in assets/img/ as JPEG. Run tools/sync.py first so work/ is current.
Needs Google Chrome and sips (macOS). Look at the results before publishing.
"""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from chrome import ROOT, chrome, serve

REGISTRY = ROOT / "assets" / "data" / "projects.json"
IMG = ROOT / "assets" / "img"
WORK = ROOT / "work"


def capture_page(slug, shot, port, tmp):
    """Screenshot a temporary copy of the page (same folder, so relative paths work) without the portfolio bar."""
    page = WORK / slug / shot["page"]
    html = page.read_text(encoding="utf-8").replace('<script src="../../assets/js/return.js" defer></script>', "")
    extra = ""
    if shot.get("css"):
        extra += f"<style>{shot['css']}</style>"
    if shot.get("section"):
        # hide everything before the section so it starts at the top (scrolling doesn't capture reliably)
        extra += """<script>document.addEventListener('DOMContentLoaded',function(){var t=document.getElementById('%s');
          for(var n=t;n&&n!==document.body;n=n.parentElement){for(var p=n.previousElementSibling;p;p=p.previousElementSibling){
          if(!/^(SCRIPT|STYLE)$/.test(p.tagName))p.style.display='none';}}});</script>""" % shot["section"]
    temp = page.with_name(f".shot-{shot['out']}.html")
    temp.write_text(html.replace("</head>", extra + "</head>", 1), encoding="utf-8")
    out = Path(tmp) / (shot["out"] + ".png")
    try:
        chrome(["--window-size=1440,900", "--force-device-scale-factor=2", f"--virtual-time-budget={shot.get('wait', 7000)}",
                f"--screenshot={out}", f"http://127.0.0.1:{port}/work/{slug}/{temp.name}"], out=out)
    finally:
        temp.unlink(missing_ok=True)
    return out if out.exists() else None


def from_repo(repo, branch, rel, tmp):
    dest = Path(tmp) / "repo"
    if not dest.exists():
        subprocess.run(["git", "clone", "--depth", "1", "--branch", branch, "--quiet",
                        f"https://github.com/{repo}.git", str(dest)], check=True)
    src = dest / rel
    return src if src.exists() else None


def finish(png, shot):
    """Crop (optional), convert to JPEG and size for the web."""
    if shot.get("crop"):
        x, y, w, h = shot["crop"]
        subprocess.run(["sips", "-c", str(h), str(w), "--cropOffset", str(y), str(x), str(png),
                        "--out", str(png)], capture_output=True, check=True)
    out = IMG / shot["out"]
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", str(shot.get("max", 2000)),
                    str(png), "--out", str(out)], capture_output=True, check=True)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*")
    args = ap.parse_args()
    projects = json.loads(REGISTRY.read_text())["projects"]
    if args.slugs:
        projects = [p for p in projects if p["slug"] in args.slugs]
        if not projects:
            sys.exit("No such project in assets/data/projects.json")
    httpd, port = serve()
    try:
        for p in projects:
            with tempfile.TemporaryDirectory(prefix="portfolio-shots-") as tmp:
                for shot in p.get("shots", []):
                    if "from_repo" in shot:
                        src = from_repo(p["repo"], p.get("branch", "main"), shot["from_repo"], tmp)
                        png = Path(tmp) / (shot["out"] + ".png")
                        if src:
                            png.write_bytes(src.read_bytes())
                    else:
                        png = capture_page(p["slug"], shot, port, tmp)
                    if not png or not png.exists():
                        print(f"  ✗ {p['name']}: couldn't make {shot['out']}")
                        continue
                    out = finish(png, shot)
                    print(f"  ✓ {p['name']}: {out.relative_to(ROOT)}")
    finally:
        httpd.shutdown()
    print("Check the images before publishing: crops are fixed pixel boxes, so a redesigned page may need new numbers in projects.json.")


if __name__ == "__main__":
    main()
