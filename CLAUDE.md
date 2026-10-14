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
3. **Voice:** written for recruiters and hiring managers at companies of any size, corporate included.
   First person, confident and concrete: lead with ownership ("I designed", "I led"), show curiosity and a
   current, cutting-edge approach, and back every claim with a fact. Short sentences, no jargon, no generic
   adjectives, no em-dash flourishes. Labels say "Resume" (no accents). Match the copy already on the page.
4. **One registry.** `assets/data/projects.json` is the list of projects, in display order. The case-study
   bar, sync and screenshots all read it.
5. **Verify visually after any visual change** (see QA below). Don't call it done from the code alone.
6. **Keep the safety nets intact** (see "How it stays unbreakable"): new features go inside `feature()`,
   new live phones get a poster image, new projects go through `tools/new_project.py`.
7. Commit or push only when Matias asks.

## Map

| Path | What it is |
|---|---|
| `index.html` | The whole homepage. Sections in order: `#top` hero, `#projects` at-a-glance index, proof strip, `#work` case-study panels (`#halo`, `#arriba`, `#aiios`, `#scowtt`), `#process` (How I work, `#how-i-work`, then the numbers), `#about`, `#experience`, `#contact`, footer, then the live-preview sheet and film dialogs |
| `assets/css/site.css` | Design tokens (`:root`), then components in page order, then breakpoints (1100, 900, 700) |
| `assets/js/site.js` | Nav (active section, sliding indicator, light/dark tone), showcase, scroll motion, live preview sheet, demos. Reads project data from `data-*` attributes in the markup, so content edits are HTML-only |
| `assets/js/analytics.js` | Google Analytics 4: the measurement ID and every custom event (see Analytics below) |
| `assets/js/return.js` | The bar injected into every case study: "Back to portfolio", prev/next, all-projects menu. Reads `projects.json` |
| `assets/data/projects.json` | Project registry: slug, name, anchor, accent, repo, files to mirror, pages to inject, screenshot recipes, and `page` when a project's folder opens on its app rather than its case study (Halo: `case-study.html`; the case-study bar and the homepage links use it) |
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
`--only <file>` renders one image. Images are only ever scaled down (upscaling blurs): for more detail, give the shot
a `"scale"` (default 2) and a crop at that scale.
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

Each project is a **scene** (`article.project.scene`), about one screen tall (Jibril's feedback, 2026-10-13: the old
panels were information overload; then a study of how NN/g, Apple, Stripe and Linear guide the eye):
- `.scene-visual`: the product only, with the project's color glowing behind it (the one focal point). Sides
  alternate down the page (even scenes flip) so the eye zig-zags visual → words → next visual.
  Halo's visual is Halo's own 36-second explainer (`[data-explainer]`, feature "film": `work/halo/film/halo-explainer-loop.mp4`,
  muted, looping while on screen, with a pause button), and six steps under it (Reads, Writes, Sizes, Waits, Answers,
  Plans) that follow its chapters and jump on click. Matias asked for it (2026-10-13): it's the best showcase of
  what Halo does. The `data-t` chapter starts come from `CH` in the Halo repo's `src/js/screens/explainer.js`; if the
  explainer is re-cut, update them and the callout times.
