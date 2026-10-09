/* Google Analytics 4 for the portfolio and its case studies. The ID lives only here.
   Loaded by index.html, brand/, 404.html, and (through return.js) every case study.

   Accuracy:
     - skips iframes, so the homepage's live phones and preview sheet don't count as visits
     - skips local previews (localhost, 127.0.0.1, files), including tools/check.py's browser test
     - skips your own devices: open https://matiasindacochea.com/?no-analytics once per browser
       (?analytics turns it back on). ?ga-debug sends events to Admin > DebugView instead of reports.

   Events (see CLAUDE.md for the GA setup that goes with them):
     resume_download     link_location            key event
     contact_click       method, link_location    key event (email, email_copy, phone, linkedin)
     case_study_open     project, link_location   opened a case study
     project_jump        project, link_location   jumped to a project's summary on the homepage
     project_preview     project                  hovered a project in "Four projects", once each
     live_preview_open   project                  "Try it live" / "Open full screen"
     prototype_tap       project                  tapped a live phone to use it
     film_play           project                  Halo launch film
     section_view        section                  scrolled to a section or project panel, once each
     portfolio_bar_click action, project          the bar at the bottom of a case study
     process_explore     action, project, move    "How I work": action = project | step | move | replay | next | back |
                                                  next_route | restart
     process_complete    project                  walked a route to its last step */
