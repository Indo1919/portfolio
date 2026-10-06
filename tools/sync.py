#!/usr/bin/env python3
"""
Keep the case studies in work/ identical to their GitHub repos.

  python3 tools/sync.py                  Pull every project that changed on GitHub, re-add the
                                         portfolio bar, and report what changed.
  python3 tools/sync.py halo scowtt      Only these projects.
  python3 tools/sync.py --check          Report only, change nothing. Exits 1 if anything needs attention.
  python3 tools/sync.py --force          Re-copy even if GitHub hasn't changed.
  python3 tools/sync.py --mark-reviewed [slug ...]
                                         Record that the homepage summary and screenshots have been
                                         checked against the current version of these projects.

The registry is assets/data/projects.json. State lives in work/sync.json:
  commit    the GitHub commit each copy came from
  files     a fingerprint of every copied file (after the portfolio bar is added)
  reviewed  the fingerprints the homepage was last checked against

What the report flags:
  behind     GitHub has newer commits. Run sync.
  edited     A file in work/ was changed by hand. It will be overwritten; edit the project repo instead.
  review     The project changed since the homepage summary/screenshots were checked.
             Update index.html and run tools/screenshots.py, then --mark-reviewed.
  homepage   The project is in the registry but missing from index.html (or the other way round).
  embed      A live phone on the homepage depends on something in the project page that's gone
             (see "embeds" in projects.json). The site shows a still image until it's fixed.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "assets" / "data" / "projects.json"
WORK = ROOT / "work"
STATE = WORK / "sync.json"
IMG = ROOT / "assets" / "img"
BAR_TAG = '<script src="../../assets/js/return.js" defer></script>'


# ---------------------------------------------------------------- helpers

def load_registry():
    return json.loads(REGISTRY.read_text())


def load_state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save_state(state):
    STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")


def sha(data):
    return hashlib.sha256(data).hexdigest()[:16]


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=180)


def remote_head(repo, branch):
    r = git("ls-remote", f"https://github.com/{repo}.git", f"refs/heads/{branch}")
    return r.stdout.split()[0] if r.returncode == 0 and r.stdout.strip() else None


def glob_to_regex(pattern):
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + r"\Z")


def select(src, patterns):
    rx = [glob_to_regex(p) for p in patterns]
    for path in sorted(src.rglob("*")):
        rel = path.relative_to(src).as_posix()
        if path.is_file() and not rel.startswith(".git/") and any(r.match(rel) for r in rx):
            yield rel


def add_bar(html):
    """Load the portfolio bar on a case-study page (once)."""
    if "assets/js/return.js" in html:
        return html
    i = html.rfind("</body>")
    return html[:i] + BAR_TAG + "\n" + html[i:] if i >= 0 else html + "\n" + BAR_TAG + "\n"


def point_legacy_links_home(html, hosts):
    """Links to the old portfolio site come back to this one, in the same tab."""
    for host in hosts:
        def fix(m):
            attrs = re.sub(r'\s(target="_blank"|rel="[^"]*")', "", m.group(1) + m.group(2))
            return f'<a{attrs} href="../../#projects">'
        html = re.sub(r'<a\b([^>]*?)\shref="https?://%s[^"]*"([^>]*)>' % re.escape(host), fix, html)
        html = html.replace(f">{host}<", ">More work by Matias<")
    return html


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg", "template"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "template") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(" ".join(data.split()))


def facts(html):
    """What the homepage summary depends on: the page title, its description and its words."""
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
    p = _Text()
    p.feed(html)
    return {
        "title": title.group(1).strip() if title else "",
        "description": desc.group(1) if desc else "",
        "text": sha(" ".join(p.parts).encode()),
    }


def fingerprint(slug):
    folder = WORK / slug
    return {f.relative_to(folder).as_posix(): sha(f.read_bytes())
            for f in sorted(folder.rglob("*")) if f.is_file()}


# ---------------------------------------------------------------- sync

def sync_project(p, state, force, legacy):
    slug, repo, branch = p["slug"], p["repo"], p.get("branch", "main")
    entry = state.get(slug, {})
    head = remote_head(repo, branch)
    if head is None:
        return f"{p['name']}: couldn't reach github.com/{repo}"
    intact = (WORK / slug).exists() and entry.get("files") == fingerprint(slug)
    if head == entry.get("commit") and intact and not force:
        return None  # nothing to do

    with tempfile.TemporaryDirectory(prefix="portfolio-sync-") as tmp:
        src = Path(tmp) / "repo"
        r = git("clone", "--depth", "1", "--branch", branch, "--quiet", f"https://github.com/{repo}.git", str(src))
        if r.returncode:
            return f"{p['name']}: clone failed: {r.stderr.strip()}"
        files = list(select(src, p["include"]))
        missing = [pat for pat in p["include"] if not any(glob_to_regex(pat).match(f) for f in files)]
        dest = WORK / slug
        if dest.exists():
            shutil.rmtree(dest)
        for rel in files:
            (dest / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src / rel, dest / rel)
        for rel in p.get("inject", []):
            page = dest / rel
            if page.exists():
                html = page.read_text(encoding="utf-8")
                page.write_text(add_bar(point_legacy_links_home(html, legacy)), encoding="utf-8")

    old_files = entry.get("files", {})
    new_files = fingerprint(slug)
    changed = sorted(f for f in new_files if old_files.get(f) != new_files[f])
    removed = sorted(set(old_files) - set(new_files))
    entry.update({
        "repo": repo,
        "commit": head,
        "synced_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "files": new_files,
        "facts": facts((dest / p.get("inject", ["index.html"])[0]).read_text(encoding="utf-8")),
    })
    if "reviewed" not in entry:  # first sync: the homepage was written against this version
        entry["reviewed"] = {"files": new_files, "facts": entry["facts"]}
    state[slug] = entry
    bits = []
    if changed:
        bits.append(f"{len(changed)} file(s) updated: " + ", ".join(changed[:6]) + (" …" if len(changed) > 6 else ""))
    if removed:
        bits.append(f"{len(removed)} removed")
    if missing:
        bits.append("patterns with no match in the repo: " + ", ".join(missing))
    return f"{p['name']}: synced to {head[:7]}" + (" (" + "; ".join(bits) + ")" if bits else " (no file changes)")


# ---------------------------------------------------------------- check

def check_project(p, state, index_html, offline=False):
    slug = p["slug"]
    entry = state.get(slug)
    issues = []
    if not entry or not (WORK / slug).exists():
        return [("behind", "not synced yet. Run python3 tools/sync.py")]
    if not offline:
        head = remote_head(p["repo"], p.get("branch", "main"))
        if head is None:
            issues.append(("offline", f"couldn't reach github.com/{p['repo']}"))
        elif head != entry.get("commit"):
            issues.append(("behind", f"GitHub has newer commits ({entry.get('commit', '')[:7]} → {head[:7]}). Run python3 tools/sync.py"))
    now = fingerprint(slug)
    edited = sorted(f for f in set(now) | set(entry.get("files", {})) if now.get(f) != entry.get("files", {}).get(f))
    if edited:
        issues.append(("edited", "changed by hand in work/ (will be overwritten on sync; edit the project repo instead): " + ", ".join(edited[:5])))
    for rel in p.get("inject", []):
        page = WORK / slug / rel
        if page.exists() and "assets/js/return.js" not in page.read_text(encoding="utf-8"):
            issues.append(("edited", f"{rel} is missing the portfolio bar. Run python3 tools/sync.py --force {slug}"))
    reviewed = entry.get("reviewed", {})
    if reviewed.get("files") != entry.get("files"):
        f_now, f_then = entry.get("facts", {}), reviewed.get("facts", {})
        what = []
        if f_now.get("title") != f_then.get("title"):
            what.append(f'title is now "{f_now.get("title")}"')
        if f_now.get("description") != f_then.get("description"):
            what.append(f'description is now "{f_now.get("description")}"')
        if f_now.get("text") != f_then.get("text"):
            what.append("page text changed")
        if not what:
            what.append("design or code changed, words didn't")
        issues.append(("review", "changed since the homepage was checked: " + "; ".join(what) +
                       f". Update its summary in index.html (#{p['anchor']}), run python3 tools/screenshots.py {slug}, then python3 tools/sync.py --mark-reviewed {slug}"))
    for emb in p.get("embeds", []):
        page = WORK / slug / emb["page"]
        html = page.read_text(encoding="utf-8") if page.exists() else ""
        gone = [n for n in emb["needs"] if n not in html]
        if gone:
            issues.append(("embed", f"{emb['what']}: {emb['page']} no longer contains " + ", ".join(gone) +
                           ". The homepage falls back to a still image. Update the hook in index.html / site.js (see CLAUDE.md)."))
        if emb.get("homepage") and emb["homepage"] not in index_html:
            issues.append(("embed", f"{emb['what']}: index.html is missing {emb['homepage']}"))
    if f'id="{p["anchor"]}"' not in index_html:
        issues.append(("homepage", f'no case-study panel with id="{p["anchor"]}" in index.html'))
    if f'data-path="work/{slug}/"' not in index_html:
        issues.append(("homepage", f"not in the at-a-glance list in index.html (data-path=\"work/{slug}/\")"))
    for shot in p.get("shots", []):
        if not (IMG / shot["out"]).exists():
            issues.append(("homepage", f"missing screenshot assets/img/{shot['out']}. Run python3 tools/screenshots.py {slug}"))
    return issues


def report(lines):
    text = "\n".join(lines)
    print(text)
    if os.environ.get("GITHUB_ACTIONS"):  # surface anything that needs a person in the Actions UI
        for line in lines:
            if line.strip().startswith(("[review]", "[homepage]", "[edited]", "[embed]")):
                print("::warning title=Portfolio::" + line.strip())
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as fh:
            fh.write("## Project sync\n\n```\n" + text + "\n```\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--mark-reviewed", action="store_true")
    ap.add_argument("--offline", action="store_true", help="with --check: skip asking GitHub")
    args = ap.parse_args()

    reg = load_registry()
    projects = reg["projects"]
    if args.slugs:
        unknown = set(args.slugs) - {p["slug"] for p in projects}
        if unknown:
            sys.exit("Not in assets/data/projects.json: " + ", ".join(sorted(unknown)))
        projects = [p for p in projects if p["slug"] in args.slugs]
    state = load_state()

    if args.mark_reviewed:
        for p in projects:
            e = state.get(p["slug"])
            if e:
                e["reviewed"] = {"files": e["files"], "facts": e["facts"]}
                print(f"{p['name']}: marked reviewed at {e['commit'][:7]}")
        save_state(state)
        return

    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    lines = []
    if not args.check:
        for p in projects:
            msg = sync_project(p, state, args.force, reg.get("legacy_links", []))
            if msg:
                lines.append(msg)
        save_state(state)
        if not lines:
            lines.append("Everything already matches GitHub.")
        lines.append("")

    attention = False
    for p in projects:
        issues = check_project(p, state, index_html, offline=args.offline or not args.check)
        if issues:
            attention = attention or any(k != "offline" for k, _ in issues)
            lines.append(f"✗ {p['name']}")
            lines += [f"    [{kind}] {msg}" for kind, msg in issues]
        else:
            commit = state.get(p["slug"], {}).get("commit", "")[:7]
            lines.append(f"✓ {p['name']}: in sync ({commit}), homepage reviewed")
    # projects on the homepage that aren't in the registry
    for slug in sorted(set(re.findall(r'data-path="work/([^/"]+)/"', index_html)) - {p["slug"] for p in reg["projects"]}):
        attention = True
        lines.append(f"✗ work/{slug}/ is on the homepage but not in assets/data/projects.json")
    report(lines)
    if args.check and attention:
        sys.exit(1)


if __name__ == "__main__":
    main()