- **Callouts** (`.co-layer > .co`, feature "callouts"): a detail drawing (Matias's ask: industrial-design callout,
  liquid glass). A thin accent frame marks the exact element, a hairline runs to a dark glass card with that element
  magnified in an inset loupe and a numbered caption.
  - **What they point at** (Matias, 2026-10-14: "not the most important thing"): each callout is one core idea of the
    product, as its case study names it, on the small detail that proves it. The caption says why it matters to the
    user, not what the film already narrates. Halo (the case study's "Four ideas you can see on screen"): the Redacted chip
    ("Private topics stay out"), the trust dial ("You decide what it shares"), "Drafted by Halo from this meeting"
    ("The ticket writes itself"). Arriba Perú (its home screen): "S/ 100 owed to you" ("Flags unpaid wages"), "What is
    fair pay? · Audio version" ("Rights, read out loud"). Scowtt (the rebuilt console): the first booked meeting ("The AI
    books the meeting"), "Invalid leads removed 38" ("Reps only see real leads"). Fewer is better: an idea the film
    already shows plainly (altitude, colleagues asking) gets no callout, and none goes where its card would cover content.
  - **The loupe** (Matias: too zoomed in, no breathing room, text too small): the element at a steady zoom (`data-z`,
    default 2, kept 1.6–2.6) with a margin of the real screen around it, gently dimmed with a feathered edge so the element
    is the one thing in focus. The card sizes itself (under half the frame, at most 360px). Aim for loupe text of at least
    ~11px at 1440: Scowtt's screenshot is drawn small, so its callouts ask for `data-z` 2.3–2.6; keep frames compact
    (about a quarter of the target's width at most) or the zoom can't fit.
  - **Placement**: `data-r="x0 y0 x1 y1"` is the element as fractions of the target (whole words or whole chips, never
    half a line), `data-at="x y"` the card's centre in the same units. Outside 0–1 puts the card beside the product, and
    it then shrinks to the free space on that side (measured from the whole `.window` or phone), so it never covers it.
    Arriba's cards sit left of the phone; Scowtt's sit above its windows (there is no room below).
  - Halo's follow the film (`data-from`/`data-to` seconds: each holds 3–4s on an element that stays put the whole time)
    and are drawn from the film itself into a canvas: never add a second `<video>` of the same file (two decoders froze
    the main one in testing). Element positions come from the explainer's own timeline (`src/js/screens/explainer.js` in
    the Halo repo: seek it in the app and measure in canvas units, 1080x608, which are the film's fractions).
    The others take turns while their scene is on screen. An image callout shows the poster (or a sharper `data-hd` copy:
    `arriba-phone-hd.jpg`, a 4x render), so a live phone must open on the same screen as its poster: Arriba's iframe loads
    `prototype.html?start=home` and its posters are rendered from that page in a 390x844 frame (`"frame"` shots in
    `tools/screenshots.py`). A live phone that animates on its own gets none (AI Native iOS); they stop once someone uses
    a phone, and phones under 700px show none. Captions: 2–5 words, facts from the case study.
  - QA: `?capture&film-t=19.8` holds the film; `?capture&co=2` shows a scene's second callout; headless Chrome can't
    decode video, so check film callouts in the browser preview. Check 1440, 1024 and the pane's own width: no card over
    its frame or the product, loupe text readable.
- `.scene-copy`: kicker, title, tagline, `.scene-meta` (role · result, lead with the outcome), then six tabs
  (feature "scenes"), the case-study pillars Jibril and Matias asked for, each a picture first and a sentence at most:
  **Problem** (`.seg-lead` with one `<mark>`, a highlighter on the words to read first, framed as what the system
  gets wrong; then Why), **Research** (`.pv-stats` numbers, method chips, `.pv-find` the one finding), **People**
  (who it's for and what they need), **Market** (what exists and where this one stands: `.pv-rows`, `.pv-vs`,
  `.pv-compare2`), **Options** (what I tried and what won: `.pv-modes`, `.pv-pairs`, `.pv-matrix`, `.pv-logos`; the
  chosen one is `.is-this`) and **Learned** (the learning, Where I struggled, What I'd do differently). One part
  shows at a time; without the script they stack; on phones and tablets (stacked) each part takes its own height. Two buttons max.
  Plain words over jargon; cut before you add. Fills behind white text use `--accent-solid` (4.5:1 for every color).
- Color has a job (60-30-10): a neutral canvas; each scene is its project's color world (`--accent`, `--tint`):
  the glow, the active tab, the mark, the bullets; the brand gradient only marks entry points (eyebrows, hero
  "AI-fluent.", the logo dot, "what's next.") and the numbers each take the color of the project they prove.
- After the four scenes: Samantha Ly's LinkedIn recommendation (`.testimonial`), quoted word for word, linked to
  his LinkedIn recommendations. Her full text is on his LinkedIn (June 17, 2026); don't paraphrase it.
- GA: opening a part sends `project_segment` (project, section = problem | research | people | market | options | learned).

### Edit "How I work" (`#how-i-work`, the Process section)
Six moves on a ring (Listen, Frame, Build, Stress-test, Decide, Ship) and one route per tab: "My approach"
first (Matias as a designer, `data-kind="approach"`), then one per project with every real step and loop back.
Everything is markup in `index.html`; `site.js` ("how-i-work") draws it and walks the visitor through it once the
card is on screen: the dot glides to a move (`TRAVEL`, 0.8s), the step fades in (title and one line, details half a
second later) and stays long enough to read (1.7–3s, +0.5s with details): about 3.8s a step, ~27s for My approach.
A route ends on its summary; the "Up next" button fills for `NEXT` (3.6s), then the next route starts, cycling
through all routes forever. It plays continuously: no hold under the mouse (Matias asked), Back/Next/step clicks keep
it playing, a move's card holds it only while open. It waits only when the card is off screen or the tab is hidden,
and Pause is the one control that stops it (keep it: moving content needs a pause control). Progress bar, Back/Next
and step clicks let people jump. Hovering a move shows its principle. Matias found 1.7s/~8s per step boring,
~1.3s overwhelming, and ~4.7s a little slow: stay near 3.8s. One idea at a time, no counters.
- A step: `<button class="hiw-step" data-move="…">` with `.hiw-step-label` (short, in the strip and as the panel
  title), `.hiw-step-text` (what I did), and optional `.hiw-step-turn` ("Went back", "Reframed", "Rejected"…:
  the step travels the dashed loop-back orbit), `.hiw-step-why` ("Why: …"), `.hiw-step-ai` ("AI: …", only where
  AI really helped), `.hiw-step-me` ("Me: …"), `.hiw-step-out` ("Output: a · b · c"; add `data-eng` when it's
  handed to engineers, which shows "Ready for engineers").
- The storyline is "I lead, AI follows" (Matias's ask; no toggle). On the map my route is the bright leading line and
  AI's is a dotted line one lane out that trails it by `LAG` (0.45s), drawn only into steps with a `.hiw-step-ai`;
  when it arrives it pings the move (ripple and an "AI" tag). Every step card shows both rows, Me first, AI a beat
  later: Me is `.hiw-step-me` or the move's me line; AI is `.hiw-step-ai`, else "No AI on this step" ("Never AI.
  This call is mine." on Decide). A step never borrows its move's AI line. Each route's summary rows come from
  `data-lead` and `data-follow` on its `<section>`; routes with no AI steps show `data-follow` muted.
- A move's card: `.hiw-moves > article[data-move][data-ai]` (lead, body, AI line, me line). `data-ai="false"` only on
  Decide. AI sources so far: Claude for synthesis, GPT-5 for copy, Cursor for AI-assisted code, ChatGPT and AI
  critique in AI Native iOS v1, Claude live in Halo, scripts for deliverables (archive 10, case studies).
- "Beyond UI/UX" tiles (`.hiw-xs`) sit under the card: each capability needs its proof line.
- Rules (`check.py` enforces): six moves, each with a card; every step names a real move; a move never follows
  itself; every route loops back at least once (the note under the card claims it); each route's tab names a
  project in `projects.json` unless it's the approach route.
- Facts only, as everywhere: each step must trace to that case study, its repo README, the resume or the archive.
  Sources used so far: the four case studies and READMEs, archive files 01 (Halo), 02 (Arriba Perú), 03 (Greenopia),
  04 (Jetzy, for the scoping tile), 09 (resume), 10 (tools, testing models the day they ship).
- QA: `?capture&hiw-step=5` shows step 5 of the first route; `?capture` alone shows its end summary.
  The browser preview caches the page: add a throwaway param (`&nc=2`) after changing files.
  Headless screenshots of a scrolled page come out black: check timing with `--dump-dom` and look at it in the
  browser preview with `?capture&from=<card top>`.
- Layout: the ring and the panel sit side by side when the card is 1000px+ wide, stacked below that. Maps under
  720px wide (`compact` in JS) run the routes inside the ring with labels outside; wider maps orbit outside.

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

## Analytics

Google Analytics 4, property "Matias Portfolio" (measurement ID `G-CXQW1Q5LL0`, web stream URL
https://matiasindacochea.com; the old myportfolio.com site still reports into it until it's retired, so filter
by hostname if needed). `assets/js/analytics.js` is the only place with the ID. Every page loads it, and
`return.js` loads it on every case study; `check.py` fails if one stops.
- **Accuracy:** it skips iframes (the live phones and preview sheet), local hosts (so `check.py` and previews never
  report), and Matias's own browsers: https://matiasindacochea.com/?no-analytics once per browser
  (`?analytics` undoes it). `?ga-debug` sends to Admin > DebugView; the active "Developer traffic" filter keeps
  those hits out of reports.
- **Events:** `resume_download`, `contact_click` (method), `case_study_open`, `project_jump`, `project_preview`,
  `live_preview_open`, `prototype_tap`, `film_play`, `section_view` (section), `portfolio_bar_click` (action,
  destination), `process_explore` (action: project, step, move, replay, next, back, next_route, restart; project; move) and
  `process_complete` (project; watched a whole route play) and `project_segment` (project, section: one of the six scene parts). Parameters `project`, `link_location`, `method`,
  `section`, `action`, `destination` are registered custom dimensions; `move` still needs one (Admin > Custom
  definitions) once How I work is live. A new parameter needs a new custom dimension.
- **GA settings already made:** key events `resume_download` and `contact_click` (once per session, no value);
  event data retention 14 months; enhanced measurement keeps page loads, scrolls, outbound clicks, file
  downloads and site search, with history-based page views and form interactions turned off (the homepage's
  #anchors would otherwise count as extra page views).
- Test changes locally the way they were built: fetch `analytics.js` in the preview, strip the local-host return
  and the Google library line, eval it, click things, and read `window.dataLayer`. Nothing is sent that way.

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
  `--text-2 #a1a1a6`, `--text-3 #6e6e73`, radii 36/26/18/12, easing `--ease`.
- **Brand color: one signature violet** (Matias chose it, 2026-10-13, so the brand is recognizable). `--b1..--b4`
  are its four tints, light to deep: Mist `#CECBF7`, Lilac `#AEA6F0`, Violet `#8F81E5` (the signature), Deep `#705DC8`.
  `--grad` blends them. Links are violet too (`--link #B7B2F2` on dark, `--link-light #5C4AAC` on light). Violet
  never appears in a project, so it stays apart from the four project colors (Halo orange, Arriba red, AI Native iOS
  blue, Scowtt taupe). AI's color in How I work is silver (`--ai`, `--ai-deep`) so AI never reads as the brand.
  Color always has a job: violet marks entry points (eyebrows, "AI-fluent.", "what's next.", the logo dot,
  capability icons, my line in How I work); each project scene is its own color world; each number wears the
  color of the project it proves. To change the brand, edit `STOPS` in `tools/logo.py`, the `--b*` tokens, and
  re-render the PNGs (icons, lockups, `assets/img/og-image.png`) from `tools/icons.html`, `lockup.html`, `og.html`.
- Breathing room over density: one idea per section, no paragraph where a sentence works, and cut before adding.
  Step cards in How I work show title, line, why and Me/AI; outputs wait for the route's summary (last six).
- Type: system SF Pro with Inter fallback, tight tracking (-0.03 to -0.055em on display sizes).
- Type details: headings use `text-wrap: balance`, body copy `pretty`, and the `widows` feature in `site.js` keeps the
  last two words of leads and card copy together. `optical-titles` pulls each project title left by its first letter's
  side space so "Halo" lines up with its kicker like the others. Project heads are top-aligned so every card starts
  at the same height. Use `&#8209;` (non-breaking hyphen) where a hyphenated word must not split ("co-designed").
- Sections set `data-tone="dark|light"`; the nav switches glass tone to match.
- Device frames: `.iphone` (Halo; status bar, Dynamic Island, tab bar kept via `.ios-tabbar`, sized in cqw) and
  `.device-frame.android` (Arriba; wraps a live iframe). Live embeds can get presentation-only CSS through
  `data-embed` keys in `EMBED_CSS` in `site.js` (Arriba's prototype hides its Android status bar under 560px;
  the `android-app` key brings it back inside the frame).
- Live phone cropped from a full page: `.device-live.crop-live` with `data-crop="<selector>"` (AI Native iOS uses
  `#heroMount .phone`). The page loads at `data-viewport` (1440x900), the script measures that element and scales
  the page so only it shows; `data-embed="lock-scroll"` stops the page behind it from scrolling. If the case
  study's hero is redesigned, check the selector still matches. Tap-to-use works the same as Arriba's.
- "Selected work" (`#projects`): the preview window and project list in the first screen. Matias likes the previews
  (2026-10-13: a compact link-only row was tried and rolled back); keep them. The list and the "case studies" stat
  (`data-count="projects"`) adapt to any number of projects; with five or more the list hides taglines to fit.
- Reusable pieces: `.btn` (`-light`, `-glass`, `-dark`, `-text`, `-sm`), `.chip`, `.eyebrow`,
  `.section-head`/`.section-title`/`.section-lead`, `.window` (+ `.window-bar`, `.lights`, `.window-url`),
  `.float-card`, `.seg`, `.gcr` (Goal/Challenge/Result), `.meta`, `.reveal` (fade-up on scroll).

## Gotchas

- Headless Chrome won't lay out windows narrower than about 500px and often doesn't exit on animated
  pages; `tools/chrome.py` handles both. Scroll-based captures come out blank, so screenshots start at a
  section by hiding what's above it.
- `sips -c H W --cropOffset 0 0` ignores zero offsets and crops from the center.
- GitHub's runners occasionally get no page back from headless Chrome (2026-10-07: every `[scripts]` line failed at
  once while the same files passed locally and on the next run). `check.py` now retries empty pages once, slowly.
  If a red run shows every `[scripts]` check failing together and nothing else, re-run it before hunting for a bug.
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
