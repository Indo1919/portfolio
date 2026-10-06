# Matias Indacochea · Portfolio

Static site (HTML, CSS, vanilla JS, no build step) for Matias Indacochea, UI/UX and product designer.
Four case studies (Halo, Arriba Perú, AI Native iOS, Scowtt), each a working product that lives in
its own GitHub repo (github.com/Indo1919) and is mirrored into `work/<slug>/`.
Design bar: Apple-level polish, dark-first, floating centered pill nav.

## Start every session with

```bash
git pull                          # GitHub's sync bot commits to work/ on its own; get those first
python3 tools/sync.py --check     # projects behind GitHub, hand edits in work/, stale summaries, broken embed hooks
python3 tools/check.py            # links, images, anchors, registry, counts, TODOs, and a real-browser script test
```

Fix what they report before other work. **Run `tools/check.py` again before every commit**: GitHub runs it
too, and won't publish while it fails (the last good version stays live).

## Rules

1. **Never edit `work/<slug>/` by hand.** It is a mirror of the project repo. Change the project in its
   repo, then `python3 tools/sync.py`. The only local additions (portfolio bar script, old-portfolio
   links pointed home) are re-applied by sync automatically.
2. **No invented facts.** Every claim, number, quote and role on the site must come from the project
   pages in `work/`, the résumé (`assets/docs/Matias-Indacochea-Resume.pdf`), or Matias's notes in
   `~/Desktop/IID Senior S2/matias-archive/`. Never fabricate metrics, outcomes, research or quotes.
3. **Voice:** first person, plain-spoken, short sentences, no jargon, no em-dash flourishes. Lead with
   what the person gets. Match the copy already on the page.
4. **One registry.** `assets/data/projects.json` is the list of projects, in display order. The case-study
   bar, sync and screenshots all read it.
5. **Verify visually after any visual change** (see QA below). Don't call it done from the code alone.
6. **Keep the safety nets intact** (see "How it stays unbreakable"): new features go inside `feature()`,
   new live phones get a poster image, new projects go through `tools/new_project.py`.
7. Commit or push only when Matias asks.

## Map

| Path | What it is |
|---|---|
| `index.html` | The whole homepage. Sections in order: `#top` hero, `#projects` at-a-glance index, proof strip, `#work` case-study panels (`#halo`, `#arriba`, `#aiios`, `#scowtt`), `#process`, `#about`, `#experience`, `#contact`, footer, then the live-preview sheet and film dialogs |
| `assets/css/site.css` | Design tokens (`:root`), then components in page order, then breakpoints (1100, 900, 700) |
| `assets/js/site.js` | Nav (active section, sliding indicator, light/dark tone), showcase, scroll motion, live preview sheet, demos. Reads project data from `data-*` attributes in the markup, so content edits are HTML-only |
| `assets/js/return.js` | The bar injected into every case study: "Back to portfolio", prev/next, all-projects menu. Reads `projects.json` |
| `assets/data/projects.json` | Project registry: slug, name, anchor, accent, repo, files to mirror, pages to inject, screenshot recipes |
| `work/<slug>/` | Mirrored case studies. `work/sync.json` records commits, file fingerprints and review state |
| `brand/index.html` | Identity guidelines for the "mi" mark |
| `assets/logo/` | Mark, icons, favicons, lockups. SVGs come from `tools/logo.py` |
| `assets/img/` | Project screenshots (from `tools/screenshots.py`) and the share image |
| `tools/` | `check.py` (site check), `sync.py`, `new_project.py`, `screenshots.py`, `review.py`, `logo.py`, shared `chrome.py`, render templates |
| `.github/workflows/sync-and-publish.yml` | On GitHub: syncs projects every 30 min, runs `check.py`, publishes only the site files to Pages |
| Markers in `index.html` | `<!-- stage-images:end -->`, `<!-- stage-list:end -->`, `<!-- projects:end -->`: where `new_project.py` inserts. Keep them |

## Recipes

### Matias changed a project
```bash
python3 tools/sync.py                 # pulls it, reports which files changed
python3 tools/sync.py --check         # shows [review] if the homepage summary may be stale
```
For a `[review]` item: read the updated page in `work/<slug>/`, update that project's text in
`index.html` (its `.stage-item` in `#projects` and its `<article>` in `#work`), refresh images with
`python3 tools/screenshots.py <slug>`, look at the images, then `python3 tools/sync.py --mark-reviewed <slug>`.
Once the site is on GitHub, the workflow does the sync part on its own; the review part still needs you.

