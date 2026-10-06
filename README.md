# Matias Indacochea · Portfolio

UI/UX and product design portfolio. Four case studies, each one a working product you can open and use: **Halo**, **Arriba Perú**, **AI Native iOS** and **Scowtt**.

Plain HTML, CSS and JavaScript. No build step, no dependencies beyond Python 3 and git for the tools.

## How the case studies stay in sync

Each project lives in its own repo on GitHub. `work/<slug>/` is a mirror of that repo, kept identical by `tools/sync.py`:

- It copies the project's files, adds the portfolio bar (back to portfolio, previous/next, all projects) and points links to the old myportfolio.com site back here.
- `work/sync.json` records which commit each copy came from, a fingerprint of every file, and which version the homepage summary was last checked against.
- `python3 tools/sync.py --check` reports anything behind GitHub, edited by hand, or changed since the homepage was reviewed.
- On GitHub, `.github/workflows/sync-and-publish.yml` runs the sync every 30 minutes and republishes when a project changed.

So: change a project in its own repo, and the portfolio follows.

## Structure

```
index.html                 The portfolio
brand/                     Identity guidelines for the mi mark
work/<slug>/               Mirrored case studies (don't edit by hand) + work/sync.json
assets/css/site.css        Design system and every component
assets/js/site.js          Nav, showcase, scroll motion, live previews, demos
assets/js/return.js        The bar on each case-study page
assets/data/projects.json  The project registry (order, repos, files, screenshot recipes)
assets/img/                Project screenshots and the share image
assets/logo/               Mark, icons, favicons, lockups
assets/docs/               Résumé PDF
tools/                     check.py, sync.py, new_project.py, screenshots.py, review.py, logo.py
CLAUDE.md                  How to work on this site (read by Claude at the start of every session)
```

## Commands

```bash
python3 -m http.server 4321        # preview at http://localhost:4321
python3 tools/check.py             # site check: links, images, registry, counts, TODOs, script test (run before every push)
python3 tools/sync.py              # pull project changes from GitHub
python3 tools/sync.py --check      # what's out of date?
python3 tools/new_project.py ...   # add a project (registry, mirror, screenshot, homepage blocks)
python3 tools/screenshots.py       # refresh project images (macOS + Chrome)
python3 tools/review.py            # full-page layout screenshots at five widths
python3 tools/logo.py              # regenerate the logo SVGs
```

GitHub runs the sync and the site check before every publish. If the check fails, nothing is published
and the last good version stays live.

## Publishing

Live at **https://matiasindacochea.com/**, published from this repo (`Indo1919/portfolio`) by GitHub Pages:
Settings → Pages → Source: **GitHub Actions**, Custom domain: `matiasindacochea.com`, Enforce HTTPS.

Only this repo uses the domain. The account's other GitHub Pages sites, including the original project sites
(`indo1919.github.io/Halo/` and so on), stay on indo1919.github.io. The site's address is `"site"` in
`assets/data/projects.json`; `tools/check.py` makes sure the page tags match it.

---

AI Native iOS is an independent design concept and isn't affiliated with or endorsed by Apple. Names and data inside the prototypes are fictional.