(() => {
  const ID = "G-CXQW1Q5LL0";

  if (window.self !== window.top) return;
  if (location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname)) return;
  const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
  const q = new URLSearchParams(location.search);
  if (q.has("no-analytics")) store("mi-no-analytics", "1");
  if (q.has("analytics")) store("mi-no-analytics", null);
  if (q.has("ga-debug")) store("mi-ga-debug", "1");
  if (store("mi-no-analytics")) return;
  if (window.__miAnalytics) return; // loaded twice
  window.__miAnalytics = true;

  const caseStudy = (location.pathname.match(/\/work\/([^/]+)\//) || [])[1];
  const group = caseStudy ? "Case study" : /\/brand\//.test(location.pathname) ? "Identity"
    : document.querySelector('meta[name="robots"][content*="noindex"]') ? "Not found" : "Home";

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", ID, Object.assign({ content_group: group }, store("mi-ga-debug") ? { debug_mode: true } : {}));
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.appendChild(tag);

  const send = (name, params) => gtag("event", name, params);

  /* ---- which project and where on the page */
  const slugFrom = v => ((/(?:^|\/)work\/([^/?#]+)/.exec(v || "") || [])[1]);
  const slugFromAnchor = id => {
    const panel = id && document.getElementById(id);
    const card = panel && panel.matches("article.project") && panel.querySelector("[data-href]");
    return card ? slugFrom(card.getAttribute("data-href")) : undefined;
  };
  const projectOf = el => {
    for (let n = el; n && n.getAttribute; n = n.parentElement) {
      for (const k of ["data-path", "data-live", "data-film", "data-href", "href"]) {
        const v = n.getAttribute(k);
        const s = slugFrom(v) || (k === "href" && v && v[0] === "#" ? slugFromAnchor(v.slice(1)) : undefined);
        if (s) return s;
      }
    }
    return caseStudy;
  };
  const areaOf = el => {
    if (el.closest(".nav-pill")) return "nav";
    if (el.closest(".footer")) return "footer";
    const panel = el.closest("article.project[id]");
    if (panel) return `work:${panel.id}`;
    const section = el.closest("section[id]");
    return section ? section.id : caseStudy ? "case_study" : "page";
  };

  /* ---- clicks (one delegated listener; composedPath reaches into the case-study bar's shadow DOM) */
  const CARD_SKIP = "a, button, input, select, textarea, label, iframe, .device-live:not(.is-static), [data-no-card]";
  document.addEventListener("click", e => {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const target = path.find(n => n instanceof Element) || e.target;

    const bar = path.find(n => n instanceof Element && n.hasAttribute && n.hasAttribute("data-portfolio-bar"));
    if (bar) {
      const hit = target.closest("a, button");
      if (!hit) return;
      const label = hit.getAttribute("aria-label") || "";
      const action = hit.classList.contains("home") || hit.classList.contains("all") ? "back_to_portfolio"
        : hit.classList.contains("switch") ? "open_menu"
        : /^Previous/.test(label) ? "previous_project" : /^Next/.test(label) ? "next_project" : "menu_project";
      send("portfolio_bar_click", { action, project: caseStudy, destination: slugFrom(hit.getAttribute("href")) });
      return;
    }

    const el = target.closest("a, button");
    if (!el) {
      const card = target.closest(".project-card[data-href]");
      if (card && !target.closest(CARD_SKIP) && !String(window.getSelection())) {
        send("case_study_open", { project: slugFrom(card.dataset.href), link_location: "card" });
      }
      return;
    }
    const href = el.getAttribute("href") || "";
    const where = areaOf(el);

    // "How I work" (About): which project, step or move people explore. Links inside it fall through.
    const hiw = el.closest("[data-hiw]");
    if (hiw && !href) {
      const panelOf = tab => tab && document.getElementById(tab.getAttribute("aria-controls"));
      const active = panelOf(hiw.querySelector('[role="tab"][aria-selected="true"]'));
      const project = active ? active.dataset.project : undefined;
      if (el.getAttribute("role") === "tab") { const p = panelOf(el); return send("process_explore", { action: "project", project: p ? p.dataset.project : undefined }); }
      if (el.classList.contains("hiw-step")) return send("process_explore", { action: "step", project, move: el.dataset.move });
      if (el.classList.contains("hiw-node")) return send("process_explore", { action: "move", project, move: el.dataset.move });
      if (el.classList.contains("hiw-play")) return send("process_explore", { action: "replay", project });
      const walkAction = ["hiw-next", "hiw-back", "hiw-nextroute", "hiw-restart"].find(c => el.classList.contains(c));
      if (walkAction) return send("process_explore", { action: walkAction.slice(4).replace("nextroute", "next_route"), project });
      return;
    }

    if (/Resume\.pdf/i.test(href)) return send("resume_download", { link_location: where });
    if (href.startsWith("mailto:")) return send("contact_click", { method: "email", link_location: where });
    if (el.hasAttribute("data-copy")) return send("contact_click", { method: "email_copy", link_location: where });
    if (href.startsWith("tel:")) return send("contact_click", { method: "phone", link_location: where });
    if (/linkedin\.com/i.test(href)) return send("contact_click", { method: "linkedin", link_location: where });
    if (el.hasAttribute("data-live")) return send("live_preview_open", { project: projectOf(el), link_location: where });
    if (el.classList.contains("device-activate")) return send("prototype_tap", { project: projectOf(el), link_location: where });
    if (el.hasAttribute("data-film")) return send("film_play", { project: projectOf(el), link_location: where });
    if (!caseStudy && slugFrom(href)) return send("case_study_open", { project: slugFrom(href), link_location: where });
    if (href[0] === "#" && slugFromAnchor(href.slice(1))) return send("project_jump", { project: slugFromAnchor(href.slice(1)), link_location: where });
  }, true);

  /* ---- homepage: hovering a project in the list, and how far people scroll */
  const onReady = fn => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn();
  onReady(() => {
    if (caseStudy) return;
    const previewed = new Set();
    document.querySelectorAll(".stage-item").forEach(item => item.addEventListener("pointerenter", e => {
      const project = projectOf(item);
      if (e.pointerType !== "mouse" || !project || previewed.has(project)) return;
      previewed.add(project);
      send("project_preview", { project });
    }));

    if (!("IntersectionObserver" in window)) return;
    const seen = new Set();
    // a section counts once its top reaches the middle of the screen (works for sections taller than the screen)
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      const id = entry.target.id;
      if (!entry.isIntersecting || seen.has(id)) return;
      seen.add(id);
      io.unobserve(entry.target);
      send("section_view", { section: entry.target.matches("article.project") ? `work:${id}` : id });
    }), { rootMargin: "0px 0px -50% 0px" });
    document.querySelectorAll("main section[id], article.project[id], #how-i-work").forEach(s => io.observe(s));
  });
  document.addEventListener("hiw:complete", e => send("process_complete", { project: e.detail && e.detail.project }));
})();