### Change the domain
1. DNS at the new registrar (records as above) and the new domain in this repo's Settings → Pages.
2. Set `"site"` in `assets/data/projects.json`, then run `python3 tools/check.py`: it lists every canonical link,
   `og:url`, `og:image` and JSON-LD `url` (in `index.html` and `brand/index.html`) still on the old address.

### Edit homepage copy
Edit `index.html` directly. Each project appears in two places: its row in the `#projects` list
(`.stage-item`: name, kind, tagline, `data-kicker`) and its panel in `#work` (`<article class="project">`).
The whole panel is clickable: `data-href` on `.project-card` is where it goes (keep it equal to the
"View case study" link). Clicks on links, buttons, the live phone or anything with `data-no-card` are ignored.

### Add a project
```bash
python3 tools/new_project.py <slug> --name "Name" --repo Indo1919/<Repo> --accent "#RRGGBB"
```
It adds the registry entry, mirrors the repo, takes the screenshot, and inserts the preview image, list row
and case-study panel into `index.html` with `TODO` placeholders. Then:
1. Replace every `TODO` with copy from the project's own page / résumé / notes (never invented).
2. Fix every count `check.py` lists ("Four projects", the meta description, the About mark text, `tools/og.html`),
   then re-render the share image.
3. Optional: a live phone (see Design system) or a richer media composition like the other four.
4. `python3 tools/check.py` must pass; `python3 tools/review.py` and look at every width.
The project list and stat counter adapt to any number of projects on their own.

### Remove or reorder a project
Change `projects.json`, then match `index.html` (both places) and delete `work/<slug>/` if removed.

### Change the logo
Edit measurements in `tools/logo.py`, run it (writes `assets/logo/*.svg`). The inline `<symbol id="mi">`
in `index.html`, `brand/index.html`, `404.html` and `return.js` repeat the same path; update them too.
PNGs (favicon, Apple touch icon, lockups, `assets/img/og-image.png`) are rendered from `tools/*.html`
with headless Chrome (see `tools/chrome.py`).

### Publish
Live at **https://matiasindacochea.com/** from repo `Indo1919/portfolio` (Pages source: GitHub Actions;
custom domain set in that repo's Settings → Pages, Enforce HTTPS on; no CNAME file needed with Actions).
- `Indo1919` is also Matias's school GitHub. Its other Pages sites (`manuscript`, and the original project
  sites at `indo1919.github.io/Halo/` etc.) stay on github.io on purpose. **Never** rename this repo back to
  `Indo1919.github.io` or give a repo with that name the custom domain: GitHub would move every Pages site on
  the account to matiasindacochea.com. The four projects reach the domain as the mirrors in `work/`.
- Domain registrar and DNS: GoDaddy (4 A + 4 AAAA records to GitHub Pages at `@`, `www` CNAME →
  `indo1919.github.io`, TXT `_github-pages-challenge-Indo1919` for the domain verification on his GitHub
  account). GoDaddy emails Matias a one-time code for every DNS save; only he can enter it.
- This Mac's command-line git has **no GitHub credentials**. Commit locally; Matias pushes with GitHub
  Desktop (the repo is added there). `git pull` works without credentials.
- Every push and every 30 minutes the workflow: syncs the four projects → runs `check.py` → commits any
  synced changes → publishes `index.html`, `404.html`, `brand/`, `work/`, `assets/` (not tools or notes).
  A red run means `check.py` failed: the old version stays live; read the log, fix, push again.
- For instant updates when a project changes, a project repo can send a `repository_dispatch` of type
  `project-updated` (needs a token with access to this repo). Otherwise it picks changes up within 30 min.

## QA

```bash
python3 -m http.server 4321                      # or the "portfolio" preview in .claude/launch.json
python3 tools/review.py                          # full-page shots at 1440/1280/1024/768/390 → .review/
python3 tools/review.py --widths 1440,390        # quicker
```
Read the images in `.review/` and check alignment (columns, card heights, line breaks, overlaps).
`?capture` on any page renders animations in their final state. Also check the browser console,
the phone menu, the live preview sheet, and a case study's bottom bar.

## How it stays unbreakable

What a visitor sees never depends on everything working:
- **Scripts:** every feature in `site.js` runs inside `feature("name", ...)`. One that throws is logged and
  skipped; the rest keep working. Features return early when their part of the page is missing. After
  start-up `html[data-portfolio]` is `ok`, or `errors` with `data-portfolio-errors="names"`; `check.py`
  reads that in real Chrome. New features follow the same pattern.
