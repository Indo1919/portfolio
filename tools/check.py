#!/usr/bin/env python3
"""
Site check: catches what would break the portfolio before it goes live.

  python3 tools/check.py            everything (the script test needs Chrome; skipped if it isn't installed)
  python3 tools/check.py --static   skip the browser test

  links      every local link, image, video and data-* path in the site's pages points at a real file
  anchors    every #link (on the page, or into another of the site's pages) has a matching id; no duplicate ids
  icons      every <use href="#..."> has its <symbol>
  registry   assets/data/projects.json is valid; each project has its list row, panel, case study and images,
             in the same order on the homepage as in the registry
  counts     words like "Four projects" match how many projects there are
  todo       no TODO placeholders left (tools/new_project.py leaves them on purpose)
  versions   every page loads site.css / site.js with the same ?v=
  css        braces balance in site.css
  scripts    (Chrome) every homepage feature starts without errors; every case study shows the portfolio bar

Exit 1 if anything fails, so CI won't publish a broken site. Warnings don't fail.
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chrome import CHROME, ROOT, chrome, serve  # noqa: E402

PAGES = ["index.html", "brand/index.html", "404.html"]
REF_ATTRS = {"href", "src", "poster", "data-src", "data-live", "data-path", "data-preview", "data-href",
             "data-film", "data-poster"}
SKIP_PREFIX = ("http:", "https:", "mailto:", "tel:", "data:", "javascript:", "//", "about:")
WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"}

errors, warnings = [], []


def fail(area, msg):
    errors.append(f"[{area}] {msg}")


def warn(area, msg):
    warnings.append(f"[{area}] {msg}")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.ids, self.uses, self.symbols = [], [], [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        if "id" in a:
            self.ids.append((a["id"], line))
            if tag == "symbol":
                self.symbols.add(a["id"])
        for k, v in a.items():
            if v is None:
                continue
            if tag == "use" and k in ("href", "xlink:href"):
                self.uses.append((v, line))
            elif k in REF_ATTRS:
                self.refs.append((k, v.strip(), line))
        if tag == "meta" and a.get("property") == "og:image" and a.get("content"):
            self.refs.append(("content", a["content"], line))

    handle_startendtag = handle_starttag


_parsed = {}


def parse(path):
    if path not in _parsed:
        p = Page()
        p.feed(path.read_text(encoding="utf-8"))
        _parsed[path] = p
    return _parsed[path]


def resolve(page, ref):
    """Turn a reference on a page into (file path, fragment), or None for external links."""
    if not ref or ref.startswith(SKIP_PREFIX):
        return None
    path, _, frag = ref.partition("#")
    path = path.split("?")[0]
    if not path:
        return page, frag
    base = ROOT if path.startswith("/") else page.parent
    target = (base / unquote(path.lstrip("/"))).resolve()
    if target.is_dir() or ref.split("#")[0].split("?")[0].endswith("/"):
        target = target / "index.html"
    return target, frag


# ---------------------------------------------------------------- static checks

def check_pages():
    for rel in PAGES:
        page = ROOT / rel
        if not page.exists():
            fail("links", f"{rel} is missing")
            continue
        doc = parse(page)
        seen = {}
        for i, line in doc.ids:
            if i in seen:
                fail("anchors", f"{rel}:{line} duplicate id \"{i}\" (also line {seen[i]})")
            seen.setdefault(i, line)
        for href, line in doc.uses:
            if href.startswith("#") and href[1:] not in doc.symbols:
                fail("icons", f"{rel}:{line} <use href=\"{href}\"> has no matching <symbol>")
        for attr, ref, line in doc.refs:
            r = resolve(page, ref)
            if not r:
                continue
            target, frag = r
            if not target.exists():
                fail("links", f"{rel}:{line} {attr}=\"{ref}\" points at a file that doesn't exist")
                continue
            if frag and target.suffix == ".html" and not frag.startswith(("/", "!")):
                ids = {i for i, _ in parse(target).ids}
                if frag not in ids:
                    mirrored = "work" in target.relative_to(ROOT).parts
                    (warn if mirrored else fail)("anchors", f"{rel}:{line} {attr}=\"{ref}\": no id=\"{frag}\" in {target.relative_to(ROOT)}")


def check_registry():
    reg_path = ROOT / "assets/data/projects.json"
    try:
        reg = json.loads(reg_path.read_text())
    except Exception as e:  # noqa: BLE001
        fail("registry", f"assets/data/projects.json isn't valid JSON: {e}")
        return []
    projects = reg.get("projects", [])
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    need = ("slug", "name", "anchor", "accent", "repo", "include", "inject")
    slugs = set()
    for p in projects:
        missing = [k for k in need if not p.get(k)]
        if missing:
            fail("registry", f"{p.get('slug', '?')}: missing {', '.join(missing)} in projects.json")
            continue
        s = p["slug"]
        if s in slugs:
            fail("registry", f"{s} is listed twice in projects.json")
        slugs.add(s)
        if f'id="{p["anchor"]}"' not in index:
            fail("registry", f"{p['name']}: no case-study panel with id=\"{p['anchor']}\" in index.html")
        if f'data-path="work/{s}/"' not in index:
            fail("registry", f"{p['name']}: no row in the at-a-glance list (data-path=\"work/{s}/\")")
        if f'data-href="work/{s}/"' not in index:
            warn("registry", f"{p['name']}: its panel isn't clickable as a whole (data-href=\"work/{s}/\")")
        page = ROOT / "work" / s / p["inject"][0]
        if not page.exists():
            fail("registry", f"{p['name']}: work/{s}/{p['inject'][0]} is missing. Run python3 tools/sync.py {s}")
        for shot in p.get("shots", []):
            if not (ROOT / "assets/img" / shot["out"]).exists():
                fail("registry", f"{p['name']}: assets/img/{shot['out']} is missing. Run python3 tools/screenshots.py {s}")
    # order on the homepage follows the registry
    listed = re.findall(r'data-path="work/([^/"]+)/"', index)
    if [s for s in listed if s in slugs] != [p["slug"] for p in projects if p["slug"] in listed]:
        warn("registry", "the at-a-glance list isn't in the same order as projects.json")
    for s in sorted(set(listed) - slugs):
        fail("registry", f"work/{s}/ is on the homepage but not in projects.json")
    panels = len(re.findall(r'<article class="project"', index))
    if panels != len(projects):
        fail("registry", f"{panels} case-study panels on the homepage but {len(projects)} projects in projects.json")
    return projects


def check_text(projects):
    n = len(projects)
    files = ["index.html", "tools/og.html"]
    for rel in files:
        text = (ROOT / rel).read_text(encoding="utf-8")
        for m in re.finditer(r"\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(projects|case studies|working products)\b", text, re.I):
            num = [k for k, w in WORDS.items() if w == m.group(1).lower()][0]
            if num != n:
                line = text[:m.start()].count("\n") + 1
                fail("counts", f"{rel}:{line} says \"{m.group(0)}\" but there are {n} projects")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for i, line in enumerate(index.splitlines(), 1):
        if "TODO" in line:
            fail("todo", f"index.html:{i} still has a TODO placeholder")
    versions = {}
    for rel in PAGES:
        for m in re.finditer(r"site\.(css|js)\?v=([\w.-]+)", (ROOT / rel).read_text(encoding="utf-8")):
            versions.setdefault(m.group(1), set()).add(m.group(2))
    for kind, vs in versions.items():
        if len(vs) > 1:
            warn("versions", f"pages load site.{kind} with different ?v= ({', '.join(sorted(vs))})")
    css = (ROOT / "assets/css/site.css").read_text()
    if css.count("{") != css.count("}"):
        fail("css", f"site.css has {css.count('{')} '{{' but {css.count('}')} '}}'")


# ---------------------------------------------------------------- browser check

def check_scripts(projects):
    if not CHROME:
        warn("scripts", "Chrome isn't installed, so the script test was skipped")
        return
    from concurrent.futures import ThreadPoolExecutor
    httpd, port = serve()

    def dump(path, budget):
        return chrome(["--window-size=1440,900", f"--virtual-time-budget={budget}", "--dump-dom",
                       f"http://127.0.0.1:{port}/{path}"], timeout=15) or ""
    try:
        jobs = [("?capture", 6000)] + [(f"work/{p['slug']}/{p['inject'][0]}", 4000) for p in projects]
        with ThreadPoolExecutor(max_workers=5) as pool:
            doms = list(pool.map(lambda j: dump(*j), jobs))
    finally:
        httpd.shutdown()
    m = re.search(r"<html[^>]*>", doms[0])
    tag = m.group(0) if m else ""
    if 'data-portfolio="errors"' in tag:
        names = re.search(r'data-portfolio-errors="([^"]*)"', tag)
        fail("scripts", f"homepage features failed to start: {names.group(1) if names else '?'} (see the browser console)")
    elif 'data-portfolio="ok"' not in tag:
        fail("scripts", "site.js didn't finish on the homepage (a syntax error, or it didn't load)")
    for p, dom in zip(projects, doms[1:]):
        if "data-portfolio-bar" not in dom:
            fail("scripts", f"{p['name']}: the portfolio bar didn't appear on work/{p['slug']}/{p['inject'][0]}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--static", action="store_true", help="skip the browser test")
    args = ap.parse_args()
    check_pages()
    projects = check_registry()
    check_text(projects)
    if not args.static:
        check_scripts(projects)
    for w in warnings:
        print("!", w)
    for e in errors:
        print("✗", e)
    if errors:
        print(f"\n{len(errors)} problem(s). Fix them before publishing.")
        sys.exit(1)
    print(f"✓ Site check passed ({len(projects)} projects{', ' + str(len(warnings)) + ' warning(s)' if warnings else ''}).")


if __name__ == "__main__":
    main()
