#!/usr/bin/env python3
"""
Add a project to the portfolio without missing a piece.

  python3 tools/new_project.py greenopia --name "Greenopia" --repo Indo1919/Greenopia --accent "#3ECF8E"

Options:
  --anchor greenopia     id of its homepage panel (default: the slug)
  --kind "Brand · 2026"  short category shown in the list (default: TODO)
  --branch main          repo branch (default: main)
  --include index.html   files to mirror (repeatable; default: index.html)
  --no-fetch             don't sync or screenshot yet (e.g. offline)

What it does:
  1. adds the project to assets/data/projects.json (the list, sync, screenshots and case-study bar read it)
  2. mirrors the repo into work/<slug>/ and takes its homepage screenshot
  3. adds its preview image, its row in "Four projects. Pick one." and its case-study panel to index.html,
     with TODO placeholders for every line of copy

tools/check.py fails while any TODO is left (and on counts like "Four projects"), so the new project can't go
live half-written. Write the copy from the project's own page, résumé or notes. Never invent facts.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "assets/data/projects.json"
INDEX = ROOT / "index.html"


def mix(hex_color, other, t):
    a = [int(hex_color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(other.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))


def insert_before(html, marker, block):
    if marker not in html:
        sys.exit(f"index.html is missing the marker {marker}. Put it back where CLAUDE.md says, then run again.")
    return html.replace(marker, block + marker, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug")
    ap.add_argument("--name", required=True)
    ap.add_argument("--repo", required=True, help="Owner/Repo on GitHub")
    ap.add_argument("--accent", default="#8F86FF")
    ap.add_argument("--anchor")
    ap.add_argument("--kind", default="TODO category")
    ap.add_argument("--branch", default="main")
    ap.add_argument("--include", action="append")
    ap.add_argument("--no-fetch", action="store_true")
    a = ap.parse_args()

    slug, name, anchor = a.slug.strip().lower(), a.name.strip(), (a.anchor or a.slug).strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        sys.exit("The slug can use lowercase letters, numbers and hyphens only.")
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", a.accent):
        sys.exit("--accent must look like #3ECF8E")
    reg = json.loads(REGISTRY.read_text())
    if any(p["slug"] == slug or p["anchor"] == anchor for p in reg["projects"]):
        sys.exit(f"{slug} (or #{anchor}) is already in projects.json.")
    html = INDEX.read_text(encoding="utf-8")
    if f'id="{anchor}"' in html:
        sys.exit(f'index.html already has id="{anchor}". Pick another --anchor.')

    # 1. registry
    hero = f"{slug}-hero.jpg"
    reg["projects"].append({
        "slug": slug, "name": name, "anchor": anchor, "accent": a.accent.upper(),
        "repo": a.repo, "branch": a.branch,
        "include": a.include or ["index.html"], "inject": ["index.html"],
        "shots": [{"page": "index.html", "out": hero}],
    })
    REGISTRY.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")
    print(f"✓ added {name} to assets/data/projects.json")

    # 2. mirror + screenshot
    if not a.no_fetch:
        r = subprocess.run([sys.executable, str(ROOT / "tools/sync.py"), slug])
        if r.returncode == 0:
            subprocess.run([sys.executable, str(ROOT / "tools/screenshots.py"), slug])

    # 3. homepage blocks
    n = len(reg["projects"])
    accent, ink, tint = a.accent.upper(), mix(a.accent, "#FFFFFF", .45), mix(a.accent, "#000000", .88)
    html = insert_before(html, "<!-- stage-images:end -->",
        f'<img src="assets/img/{hero}" alt="TODO describe the {name} screenshot" width="2000" height="1250" loading="lazy" decoding="async">\n            ')
    html = insert_before(html, "<!-- stage-list:end -->", f'''<li><a class="stage-item" href="#{anchor}" style="--c:{accent}" data-path="work/{slug}/" data-preview="work/{slug}/" data-preview-device="" data-kicker="TODO kicker · year">
            <span class="si-num">{n:02d}</span>
            <span class="si-thumb" aria-hidden="true"><img src="assets/img/{hero}" alt="" width="2000" height="1250" loading="lazy" decoding="async"></span>
            <span class="si-body"><span class="si-name">{name}</span><span class="si-kind">{a.kind}</span><span class="si-line">TODO one-line tagline</span></span>
            <svg class="si-go ic" aria-hidden="true"><use href="#i-arrow"/></svg>
            <span class="si-bar" aria-hidden="true"></span>
          </a></li>
          ''')
    html = insert_before(html, "<!-- projects:end -->", f'''<!-- {n:02d} {name} -->
  <article class="project" id="{anchor}" style="--accent:{accent};--accent-ink:{ink};--tint:{tint}">
    <div class="project-card" data-href="work/{slug}/">
      <div class="project-glow" aria-hidden="true"></div>
      <header class="project-head">
        <div class="project-titles reveal">
          <p class="project-kicker"><span class="num">{n:02d}</span>TODO kicker · year</p>
          <h3 class="project-title">{name}</h3>
          <p class="project-tagline">TODO tagline</p>
        </div>
        <div class="project-intro reveal">
          <p>TODO two or three sentences: what it is, who it's for, what you did.</p>
          <div class="project-cta">
            <a class="btn btn-light magnetic" href="work/{slug}/">View case study <svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></a>
            <button class="btn btn-glass magnetic" type="button" data-live="work/{slug}/" data-live-title="{name}">Try it live</button>
          </div>
        </div>
      </header>

      <div class="project-media">
        <div class="window">
          <div class="window-bar"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span><span class="window-url"><span>{name}</span></span></div>
          <img src="assets/img/{hero}" alt="TODO describe the {name} screenshot" width="2000" height="1250" loading="lazy" decoding="async">
        </div>
      </div>

      <dl class="gcr">
        <div class="gcr-card reveal"><dt><span class="dot" style="--d:#5E9BFF"></span>Goal</dt><dd>TODO goal</dd></div>
        <div class="gcr-card reveal"><dt><span class="dot" style="--d:#FF9F43"></span>Challenge</dt><dd>TODO challenge</dd></div>
        <div class="gcr-card reveal"><dt><span class="dot" style="--d:#3ECF8E"></span>Result</dt><dd>TODO result</dd></div>
      </dl>
      <dl class="meta">
        <div><dt>Role</dt><dd>TODO</dd></div>
        <div><dt>Timeline</dt><dd>TODO</dd></div>
        <div><dt>Team</dt><dd>TODO</dd></div>
        <div><dt>Tools</dt><dd>TODO</dd></div>
      </dl>
    </div>
  </article>

  ''')
    INDEX.write_text(html, encoding="utf-8")
    print(f"✓ added {name}'s preview image, list row and case-study panel to index.html")
    print(f"""
Next:
  1. Replace every TODO in index.html (search "TODO") with copy from the project's own page.
  2. Update counts like "Four projects" (tools/check.py lists them) and the share image in tools/og.html.
  3. python3 tools/check.py   → must pass before publishing
  4. python3 tools/review.py  → look at the new panel at every width""")


if __name__ == "__main__":
    main()
