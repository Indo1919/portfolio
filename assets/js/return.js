/* Portfolio bar, added to every case-study page that lives inside the portfolio (tools/sync.py injects it).
   An always-visible bar at the bottom of the screen:
     [← Back to portfolio]  |  ‹  Arriba Perú 2/4  ›
   The middle opens a menu of every project. Project order comes from assets/data/projects.json.
   It hides inside iframes (the homepage's live previews) and lifts itself above a page's own
   bottom toolbar (Halo on phones, for example). */
(() => {
  if (window.self !== window.top) return;
  const script = document.currentScript;
  const base = new URL("../../", script ? script.src : location.href);
  const here = (location.pathname.match(/\/work\/([^/]+)\//) || [])[1];
  if (!here) return;

  const MARK = '<svg class="mark" viewBox="0 -31.04 112.5 95.04" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7A1A"/><stop offset=".4" stop-color="#FF2E6A"/><stop offset=".72" stop-color="#A35BFF"/><stop offset="1" stop-color="#2F7BFF"/></linearGradient></defs><path d="M7 64V23a16 16 0 0 1 32 0v41M39 23a16 16 0 0 1 32 0v41M103 64V0" fill="none" stroke="currentColor" stroke-width="14"/><circle cx="103" cy="-21.54" r="9.5" fill="url(#g)"/></svg>';
  const ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5"/></svg>',
  };

  const host = document.createElement("div");
  host.setAttribute("data-portfolio-bar", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  .bar {
    position: fixed; left: 50%; bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--lift, 0px)); z-index: 2147483000;
    display: flex; align-items: center; gap: 4px; padding: 5px;
    border-radius: 999px;
    background: rgba(20, 20, 22, .78);
    -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 18px 50px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.25);
    font: 600 14px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif;
    letter-spacing: -.01em; color: #f5f5f7;
    transform: translate(-50%, 120px); opacity: 0;
    transition: transform .6s cubic-bezier(.22,1,.36,1), opacity .4s, bottom .3s cubic-bezier(.22,1,.36,1);
  }
  .bar.in { transform: translate(-50%, 0); opacity: 1; }
  a, button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 46px; border-radius: 999px; white-space: nowrap; color: inherit; transition: background-color .2s, transform .2s; }
  a:focus-visible, button:focus-visible { outline: 2px solid #2997ff; outline-offset: 2px; }
  svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .home { padding: 0 20px 0 14px; background: #f5f5f7; color: #000; }
  .home:hover { background: #fff; }
  .home:active { transform: scale(.97); }
  .home .mark { width: 22px; height: auto; stroke: none; color: #000; }
  .home .mark path { stroke: #000; }
  .home .arrow { width: 16px; height: 16px; margin-right: -2px; }
  .sep { width: 1px; height: 22px; background: rgba(255,255,255,.16); margin: 0 4px; flex: none; }
  .step { width: 42px; color: rgba(245,245,247,.85); }
  .step:hover, .switch:hover, .switch[aria-expanded="true"] { background: rgba(255,255,255,.1); color: #fff; }
  .step[aria-disabled="true"] { opacity: .35; pointer-events: none; }
  .switch { padding: 0 14px; gap: 10px; font-weight: 600; }
  .switch .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c, #fff); box-shadow: 0 0 10px var(--c, #fff); }
  .switch .count { color: rgba(245,245,247,.55); font-weight: 500; font-variant-numeric: tabular-nums; }
  .switch .up { width: 14px; height: 14px; opacity: .6; transition: transform .3s; }
  .switch[aria-expanded="true"] .up { transform: rotate(180deg); }
  .menu {
    position: absolute; left: 50%; bottom: calc(100% + 10px); width: 280px; padding: 6px;
    border-radius: 20px; background: rgba(24, 24, 27, .92);
    -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 24px 60px rgba(0,0,0,.5);
    transform: translate(-50%, 8px); opacity: 0; pointer-events: none;
    transition: transform .3s cubic-bezier(.22,1,.36,1), opacity .2s;
  }
  .menu.open { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
  .menu p { margin: 8px 12px 6px; font-size: 12px; font-weight: 500; color: rgba(245,245,247,.5); }
  .menu a { display: flex; justify-content: flex-start; width: 100%; height: 44px; padding: 0 12px; border-radius: 12px; font-weight: 500; }
  .menu a:hover { background: rgba(255,255,255,.08); }
  .menu a[aria-current="page"] { background: rgba(255,255,255,.1); font-weight: 600; }
  .menu .n { width: 22px; font-size: 12px; font-weight: 700; color: var(--c); font-variant-numeric: tabular-nums; }
  .menu .all { margin-top: 4px; border-top: 1px solid rgba(255,255,255,.08); border-radius: 0 0 12px 12px; padding-top: 2px; color: #2997ff; }
  .hint { animation: hint 1.6s ease-out .8s 2; }
  @keyframes hint { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.55); } 100% { box-shadow: 0 0 0 14px rgba(255,255,255,0); } }
  .label-short { display: none; }
  @media (max-width: 560px) {
    .bar { gap: 2px; padding: 4px; max-width: calc(100vw - 24px); }
    .label-long, .switch .name { display: none; }
    .label-short { display: inline; }
    .home { padding: 0 14px 0 10px; gap: 6px; height: 44px; }
    .home .mark { width: 19px; }
    .step { width: 36px; height: 44px; }
    .switch { padding: 0 10px; gap: 6px; height: 44px; }
    .sep { margin: 0 2px; }
    .menu { width: min(280px, calc(100vw - 24px)); }
  }
  @media (prefers-reduced-motion: reduce) { .bar, .menu { transition: none; } .hint { animation: none; } }
  @media print { .bar { display: none; } }
</style>
<nav class="bar" aria-label="Portfolio">
  <a class="home hint" href="${base.href}#projects">${MARK}<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg><span>Back to <span class="label-long">portfolio</span><span class="label-short">work</span></span></a>
</nav>`;
  document.body.appendChild(host);
  const bar = root.querySelector(".bar");
  const home = root.querySelector(".home");

  const show = () => bar.classList.add("in");
  requestAnimationFrame(() => requestAnimationFrame(show));
  setTimeout(show, 120); // background tabs pause rAF

  /* Prev / next / all-projects menu, once the registry loads */
  fetch(new URL("assets/data/projects.json", base))
    .then(r => r.json())
    .then(({ projects }) => {
      const i = projects.findIndex(p => p.slug === here);
      if (i < 0) return;
      const n = projects.length;
      const cur = projects[i], prev = projects[(i - 1 + n) % n], next = projects[(i + 1) % n]; // wraps around
      home.href = `${base.href}#${cur.anchor}`;
      const url = p => `${base.href}work/${p.slug}/`;
      const step = (p, dir) => p
        ? `<a class="step" href="${url(p)}" aria-label="${dir === "prev" ? "Previous" : "Next"} project: ${p.name}" title="${p.name}">${ICON[dir]}</a>`
        : `<a class="step" aria-disabled="true" aria-hidden="true">${ICON[dir]}</a>`;
      bar.insertAdjacentHTML("beforeend", `
        <span class="sep" aria-hidden="true"></span>
        ${step(prev, "prev")}
        <span style="position:relative;display:inline-flex">
          <button class="switch" type="button" aria-expanded="false" aria-haspopup="true" style="--c:${cur.accent}">
            <span class="dot" aria-hidden="true"></span><span class="name">${cur.name}</span><span class="count">${i + 1}/${projects.length}</span>${ICON.up.replace("<svg", '<svg class="up"')}
          </button>
          <div class="menu" role="menu">
            <p>All projects</p>
            ${projects.map((p, j) => `<a role="menuitem" href="${url(p)}" style="--c:${p.accent}"${j === i ? ' aria-current="page"' : ""}><span class="n">0${j + 1}</span>${p.name}</a>`).join("")}
            <a role="menuitem" class="all" href="${base.href}#projects">${ICON.back}Back to the portfolio</a>
          </div>
        </span>
        ${step(next, "next")}`);
      const sw = root.querySelector(".switch"), menu = root.querySelector(".menu");
      const setMenu = open => { menu.classList.toggle("open", open); sw.setAttribute("aria-expanded", String(open)); };
      sw.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
      document.addEventListener("pointerdown", e => { if (!e.composedPath().includes(host)) setMenu(false); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
      lift();
    })
    .catch(() => { /* registry missing: the back button still works */ });

  /* Stay above a page's own bottom toolbar and out of fullscreen video */
  function lift() {
    let inset = 0;
    const y = innerHeight - 6;
    for (const x of [innerWidth * 0.25, innerWidth * 0.5, innerWidth * 0.75]) {
      for (let el of document.elementsFromPoint(x, y)) {
        if (el === host) continue;
        for (; el && el !== document.body; el = el.parentElement) {
          const pos = getComputedStyle(el).position;
          if (pos === "fixed" || pos === "sticky") {
            const r = el.getBoundingClientRect();
            if (r.height < innerHeight * 0.3 && r.bottom >= innerHeight - 2) inset = Math.max(inset, innerHeight - r.top);
            break;
          }
        }
        break;
      }
    }
    bar.style.setProperty("--lift", `${Math.round(inset)}px`);
    bar.style.display = document.fullscreenElement ? "none" : "";
  }
  let t;
  const soon = () => { clearTimeout(t); t = setTimeout(lift, 150); };
  addEventListener("resize", soon);
  addEventListener("scroll", soon, { passive: true });
  document.addEventListener("fullscreenchange", lift);
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  setTimeout(lift, 600);
})();