- **Hidden-until-animated content:** `.reveal` only hides once `html.js-reveal` is set by the running
  observer, and an inline script in `<head>` adds `is-ready` after 3s even if `site.js` never loads, so the
  hero and nav can't stay invisible.
- **Images:** the same inline script marks any image that fails to load `.is-missing`, which hides it
  cleanly (no broken icon). `check.py` fails on any missing file, so this should never reach the live site.
- **Live phones:** each keeps a poster image. If the page doesn't load or `data-crop` / `data-expect` isn't
  found, it stays a still image and the tap prompt hides. `sync.py --check` reports `[embed]` when a project
  update removes what an embed depends on (`embeds` in `projects.json`).
- **Case-study bar:** if `projects.json` can't load, "Back to portfolio" still works.
- **Publishing:** GitHub runs `check.py` before publishing; a failure keeps the last good version live.

## Design system

- Tokens in `site.css :root`: `--bg #000`, light sections `--l-bg #f5f5f7`, text `--text #f5f5f7`,
  `--text-2 #a1a1a6`, `--text-3 #6e6e73`, link `#2997ff` (dark) / `#0066cc` (light), radii 36/26/18/12,
  easing `--ease`. The gradient `--grad` (orange → pink → violet → blue) is the only accent; it comes from
  the four projects and is also the logo's dot.
- Type: system SF Pro with Inter fallback, tight tracking (-0.03 to -0.055em on display sizes).
- Sections set `data-tone="dark|light"`; the nav switches glass tone to match.
- Device frames: `.iphone` (Halo; status bar, Dynamic Island, tab bar kept via `.ios-tabbar`, sized in cqw) and
  `.device-frame.android` (Arriba; wraps a live iframe). Live embeds can get presentation-only CSS through
  `data-embed` keys in `EMBED_CSS` in `site.js` (Arriba's prototype hides its Android status bar under 560px;
  the `android-app` key brings it back inside the frame).
- Live phone cropped from a full page: `.device-live.crop-live` with `data-crop="<selector>"` (AI Native iOS uses
  `#heroMount .phone`). The page loads at `data-viewport` (1440x900), the script measures that element and scales
  the page so only it shows; `data-embed="lock-scroll"` stops the page behind it from scrolling. If the case
  study's hero is redesigned, check the selector still matches. Tap-to-use works the same as Arriba's.
- The project list (`.stage-list`) and the "case studies" stat (`data-count="projects"`) adapt to any
  number of projects; with five or more the list hides taglines to fit.
- Reusable pieces: `.btn` (`-light`, `-glass`, `-dark`, `-text`, `-sm`), `.chip`, `.eyebrow`,
  `.section-head`/`.section-title`/`.section-lead`, `.window` (+ `.window-bar`, `.lights`, `.window-url`),
  `.float-card`, `.seg`, `.gcr` (Goal/Challenge/Result), `.meta`, `.reveal` (fade-up on scroll).

## Gotchas

- Headless Chrome won't lay out windows narrower than about 500px and often doesn't exit on animated
  pages; `tools/chrome.py` handles both. Scroll-based captures come out blank, so screenshots start at a
  section by hiding what's above it.
- `sips -c H W --cropOffset 0 0` ignores zero offsets and crops from the center.
- `<use href="#mi">` inside an `<svg>`: the outer viewBox must be `0 0 112.5 95.04` (the symbol carries
  the real one), or the mark gets clipped.
- System Python is 3.9: no backslashes inside f-string expressions, no `match`.
- After changing `site.css` or `site.js`, bump the `?v=` on their links in `index.html` (and the CSS link in
  `brand/index.html`) so returning visitors don't get a cached copy.
- Edit CSS with exact string replacements, not broad regexes. A greedy regex once deleted the whole
  700px breakpoint block.

## Facts and open questions

- Email on the site: `matiasindacochea@outlook.com` (from the résumé). Project pages and older notes use
  `matiasindacochea2004@gmail.com`. Ask which to keep before changing either.
- Phone (from the résumé, shown in Contact): (425) 785-2519, `tel:+14257852519`.
- LinkedIn: linkedin.com/in/matias-indacochea-104a54250 (behind a login wall; use the archive's About text).
- "Based in New York" is assumed from the Parsons MPS (Aug 2026 – May 2027).
- No headshot yet; About is typographic until he sends one.
