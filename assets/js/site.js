/* Matias Indacochea · Portfolio interactions
 *
 * Every feature runs inside feature("name", ...). If one throws (a renamed class, a removed
 * element), it's logged and skipped and everything else keeps working. Features also return
 * early when their part of the page isn't there. tools/check.py loads the page in Chrome and
 * fails if any feature reported an error (html[data-portfolio-errors]).
 */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const host = location.host || "";
  const urlFor = path => (host ? host + "/" : "") + String(path || "").replace(/\/$/, "");

  const failed = [];
  function feature(name, fn) {
    try { fn(); } catch (err) {
      failed.push(name);
      console.error(`[portfolio] "${name}" failed and was skipped:`, err);
    }
  }
  const onFrame = [];   // run on scroll (one rAF per frame) and on resize
  const onResize = [];  // run on resize
  const ui = {};        // small bits features share (closeMenu, toast)

  root.classList.remove("no-js");
  root.classList.add("js");

  // ?capture renders every animation in its final state, for full-page screenshots (tools/review.py, tools/check.py).
  const capture = /[?&]capture\b/.test(location.search);
  feature("capture", () => {
    if (!capture) return;
    root.classList.add("is-capture", "is-ready");
    $$("img[loading=lazy]").forEach(img => { img.loading = "eager"; });
    const from = +(new URLSearchParams(location.search).get("from") || 0);
    if (from) { document.body.style.marginTop = `${-from}px`; root.dataset.captureFrom = from; }
    addEventListener("load", () => setTimeout(() => {
      const h = root.scrollHeight + from;
      root.dataset.captureHeight = h;
      try { if (window.parent !== window) parent.document.documentElement.dataset.captureHeight = h; } catch { /* cross-origin */ }
    }, 400));
  });

  // Reveal the intro once fonts are in. The timeout covers background tabs, where rAF is paused.
  // (An inline script in <head> also adds is-ready after 3s, in case this file never runs.)
  feature("intro", () => {
    const go = () => root.classList.add("is-ready");
    const ready = () => { requestAnimationFrame(go); setTimeout(go, 60); };
    if (document.fonts && document.fonts.ready) {
      Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(ready);
    } else ready();
  });

  /* Embed tweaks for live prototypes shown inside the portfolio's own device frames,
     keyed by data-embed on the iframe or the button that opens it. */
  const EMBED_CSS = {
    // Arriba Perú's prototype goes "frameless" under 560px: it hides its Android status bar,
    // punch-hole camera and gesture bar and shows a "The story" bar instead. Inside the
    // portfolio's Android frame, bring the phone chrome back and drop the story bar.
    "android-app": `body.frameless header.top{display:none!important}
      body.frameless #devWrap{height:100vh!important;height:100dvh!important}
      body.frameless .cam{display:block!important}
      body.frameless .sbar{display:flex!important}
      body.frameless .gest{display:block!important}
      body.frameless .tb{padding-top:40px!important}
      body.frameless .vid>div[style*="top:44px"]{top:44px!important}
      body.frameless .lock .clk{margin-top:84px!important}`,
    // A case-study page shown only for its phone (data-crop): the page behind it must not scroll.
    "lock-scroll": "html,body{overflow:hidden!important}",
  };
  function applyEmbed(frame, key) {
    if (!key || !EMBED_CSS[key]) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.head || doc.getElementById("portfolio-embed")) return;
      const style = doc.createElement("style");
      style.id = "portfolio-embed";
      style.textContent = EMBED_CSS[key];
      doc.head.appendChild(style);
    } catch { /* not same-origin */ }
  }

  /* ---------------------------------------------------------------- toast */
  feature("toast", () => {
    const el = $("#toast");
    let timer;
    ui.toast = msg => {
      if (!el) return;
      el.textContent = msg;
      el.classList.add("is-on");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("is-on"), 2200);
    };
  });
  const toast = msg => ui.toast && ui.toast(msg);

  /* ---------------------------------------------------------------- reveal on scroll */
  feature("reveal", () => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$(".reveal").forEach(el => {
      const i = $$(":scope > .reveal", el.parentElement).indexOf(el);
      if (i > 0) el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`);
      io.observe(el);
    });
    // only now hide what's waiting to reveal; if this feature never ran, content stays visible
    root.classList.add("js-reveal");

    // tiles and the mark card get their own "in view" flag for internal animation
    const inView = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle("is-in", e.isIntersecting));
    }, { threshold: 0.3 });
    $$(".tile-research, .mark-card").forEach(el => inView.observe(el));
  });

  /* ---------------------------------------------------------------- navigation */
  feature("nav", () => {
    const nav = $("#nav");
    if (!nav) return;
    const navLinks = $$(".nav-links a", nav);
    const indicator = $(".nav-indicator", nav);
    const navCurrent = $(".nav-current", nav);
    const navToggle = $(".nav-toggle", nav);
    const sections = navLinks.map(a => { try { return $(a.getAttribute("href")); } catch { return null; } });
    const toneSections = $$("[data-tone]").filter(el => el !== nav);
    let activeLink = null;
    let hoverLink = null;

    function placeIndicator(link) {
      if (!indicator) return;
      if (!link || getComputedStyle(indicator).display === "none") { indicator.style.opacity = "0"; return; }
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
      indicator.style.opacity = "1";
    }
    function closeMenu() {
      nav.classList.remove("is-open");
      if (navToggle) {
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
      }
    }
    ui.closeMenu = closeMenu;

    navLinks.forEach(a => {
      a.addEventListener("pointerenter", () => { hoverLink = a; placeIndicator(a); });
      a.addEventListener("pointerleave", () => { hoverLink = null; placeIndicator(activeLink); });
      a.addEventListener("click", closeMenu);
    });
    if (navToggle) navToggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.addEventListener("click", e => {
      if (nav.classList.contains("is-open") && !nav.contains(e.target)) closeMenu();
    });
    if (navCurrent) navCurrent.textContent = "Matias Indacochea";

    onFrame.push(() => {
      const vh = innerHeight;
      let current = null;
      sections.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top <= vh * 0.42) current = navLinks[i]; });
      if (current !== activeLink) {
        navLinks.forEach(a => {
          a.classList.toggle("is-active", a === current);
          if (a === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
        activeLink = current;
        if (!hoverLink) placeIndicator(activeLink);
        if (navCurrent) navCurrent.textContent = current ? current.textContent : "Matias Indacochea";
      }
      for (const sec of toneSections) { // which section sits under the pill
        const r = sec.getBoundingClientRect();
        if (r.top <= 40 && r.bottom > 40) {
          if (nav.dataset.tone !== sec.dataset.tone) nav.dataset.tone = sec.dataset.tone;
          break;
        }
      }
      const max = root.scrollHeight - vh;
      nav.style.setProperty("--progress", max > 0 ? (scrollY / max).toFixed(4) : 0);
    });
    onResize.push(() => placeIndicator(hoverLink || activeLink));
  });

  /* ---------------------------------------------------------------- hero spotlight */
  feature("hero", () => {
    const hero = $(".hero");
    if (!hero || !finePointer.matches) return;
    hero.addEventListener("pointermove", e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
      hero.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------------------------------------------------------------- showcase
     Preview window + the list of every project. All project data lives in the markup
     (data-* on .stage-item), so adding a project is an HTML edit. Works for any count. */
  feature("showcase", () => {
    const stage = $("#stage");
    if (!stage) return;
    const items = $$(".stage-item", stage);
    if (!items.length) return;
    const stageImgs = $$(".stage-screen img", stage);
    const stageLink = $(".stage-screen", stage);
    const stageUrl = $(".url-text", stage);
    const overlay = $(".stage-overlay", stage);
    const soName = $(".so-name", stage);
    const soKicker = $(".so-kicker", stage);
    const soOpen = $(".so-open", stage);
    const soLive = $(".so-live", stage);
    let index = 0, visible = false, hover = false;

    function setStage(i) {
      index = (i + items.length) % items.length;
      const it = items[index];
      const name = ($(".si-name", it) || it).textContent.trim();
      items.forEach((t, j) => {
        const on = j === index;
        t.classList.toggle("is-active", on);
        const bar = on && $(".si-bar", t);
        if (bar) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; } // restart progress
      });
      stageImgs.forEach((img, j) => {
        if (j === index && img.loading === "lazy") img.loading = "eager";
        img.classList.toggle("is-active", j === index);
      });
      const path = it.dataset.path || it.getAttribute("href");
      if (stageUrl) stageUrl.textContent = urlFor(path);
      if (stageLink) { stageLink.href = path; stageLink.setAttribute("aria-label", `Open the ${name} case study`); }
      if (soOpen) soOpen.href = path;
      if (soLive) {
        soLive.dataset.live = it.dataset.preview || path;
        soLive.dataset.liveTitle = name;
        soLive.dataset.liveDevice = it.dataset.previewDevice || "";
        soLive.dataset.embed = it.dataset.previewEmbed || "";
      }
      if (overlay) overlay.classList.add("is-swapping");
      setTimeout(() => {
        if (soName) soName.textContent = name;
        if (soKicker) soKicker.textContent = it.dataset.kicker || "";
        if (overlay) overlay.classList.remove("is-swapping");
      }, 160);
    }
    items.forEach((it, i) => {
      // preview on hover / keyboard focus; the click itself follows the link to the summary
      it.addEventListener("pointerenter", e => { if (e.pointerType === "mouse" && i !== index) setStage(i); });
      it.addEventListener("focus", () => { if (i !== index) setStage(i); });
      const bar = $(".si-bar", it);
      if (bar) bar.addEventListener("animationend", () => { if (it.classList.contains("is-active")) setStage(index + 1); });
    });
    const syncPause = () => stage.classList.toggle("is-paused", !visible || hover || reduce.matches || document.hidden);
    stage.addEventListener("pointerenter", () => { hover = true; syncPause(); });
    stage.addEventListener("pointerleave", () => { hover = false; syncPause(); });
    document.addEventListener("visibilitychange", syncPause);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; syncPause(); }, { threshold: 0.25 }).observe(stage);
    if (stageUrl) stageUrl.textContent = urlFor(items[0].dataset.path);
    // warm the other preview images once the page is idle
    (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => stageImgs.forEach(img => { img.loading = "eager"; }));
  });

  /* ---------------------------------------------------------------- optical title alignment
     A big title should start where its first letter's ink starts. Letters carry different side
     space ("Halo"'s H has much more than "Arriba"'s A), so at display sizes the H sits a few pixels
     right of the kicker above it. Measure the first letter and pull the title back by that much. */
  feature("optical-titles", () => {
    const titles = $$(".project-title");
    if (!titles.length) return;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx || !ctx.measureText) return;
    const fit = () => titles.forEach(t => {
      const cs = getComputedStyle(t), size = parseFloat(cs.fontSize), first = t.textContent.trim().charAt(0);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const inset = -ctx.measureText(first).actualBoundingBoxLeft; // > 0: the ink starts right of the text box
      t.style.marginLeft = inset > 0 && inset < size * 0.15 ? `${(-inset / size).toFixed(3)}em` : "";
    });
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  });

  /* ---------------------------------------------------------------- no lonely last words
     text-wrap: pretty (site.css) catches most one-word last lines, but not every browser applies it
     to every block. The last two words of the copy are kept together when they easily fit on a line. */
  feature("widows", () => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    $$(".section-lead, .project-intro p, .gcr-card dd, .about-body p, .role-body li, .hiw-note, .pull p").forEach(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) last = n;
      const m = last && /(\S+) (\S+\s*)$/.exec(last.nodeValue);
      if (!m || m[0].length > 28) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if (ctx.measureText(m[0].trim()).width <= el.clientWidth * 0.9) last.nodeValue = last.nodeValue.slice(0, m.index) + `${m[1]}\u00a0${m[2]}`;
    });
  });

  /* ---------------------------------------------------------------- scroll-linked motion */
  feature("motion", () => {
    const stageTilt = $(".stage");
    const cards = $$(".project");
    const parallaxEls = $$(".parallax");
    const visible = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
    }, { rootMargin: "20% 0px 20% 0px" });
    [stageTilt, ...cards, ...parallaxEls].filter(Boolean).forEach(el => io.observe(el));

    onFrame.push(() => {
      if (reduce.matches) return;
      const vh = innerHeight;
      if (stageTilt && visible.has(stageTilt)) {
        const top = stageTilt.getBoundingClientRect().top;
        stageTilt.style.setProperty("--p", ease(clamp((vh - top) / (vh * 0.7))).toFixed(4));
      }
      cards.forEach(card => {
        if (!visible.has(card)) return;
        const top = card.getBoundingClientRect().top;
        card.style.setProperty("--enter", ease(clamp((vh - top) / (vh * 0.45))).toFixed(4));
      });
      parallaxEls.forEach(el => {
        if (!visible.has(el)) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--py", `${(((r.top + r.height / 2) - vh / 2) * parseFloat(el.dataset.speed || 0)).toFixed(1)}px`);
      });
    });
  });

  /* ---------------------------------------------------------------- magnetic buttons */
  feature("magnetic", () => {
    if (!finePointer.matches || reduce.matches) return;
    $$(".magnetic").forEach(btn => {
      btn.addEventListener("pointermove", e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${((e.clientX - r.left - r.width / 2) / r.width) * 8}px, ${((e.clientY - r.top - r.height / 2) / r.height) * 6}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  });

  /* ---------------------------------------------------------------- whole-card links
     Clicking anywhere on a case-study panel opens data-href. The "View case study" link stays
     the keyboard and screen-reader path; controls inside the card keep their own job. */
  feature("cards", () => {
    const SKIP = "a, button, input, select, textarea, label, iframe, .device-live:not(.is-static), [data-no-card]";
    $$(".project-card[data-href]").forEach(card => {
      const open = newTab => newTab ? window.open(card.dataset.href, "_blank", "noopener") : (location.href = card.dataset.href);
      card.addEventListener("click", e => {
        if (e.defaultPrevented || e.target.closest(SKIP)) return;
        if (String(window.getSelection())) return; // selecting text, not clicking
        open(e.metaKey || e.ctrlKey);
      });
      card.addEventListener("auxclick", e => { if (e.button === 1 && !e.target.closest(SKIP)) open(true); });
    });
  });

  /* ---------------------------------------------------------------- Halo light / dark */
  feature("halo-theme", () => {
    const btns = $$("[data-halo-theme]");
    btns.forEach(btn => btn.addEventListener("click", () => {
      const theme = btn.dataset.haloTheme;
      btns.forEach(b => { b.classList.toggle("is-on", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
      $$("[data-theme-img]").forEach(img => {
        if (img.dataset.themeImg === theme && img.loading === "lazy") img.loading = "eager";
        img.classList.toggle("is-on", img.dataset.themeImg === theme);
      });
    }));
  });

  /* ---------------------------------------------------------------- live phones
     [data-live-embed]: a real prototype in an iframe, tap to use, "Done" to release.
     - Default: the iframe is a 390px-wide app scaled into .device-screen (Arriba Perú).
     - data-crop="<selector>": a full page loads at data-viewport and only that element shows (AI Native iOS).
     - data-expect="<selector>": must exist in the loaded page, or the still image stays.
     If anything is missing, the poster image stays and the tap prompt hides. */
  feature("live-embeds", () => {
    const devices = $$("[data-live-embed]");
    if (!devices.length) return;

    function size(dev) {
      const screen = $(".device-screen", dev), frame = $("iframe", dev);
      if (!screen || !frame) return;
      if (dev.dataset.crop) { // scale and shift the page so the cropped element fills the screen
        const r = dev.cropRect;
        if (!r) return;
        screen.style.aspectRatio = `${r.width} / ${r.height}`;
        const k = screen.clientWidth / r.width;
        frame.style.setProperty("--crop", `translate(${(-r.left * k).toFixed(2)}px, ${(-r.top * k).toFixed(2)}px) scale(${k.toFixed(4)})`);
        return;
      }
      const s = screen.clientWidth / 390;
      frame.style.setProperty("--s", s.toFixed(4));
      frame.style.height = `${Math.ceil(screen.clientHeight / s)}px`;
    }
    const sizeAll = () => devices.forEach(size);
    onResize.push(sizeAll);

    function measureCrop(dev) {
      try {
        const el = $("iframe", dev).contentDocument.querySelector(dev.dataset.crop);
        const r = el && el.getBoundingClientRect();
        if (!r || !r.width) return false;
        dev.cropRect = { left: r.left, top: r.top, width: r.width, height: r.height };
        size(dev);
        return true;
      } catch { return false; }
    }
    function makeStatic(dev, why) {
      dev.classList.add("is-static");
      release(dev);
      console.warn(`[portfolio] live embed ${$("iframe", dev).dataset.src}: ${why}. Showing the still image. Run python3 tools/sync.py --check.`);
    }
    function activate(dev) {
      if (dev.classList.contains("is-static")) return;
      delete dev.dataset.wantsActive;
      const frame = $("iframe", dev);
      dev.classList.add("is-active");
      frame.tabIndex = 0;
      const rel = $(".device-release", dev);
      if (rel) rel.hidden = false;
      frame.focus();
    }
    function release(dev) {
      dev.classList.remove("is-active");
      const frame = $("iframe", dev), rel = $(".device-release", dev);
      if (frame) frame.tabIndex = -1;
      if (rel) rel.hidden = true;
    }
    function load(dev) {
      const frame = $("iframe", dev);
      if (!frame || frame.src || dev.classList.contains("is-static")) return;
      if (frame.dataset.viewport) {
        const [w, h] = frame.dataset.viewport.split("x");
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
      }
      const reveal = () => {
        if (dev.classList.contains("is-loaded")) return;
        dev.classList.add("is-loaded");
        if (dev.dataset.wantsActive) activate(dev);
      };
      frame.addEventListener("load", () => {
        applyEmbed(frame, frame.dataset.embed);
        let doc = null;
        try { doc = frame.contentDocument; } catch { /* cross-origin */ }
        if (dev.dataset.expect && doc && !doc.querySelector(dev.dataset.expect)) { makeStatic(dev, `"${dev.dataset.expect}" isn't in the page`); return; }
        if (!dev.dataset.crop) { reveal(); return; }
        try { frame.contentWindow.addEventListener("scroll", () => frame.contentWindow.scrollTo(0, 0)); } catch { /* cross-origin */ }
        setTimeout(() => { if (measureCrop(dev)) reveal(); }, 600);       // once the page has settled
        setTimeout(() => {
          if (measureCrop(dev)) reveal();
          else makeStatic(dev, `"${dev.dataset.crop}" wasn't found`);
        }, 1800);
      }, { once: true });
      frame.src = frame.dataset.src;
      size(dev);
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) load(e.target);
        else if (e.target.classList.contains("is-active")) release(e.target);
      });
    }, { rootMargin: "400px 0px" });
    devices.forEach(dev => {
      io.observe(dev);
      const act = $(".device-activate", dev), rel = $(".device-release", dev);
      if (act) act.addEventListener("click", () => {
        load(dev);
        if (dev.classList.contains("is-loaded")) activate(dev);
        else dev.dataset.wantsActive = "1"; // activates the moment it's ready
      });
      if (rel) rel.addEventListener("click", () => release(dev));
    });
    sizeAll();
  });

  /* ---------------------------------------------------------------- Scowtt palette */
  feature("palette", () => {
    const info = $(".swatch-info");
    const swatches = $$(".swatches button");
    swatches.forEach(sw => {
      sw.setAttribute("aria-label", `${sw.dataset.name}: ${sw.dataset.role}`);
      const show = () => {
        swatches.forEach(b => b.classList.toggle("is-on", b === sw));
        if (info) info.innerHTML = `<b>${sw.dataset.name}</b> · ${sw.dataset.role}`;
      };
      sw.addEventListener("click", show);
      sw.addEventListener("pointerenter", show);
      sw.addEventListener("focus", show);
    });
  });

  /* ---------------------------------------------------------------- process: undo demo */
  feature("undo-demo", () => {
    $$("[data-undo]").forEach(demo => {
      const count = $(".ud-count", demo), msg = $(".ud-msg", demo), undoBtn = $(".ud-undo", demo);
      const book = $(".ud-book", demo), cancel = $(".ud-cancel", demo);
      if (!count || !msg || !undoBtn || !book) return;
      let timer = null, n = 5;
      const reset = () => {
        clearInterval(timer); timer = null;
        demo.classList.remove("is-booked", "is-done");
        msg.textContent = "Booked for 8:00";
        undoBtn.hidden = false;
        n = 5; count.textContent = n;
      };
      book.addEventListener("click", () => {
        if (timer) return;
        demo.classList.add("is-booked");
        n = 5; count.textContent = n;
        timer = setInterval(() => {
          n -= 1; count.textContent = n;
          if (n > 0) return;
          clearInterval(timer); timer = null;
          demo.classList.add("is-done");
          msg.textContent = "Table booked";
          undoBtn.hidden = true;
          setTimeout(reset, 2600);
        }, 1000);
      });
      undoBtn.addEventListener("click", () => { reset(); toast("Undone. Nothing was booked."); });
      if (cancel) cancel.addEventListener("click", () => toast("Cancelled. It never acts without your yes."));
    });
  });

  /* ---------------------------------------------------------------- process: Halo trust dial */
  feature("trust-dial", () => {
    const MODES = [
      { n: 12, head: "12 updates need you", sub: "You approve everything before anything is shared.", color: "#FF4405" },
      { n: 4, head: "4 updates need you", sub: "8 shared automatically. Sensitive ones wait for a once-a-day digest.", color: "#FF4405" },
      { n: 0, head: "Nothing waits for you", sub: "Halo shares as it goes, with a live activity log you can correct.", color: "#30d158" },
    ];
    $$("[data-dial]").forEach(dial => {
      const btns = $$("[data-mode]", dial);
      const num = $(".dial-num", dial), head = $(".dial-head", dial), sub = $(".dial-sub", dial), ring = $(".ring-fg", dial);
      if (btns.length !== MODES.length || !num || !head || !sub || !ring) return;
      let shown = 4;
      function set(i, focus) {
        const m = MODES[i];
        btns.forEach((b, j) => { b.classList.toggle("is-on", j === i); b.setAttribute("aria-checked", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
        if (focus) btns[i].focus();
        ring.style.setProperty("--dash", m.n === 0 ? 12 : m.n);
        ring.style.stroke = m.color;
        head.textContent = m.head;
        sub.textContent = m.sub;
        const from = shown, to = m.n, t0 = performance.now();
        const step = now => {
          const t = clamp((now - t0) / 500);
          num.textContent = Math.round(from + (to - from) * ease(t));
          if (t < 1) requestAnimationFrame(step); else shown = to;
        };
        requestAnimationFrame(step);
      }
      btns.forEach((b, i) => {
        b.tabIndex = i === 1 ? 0 : -1;
        b.addEventListener("click", () => set(i));
        b.addEventListener("keydown", e => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); set((i + 1) % 3, true); }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); set((i + 2) % 3, true); }
        });
      });
    });
  });

  /* ---------------------------------------------------------------- count-up numbers
     data-count="projects" counts the case-study panels, so it stays right when projects change. */
  feature("counts", () => {
    $$('[data-count="projects"]').forEach(el => { el.dataset.to = $$("#work .project").length; el.textContent = el.dataset.to; });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target, to = +el.dataset.to;
        if (!isFinite(to)) return;
        if (reduce.matches || capture) { el.textContent = to; return; }
        const t0 = performance.now();
        const step = now => {
          const t = clamp((now - t0) / 1400);
          el.textContent = Math.round(to * ease(t));
          if (t < 1) requestAnimationFrame(step);
        };
        el.textContent = "0";
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    $$(".count").forEach(el => io.observe(el));
  });

  /* ---------------------------------------------------------------- experience accordion */
  feature("accordion", () => {
    $$(".role-head").forEach(btn => {
      btn.addEventListener("click", () => btn.setAttribute("aria-expanded", String(btn.getAttribute("aria-expanded") !== "true")));
    });
  });

  /* ---------------------------------------------------------------- mark construction */
  feature("mark", () => {
    const btn = $("[data-construct-toggle]"), stage = $("[data-construct]");
    if (!btn || !stage) return;
    btn.addEventListener("click", () => {
      const on = stage.classList.toggle("is-construct");
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Hide construction" : "Show construction";
    });
  });

  /* ---------------------------------------------------------------- how I work
     Six moves sit on a ring; each route (My approach, then one per project) is drawn around it step by step.
     Moving forward travels one orbit; a step marked as a loop back (.hiw-step-turn) travels another, dashed.
     The panel beside the ring explains the current step: what I did, why, what AI did and what I did,
     and what it produced. Plays once when it scrolls into view (about twelve seconds), then it's the
     visitor's: pick a route, a step, or a move. All copy is markup in index.html (#how-i-work); without
     this feature the routes stay readable as plain lists. */
  feature("how-i-work", () => {
    const box = $("[data-hiw]");
    if (!box) return;
    const ORDER = ["listen", "frame", "build", "test", "decide", "ship"];
    const map = $(".hiw-map", box), svg = $(".hiw-lines", box), center = $(".hiw-center", box), detail = $(".hiw-detail", box);
    const headline = $(".hiw-headline", box), playBtn = $(".hiw-play", box);
    const tabs = $$('[role="tab"]', box);
    const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
    const nodes = {}, moves = {};
    $$(".hiw-node", box).forEach(n => { nodes[n.dataset.move] = n; });
    $$(".hiw-moves [data-move]", box).forEach(m => { moves[m.dataset.move] = m; });
    if (!map || !svg || !center || !detail || !tabs.length || panels.some(p => !p) || ORDER.some(m => !nodes[m])) return;

    // pacing: the dot glides to each move (0.8s), then the step stays long enough to read its title and
    // line (1.7–3s), a little longer when it has details: about 3.3s a step. Then the next route starts
    // after NEXT, and after the last route the first one comes round again. It never stops on its own.
    const TRAVEL = 800, NEXT = 3600;
    const LAG = 450; // AI follows: its line trails mine by this much, then pings the move
    const readTime = s => Math.max(1700, Math.min(3000, 500 + [s.label, s.text].join(" ").split(/\s+/).length * 125))
      + (s.why || s.ai || s.out.length ? 500 : 0);
    const glide = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; // ease in and out
    const still = () => reduce.matches || capture;
    const txt = (el, s) => { const n = el && $(s, el); return n ? n.textContent.trim() : ""; };
    const strip = (v, prefix) => v.replace(new RegExp(`^${prefix}:\\s*`), "");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const nameOf = m => txt(nodes[m], ".hiw-name");
    const iconOf = m => { const u = $("use", nodes[m]); return u ? `<svg class="hiw-ic" aria-hidden="true"><use href="${u.getAttribute("href")}"/></svg>` : ""; };
    const svgUse = id => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
    const listJoin = a => a.length < 2 ? `${a[0]}` : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const moveInfo = m => ({ ai: txt(moves[m], ".hiw-m-ai"), me: txt(moves[m], ".hiw-m-me"), isAi: !!moves[m] && moves[m].dataset.ai === "true",
      lead: txt(moves[m], ".hiw-m-lead"), body: txt(moves[m], ".hiw-m-body") });

    // read every route once, and dress its steps (icon, number) for the strip
    const routes = panels.map((panel, ri) => {
      const els = $$(".hiw-step", panel).filter(el => nodes[el.dataset.move]);
      const steps = els.map((el, i) => {
        const outEl = $(".hiw-step-out", el);
        const s = { el, i, move: el.dataset.move, label: txt(el, ".hiw-step-label"), text: txt(el, ".hiw-step-text"),
          why: strip(txt(el, ".hiw-step-why"), "Why"), ai: strip(txt(el, ".hiw-step-ai"), "AI"), me: strip(txt(el, ".hiw-step-me"), "Me"),
          out: outEl ? strip(outEl.textContent.trim(), "Output").split(" · ").filter(Boolean) : [], eng: !!(outEl && outEl.hasAttribute("data-eng")),
          turn: txt(el, ".hiw-step-turn") };
        el.insertAdjacentHTML("afterbegin",
          `<span class="hiw-chip" aria-hidden="true"><span class="hiw-chip-orb">${iconOf(s.move)}</span><span class="hiw-chip-n">${i + 1}</span>` +
          `${s.eng ? '<svg class="hiw-chip-eng"><use href="#i-code"/></svg>' : ""}${s.ai ? '<svg class="hiw-spark"><use href="#i-spark"/></svg>' : ""}</span>` +
          `<span class="sr">Step ${i + 1} of ${els.length}, ${esc(nameOf(s.move))}. </span>`);
        el.classList.toggle("has-turn", !!s.turn);
        s.dwell = (i === 0 ? 0 : TRAVEL) + readTime(s);
        return s;
      });
      const turns = steps.filter(s => s.turn).length, ais = steps.filter(s => s.ai).length;
      const outputs = [...new Set(steps.flatMap(s => s.out))];
      const sum = $(".hiw-sum", panel);
      if (sum) sum.textContent = `${plural(steps.length, "step", "steps")} · ${plural(turns, "loop", "loops")} back · ${ais ? `AI in ${ais}` : "no AI"}`;
      return { panel, tab: tabs[ri], steps, turns, ais, outputs, title: txt(panel, ".hiw-route-title"), project: panel.dataset.project,
        name: panel.dataset.name || tabs[ri].textContent.trim(), label: tabs[ri].textContent.trim(),
        lead: panel.dataset.lead || "", follow: panel.dataset.follow || "" };
    });
    if (routes.some(rt => rt.steps.length < 2)) return;

    // each move: its principle on hover, and an "AI" tag that shows while AI pings it
    ORDER.forEach(m => {
      const n = nodes[m], tag = $(".hiw-tag", n), nm = $(".hiw-name", n);
      const lead = moves[m] ? txt(moves[m], ".hiw-m-lead") : "";
      if (lead) n.insertAdjacentHTML("beforeend", `<span class="hiw-tip" aria-hidden="true">${esc(lead)}</span>`);
      if (nm && tag) { const row = document.createElement("span"); row.className = "hiw-label"; nm.replaceWith(row); row.append(nm, tag); }
      n.dataset.ai = String(moveInfo(m).isAi);
      if (tag) tag.innerHTML = `${svgUse("i-spark")}AI`;
    });

    // svg scaffolding
    svg.innerHTML =
      `<defs><linearGradient id="hiw-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">` +
      `<stop offset="0" stop-color="#FF7A1A"/><stop offset=".38" stop-color="#FF2E6A"/><stop offset=".7" stop-color="#A35BFF"/><stop offset="1" stop-color="#2F7BFF"/></linearGradient>` +
      `<marker id="hiw-arrow" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1.5 7 5 2 8.5" fill="none" stroke="#f5f5f7" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker>` +
      `<marker id="hiw-arrow-turn" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1.5 7 5 2 8.5" fill="none" stroke="#FF2E6A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker>` +
      `</defs><g class="hiw-ring-g"></g><g class="hiw-edges"></g><g class="hiw-ai-edges"></g>` +
      `<circle class="hiw-aidot" r="4" cx="-40" cy="-40"/><circle class="hiw-dot" r="6" cx="-40" cy="-40"/>`;
    const grad = $("#hiw-grad", svg), ringG = $(".hiw-ring-g", svg), edgeG = $(".hiw-edges", svg), aiG = $(".hiw-ai-edges", svg);
    const dot = $(".hiw-dot", svg), aiDot = $(".hiw-aidot", svg);

    /* ---- geometry: the moves sit on an ellipse. Wide maps: routes orbit outside it, labels inside.
       Narrow maps: routes orbit inside, labels outside. Either way the routes never cross a label. */
    let W = 0, H = 0, cx = 0, cy = 0, rx = 0, ry = 0, orbR = 29, compact = false;
    let LANE = { fwd: 46, turn: 82, lap: 11 };
    const angle = i => (-90 + 60 * i) * Math.PI / 180;
    const at = (i, off = 0) => [cx + (rx + off) * Math.cos(angle(i)), cy + (ry + off) * Math.sin(angle(i))];
    const f = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const toward = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return l <= d ? q : [p[0] + dx / l * d, p[1] + dy / l * d]; };

    let r = 0, edges = [], aiEdges = [];
    function layout() {
      W = map.clientWidth; H = map.clientHeight;
      if (!W || !H) return;
      compact = W < 720;
      LANE = compact ? { fwd: -30, turn: -54, lap: -9 } : { fwd: 46, turn: 82, lap: 11 };
      cx = W / 2; cy = H / 2;
      if (compact) { rx = W / 2 - 62; ry = H / 2 - 50; }
      else { const outer = LANE.turn + LANE.lap * 2; rx = W / 2 - outer - 34; ry = H / 2 - outer - 8; }
      orbR = ($(".hiw-orb", nodes.listen).offsetWidth || 58) / 2;
      box.classList.toggle("is-compact", compact);
      ORDER.forEach((m, i) => {
        const [x, y] = at(i);
        const n = nodes[m];
        n.style.left = `${x.toFixed(1)}px`; n.style.top = `${y.toFixed(1)}px`;
        n.classList.toggle("is-above", compact ? y < cy - 1 : y > cy + 1);
      });
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      grad.setAttribute("x2", W);
      ringG.innerHTML = `<ellipse class="hiw-ring" cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
      build();
    }

    // one path per step after the first: out of the previous move, around an orbit, into the next.
    // The shorter way round (ties go clockwise); later laps of the same stretch move to the next orbit so they don't overlap.
    function build() {
      edgeG.textContent = ""; aiG.textContent = "";
      $$(".hiw-turnlbl", map).forEach(n => n.remove());
      edges = []; aiEdges = [];
      if (!W) return;
      const used = {};
      const steps = routes[r].steps;
      for (let k = 1; k < steps.length; k++) {
        const a = ORDER.indexOf(steps[k - 1].move), b = ORDER.indexOf(steps[k].move), turn = !!steps[k].turn;
        const d = (b - a + 6) % 6, cw = d <= 3, n = cw ? d : 6 - d, dir = cw ? 1 : -1;
        const segs = Array.from({ length: n }, (_, j) => (cw ? a + j : a - j - 1 + 12) % 6);
        const kind = turn ? "turn" : "fwd";
        const depth = Math.min(2, Math.max(0, ...segs.map(s => used[kind + s] || 0)));
        segs.forEach(s => { used[kind + s] = depth + 1; });
        const off = LANE[kind] + depth * LANE.lap;
        // leave the move, ease onto the orbit, travel it, ease back into the next move
        const P = th => [cx + (rx + off) * Math.cos(th), cy + (ry + off) * Math.sin(th)];
        const tan = th => { const x = -(rx + off) * Math.sin(th) * dir, y = (ry + off) * Math.cos(th) * dir, l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
        const unit = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
        const thA = angle(a), thB = thA + dir * n * Math.PI / 3, delta = Math.min(Math.PI / 12, n * Math.PI / 12);
        const th1 = thA + dir * delta, th2 = thB - dir * delta;
        const S = toward(at(a), P(thA), orbR + 5), E = toward(at(b), P(thB), orbR + 9);
        const outA = unit(at(a), P(thA)), outB = unit(at(b), P(thB));
        const p1 = P(th1), p2 = P(th2), t1 = tan(th1), t2 = tan(th2), bend = Math.max(14, Math.abs(off) * 0.55);
        const add = (p, v, m) => [p[0] + v[0] * m, p[1] + v[1] * m];
        let dStr = `M${f(S)} C${f(add(S, outA, bend))} ${f(add(p1, t1, -bend))} ${f(p1)}`;
        const pieces = Math.max(1, Math.ceil(Math.abs(th2 - th1) / (Math.PI / 3)));
        for (let j = 1; j <= pieces; j++) dStr += ` A${(rx + off).toFixed(1)} ${(ry + off).toFixed(1)} 0 0 ${cw ? 1 : 0} ${f(P(th1 + (th2 - th1) * j / pieces))}`;
        dStr += ` C${f(add(p2, t2, bend))} ${f(add(E, outB, bend))} ${f(E)}`;
        const id = `hiw-m${k}`;
        edgeG.insertAdjacentHTML("beforeend",
          `<mask id="${id}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="${W + 100}" height="${H + 100}">` +
          `<path d="${dStr}" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/></mask>` +
          `<path class="hiw-edge${turn ? " is-turn" : ""}" d="${dStr}" mask="url(#${id})" marker-end="url(#hiw-arrow${turn ? "-turn" : ""})"/>`);
        const path = edgeG.lastElementChild, reveal = $(`#${id} path`, edgeG), len = path.getTotalLength();
        reveal.style.strokeDasharray = `${len + 2} ${len + 2}`;
        let lbl = null;
        if (turn) {
          lbl = document.createElement("span");
          lbl.className = "hiw-turnlbl";
          lbl.textContent = steps[k].turn;
          const mid = path.getPointAtLength(len / 2);
          // narrow maps orbit inside the ring: nudge the label outward so it clears the step number in the middle
          const vx = mid.x - cx, vy = mid.y - cy, vl = Math.hypot(vx, vy) || 1, push = compact ? 26 : 0;
          lbl.style.left = `${(mid.x + vx / vl * push).toFixed(1)}px`; lbl.style.top = `${(mid.y + vy / vl * push).toFixed(1)}px`;
          lbl.style.transition = "none"; // a rebuild (resize) shouldn't fade it in again
          map.appendChild(lbl);
          requestAnimationFrame(() => requestAnimationFrame(() => { lbl.style.transition = ""; }));
        }
        edges.push({ path, reveal, len, lbl });
        // AI's line: the same route, one lane further from the ring, only into steps where AI really helped.
        // Scaling the path about the ring's center moves its orbit out by exactly that lane.
        if (steps[k].ai) {
          const gap = compact ? -11 : 12, sx = (rx + off + gap) / (rx + off), sy = (ry + off + gap) / (ry + off);
          const tx = cx * (1 - sx), ty = cy * (1 - sy);
          aiG.insertAdjacentHTML("beforeend",
            `<mask id="${id}a" maskUnits="userSpaceOnUse" x="-50" y="-50" width="${W + 100}" height="${H + 100}">` +
            `<path d="${dStr}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/></mask>` +
            `<g transform="matrix(${sx.toFixed(4)} 0 0 ${sy.toFixed(4)} ${tx.toFixed(1)} ${ty.toFixed(1)})"><path class="hiw-ai-edge" d="${dStr}" mask="url(#${id}a)"/></g>`);
          const aiPath = $("path.hiw-ai-edge", aiG.lastElementChild), aiReveal = $(`#${id}a path`, aiG), aiLen = aiPath.getTotalLength();
          aiReveal.style.strokeDasharray = `${aiLen + 2} ${aiLen + 2}`;
          aiEdges.push({ path: aiPath, reveal: aiReveal, len: aiLen, sx, sy, tx, ty });
        } else aiEdges.push(null);
      }
      paint(true);
    }
    const setEdge = (e, p) => { e.reveal.style.strokeDashoffset = `${(e.len + 2) * (1 - p)}`; if (e.lbl) e.lbl.classList.toggle("is-on", p > 0.55); };

    /* ---- state. The visitor is always on one step of a guided walk ("walk"), or looking at the whole
       route at rest ("full"). A walk step has two beats: the dot glides to the move (TRAVEL), then the
       step settles in and stays as long as it takes to read. One idea at a time, never a flood. */
    let mode = "walk", walkI = 0, walkT = 0, playing = false, raf = 0, lastTs = 0, openMove = null, pinged = "";
    let interacted = false, viewHold = false, moveResume = false, shown = "", rafSeen = 0, fallback = 0, cycleT = 0;
    const travelOf = i => i === 0 || still() ? 0 : TRAVEL;
    const arrived = () => walkT >= travelOf(walkI);

    function paint(force) {
      const steps = routes[r].steps;
      let current = -1, upto = steps.length - 1, moving = null, summary = false;
      if (mode === "walk") {
        edges.forEach((e, k) => {
          const p = k < walkI - 1 ? 1 : k === walkI - 1 ? (travelOf(walkI) ? glide(clamp(walkT / travelOf(walkI))) : 1) : 0;
          setEdge(e, p);
          if (p > 0 && p < 1) moving = { e, p };
        });
        current = arrived() ? walkI : walkI - 1;
        upto = walkI;
      } else {
        edges.forEach(e => setEdge(e, 1));
        summary = true;
      }
      if (moving) {
        const pt = moving.e.path.getPointAtLength(moving.e.len * moving.p);
        dot.setAttribute("cx", pt.x.toFixed(1)); dot.setAttribute("cy", pt.y.toFixed(1));
      }
      dot.classList.toggle("is-on", !!moving);
      // AI follows LAG behind me (paused, it catches up at once), and pings the move when it arrives
      const tr = travelOf(walkI), aiT = !playing && arrived() ? tr + LAG : walkT;
      let aiMoving = null;
      aiEdges.forEach((e, k) => {
        if (!e) return;
        const p = summary || k < walkI - 1 ? 1 : k === walkI - 1 ? (tr ? glide(clamp((aiT - LAG) / tr)) : 1) : 0;
        e.reveal.style.strokeDashoffset = `${(e.len + 2) * (1 - p)}`;
        if (p > 0 && p < 1) aiMoving = { e, p };
      });
      if (aiMoving) {
        const { e, p } = aiMoving, pt = e.path.getPointAtLength(e.len * p);
        aiDot.setAttribute("cx", (pt.x * e.sx + e.tx).toFixed(1)); aiDot.setAttribute("cy", (pt.y * e.sy + e.ty).toFixed(1));
      }
      aiDot.classList.toggle("is-on", !!aiMoving);
      const here = steps[walkI];
      if (mode === "walk" && !openMove && here && here.ai && arrived() && aiT >= tr + LAG && pinged !== `${r}:${walkI}`) {
        pinged = `${r}:${walkI}`;
        ping(here.move);
      }
      ORDER.forEach(m => {
        nodes[m].classList.toggle("is-visited", steps.some(s => s.move === m && s.i <= current));
        nodes[m].classList.toggle("is-current", current >= 0 && steps[current].move === m && !summary);
      });
      steps.forEach((s, i) => {
        const on = i === current && !summary;
        s.el.classList.toggle("is-current", on);
        s.el.classList.toggle("is-future", mode === "walk" && i > current);
        s.el.classList.toggle("is-match", !!openMove && s.move === openMove);
        if (on) s.el.setAttribute("aria-current", "step"); else s.el.removeAttribute("aria-current");
      });
      // the panel changes only when a step arrives (or a move / the summary is picked)
      const shownStep = moving ? `travel:${walkI - 1}` : `step:${current}`;
      const key = `${openMove ? `move:${openMove}` : summary ? "sum" : shownStep}:${r}`;
      if (force || key !== shown) {
        const wasStep = shown.includes("step:") && !openMove && !summary;
        shown = key;
        if (openMove) detail.innerHTML = moveCard(openMove);
        else if (summary) detail.innerHTML = summaryCard();
        else if (moving && wasStep && !force) detail.classList.add("is-leaving"); // the old step fades while the dot travels
        else { detail.classList.remove("is-leaving"); detail.innerHTML = stepCard(steps[current]); }
        if (openMove || summary) detail.classList.remove("is-leaving");
        detail.setAttribute("aria-live", openMove ? "polite" : "off");
        if (openMove || summary) detail.removeAttribute("aria-hidden"); else detail.setAttribute("aria-hidden", "true");
      }
      // at the end of a route, the "Up next" button fills while the next route counts down
      if (mode === "full" && !openMove) {
        const fill = $(".hiw-upnext i", detail);
        if (fill) fill.style.transform = `scaleX(${playing ? clamp(cycleT / NEXT) : 0})`;
      }
      // the progress segment for the current step fills while it's read
      if (mode === "walk" && !openMove) {
        const fill = $(".hiw-prog .is-now i", detail), s = steps[walkI];
        if (fill && s) {
          const span = s.dwell - travelOf(walkI);
          fill.style.transform = `scaleX(${arrived() ? clamp((walkT - travelOf(walkI)) / span) : 1})`;
        }
      }
    }
    let pingTimer = 0;
    function ping(m) {
      if (still()) return;
      clearTimeout(pingTimer);
      ORDER.forEach(x => nodes[x].classList.remove("is-ping"));
      void nodes[m].offsetWidth; // restart the ripple
      nodes[m].classList.add("is-ping");
      pingTimer = setTimeout(() => nodes[m].classList.remove("is-ping"), 1600);
    }

    /* ---- what the panel says */
    const chips = (list, eng) => `<span class="hiw-outs">${list.map(o => `<span class="hiw-out">${esc(o)}</span>`).join("")}${eng ? `<span class="hiw-out is-eng">${svgUse("i-code")}Ready for engineers</span>` : ""}</span>`;
    // Me leads, AI follows: both lines on every card, drawn like the two lines on the map
    function duo(me, ai, none) {
      return `<div class="hiw-duo">` +
        `<p class="hiw-duo-me"><b><i class="hiw-ln" aria-hidden="true"></i>Me</b><span>${esc(me)}</span></p>` +
        `<p class="hiw-duo-ai${ai ? "" : " is-none"}"><b><i class="hiw-ln" aria-hidden="true"></i>AI</b><span>${esc(ai || none)}</span></p></div>`;
    }
    const noAi = isAi => isAi ? "No AI on this step." : "Never AI. This call is mine.";
    function progress(i) {
      const n = routes[r].steps.length;
      return `<div class="hiw-prog" aria-hidden="true">${routes[r].steps.map((s, j) =>
        `<span class="${j < i ? "is-done" : j === i ? "is-now" : ""}${s.turn ? " is-turn" : ""}"><i></i></span>`).join("")}</div>` +
        `<p class="hiw-d-count">Step ${i + 1} of ${n}</p>`;
    }
    function controls(i) {
      const n = routes[r].steps.length;
      return `<div class="hiw-walk">` +
        `<button type="button" class="hiw-wbtn hiw-back"${i === 0 ? " disabled" : ""} aria-label="Previous step">${svgUse("i-arrow")}</button>` +
        `<button type="button" class="hiw-wbtn hiw-next" aria-label="${i === n - 1 ? "Finish" : "Next step"}">${i === n - 1 ? "Finish" : "Next"} ${svgUse("i-arrow")}</button></div>`;
    }
    function stepCard(s) {
      if (!s) return "";
      const info = moveInfo(s.move);
      const more = (s.why ? `<p class="hiw-d-why"><b>Why</b><span>${esc(s.why)}</span></p>` : "") +
        duo(s.me || info.me, s.ai, noAi(info.isAi)) +
        (s.out.length ? `<div class="hiw-d-out"><b>Output</b>${chips(s.out, s.eng)}</div>` : "");
      return `<div class="hiw-d hiw-c">${progress(s.i)}` +
        `<p class="hiw-d-meta"><span class="hiw-d-move">${iconOf(s.move)}${esc(nameOf(s.move))}</span>${s.turn ? `<span class="hiw-c-turn">${esc(s.turn)}</span>` : ""}</p>` +
        `<h4 class="hiw-d-title">${esc(s.label)}</h4><p class="hiw-d-text">${esc(s.text)}</p>` +
        `${more ? `<div class="hiw-d-more">${more}</div>` : ""}${controls(s.i)}</div>`;
    }
    function summaryCard() {
      const rt = routes[r], next = routes[(r + 1) % routes.length];
      return `<div class="hiw-d hiw-c"><p class="hiw-d-meta"><span class="hiw-d-move">${esc(rt.label)}</span><span class="hiw-d-n">${plural(rt.steps.length, "step", "steps")} · ${plural(rt.turns, "loop", "loops")} back · ${rt.ais ? `AI in ${rt.ais}` : "no AI"}</span></p>` +
        `<h4 class="hiw-d-title hiw-sum-title">${esc(rt.title)}</h4>` +
        `${rt.outputs.length ? `<div class="hiw-d-out"><b>What it produced</b>${chips(rt.outputs, rt.steps.some(s => s.eng))}</div>` : ""}` +
        duo(rt.lead || "I lead: who to ask, what’s true and what ships.", rt.ais ? rt.follow || "AI follows with patterns, options, critiques, code and renders." : "", rt.follow || "No AI on this route.") +
        `<div class="hiw-end"><button type="button" class="btn btn-light btn-sm hiw-nextroute hiw-upnext"><i aria-hidden="true"></i><span>Up next: ${esc(next.label)}</span> ${svgUse("i-arrow")}</button>` +
        `<button type="button" class="btn btn-text hiw-restart">${svgUse("i-replay")}Walk through again</button></div></div>`;
    }
    function moveCard(m) {
      const info = moveInfo(m), rt = routes[r];
      const hits = rt.steps.filter(s => s.move === m).map(s => s.i + 1);
      const where = hits.length ? `In ${esc(rt.name)}: step${hits.length > 1 ? "s" : ""} ${listJoin(hits)}` : `Not part of ${esc(rt.name)}`;
      return `<div class="hiw-d hiw-c" role="group" aria-label="${esc(nameOf(m))}"><p class="hiw-d-meta"><span class="hiw-d-move">${iconOf(m)}${esc(nameOf(m))}</span><span class="hiw-d-n">${where}</span></p>` +
        `<h4 class="hiw-d-title">${esc(info.lead)}</h4><p class="hiw-d-text">${esc(info.body)}</p>${duo(info.me, info.isAi ? info.ai : "", noAi(info.isAi))}` +
        `<button type="button" class="hiw-d-x" aria-label="Close ${esc(nameOf(m))}">${svgUse("i-close")}</button></div>`;
    }

    /* ---- playback: driven by animation frames, with a timer as backup for browsers that stop
       sending frames to a visible page (some embedded views, headless test runs) */
    function advance(now) {
      if (!playing) return;
      const dt = lastTs ? Math.min(64, now - lastTs) : 0;
      lastTs = now;
      if (mode === "full") {                       // counting down to the next route
        cycleT += dt;
        if (cycleT >= NEXT) { selectRoute(r + 1, true); return; }
        paint(); return;
      }
      walkT += dt;
      const steps = routes[r].steps, s = steps[walkI];
      if (s && walkT >= s.dwell) {
        if (walkI < steps.length - 1) { walkI++; walkT = 0; }
        else {
          mode = "full"; cycleT = 0;               // keep playing: the summary counts down to the next route
          box.dispatchEvent(new CustomEvent("hiw:complete", { bubbles: true, detail: { project: routes[r].project } }));
          paint(true); syncPlay(); return;
        }
      }
      paint();
    }
    function tick() {
      raf = 0;
      rafSeen = performance.now();
      advance(rafSeen);
      if (playing) raf = requestAnimationFrame(tick);
    }
    function run() {
      lastTs = 0;
      if (!raf) raf = requestAnimationFrame(tick);
      if (!fallback) fallback = setInterval(() => {
        if (!playing) { clearInterval(fallback); fallback = 0; return; }
        const now = performance.now();
        if (document.visibilityState === "visible" && now - rafSeen > 120) advance(now);
      }, 50);
    }
    // go to a step; with travel, the dot glides there first. Auto-advance only when motion is welcome.
    function walk(i, { travel = false, auto = !still() } = {}) {
      moveResume = false; closeMove(); pinged = "";
      mode = "walk"; walkI = clamp(i, 0, routes[r].steps.length - 1); walkT = travel ? 0 : travelOf(walkI);
      playing = auto;
      paint(true); syncPlay();
      if (playing) run();
    }
    function pause() { playing = false; lastTs = 0; syncPlay(); }
    function resume() { if (openMove) { moveResume = false; closeMove(); } playing = true; syncPlay(); run(); }
    function syncPlay() {
      if (!playBtn) return;
      const done = mode !== "walk" && !playing;
      const label = playing ? "Pause" : done ? "Replay" : "Play";
      playBtn.innerHTML = `${svgUse(playing ? "i-pause" : done ? "i-replay" : "i-play")}<span>${label}</span>`;
      playBtn.setAttribute("aria-label", `${label} the ${routes[r].label} walkthrough`);
    }

    /* ---- choosing */
    const stripRow = () => $(".hiw-steps", panels[r]);
    function syncStrip() { const row = stripRow(); if (row) row.classList.toggle("has-more", row.scrollLeft + row.clientWidth < row.scrollWidth - 4); }
    function selectRoute(i, start) {
      r = (i + routes.length) % routes.length;
      tabs.forEach((tb, j) => {
        const on = j === r;
        tb.setAttribute("aria-selected", String(on));
        tb.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (headline) {
        headline.classList.add("is-swapping");
        setTimeout(() => { headline.textContent = routes[r].title; headline.classList.remove("is-swapping"); }, still() ? 0 : 200);
      }
      openMove = null;
      ORDER.forEach(m => nodes[m].setAttribute("aria-expanded", "false"));
      build(); syncStrip();
      if (start) walk(0);
    }
    // a move's card holds the walk while it's open; closing it carries on where the walk was
    function openMoveCard(m) {
      if (!openMove) moveResume = playing;
      pause();
      openMove = openMove === m ? null : m;
      ORDER.forEach(x => nodes[x].setAttribute("aria-expanded", String(x === openMove)));
      paint(true); syncPlay();
      if (!openMove && moveResume) { moveResume = false; resume(); }
    }
    function closeMove(focusNode) {
      if (!openMove) return;
      const m = openMove;
      openMove = null;
      nodes[m].setAttribute("aria-expanded", "false");
      paint(true);
      if (focusNode) nodes[m].focus();
      if (moveResume) { moveResume = false; resume(); }
    }
    const touched = () => { interacted = true; };

    tabs.forEach((tb, i) => {
      tb.addEventListener("click", () => { touched(); if (i !== r) selectRoute(i, true); });
      tb.addEventListener("keydown", e => {
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        let j = k ? (i + k + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
        if (j < 0) return;
        e.preventDefault(); touched(); tabs[j].focus(); selectRoute(j, true);
      });
    });
    routes.forEach(rt => {
      rt.steps.forEach(s => {
        s.el.addEventListener("click", () => { touched(); walk(s.i); });
        s.el.addEventListener("keydown", e => {
          const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!k) return;
          const next = rt.steps[s.i + k];
          if (!next) return;
          e.preventDefault(); touched(); next.el.focus(); walk(next.i, { auto: playing });
          next.el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: still() ? "auto" : "smooth" });
        });
      });
      const row = $(".hiw-steps", rt.panel);
      if (row) row.addEventListener("scroll", syncStrip, { passive: true });
    });
    ORDER.forEach(m => nodes[m].addEventListener("click", () => { touched(); openMoveCard(m); }));
    detail.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      touched();
      if (b.classList.contains("hiw-d-x")) closeMove(true);
      else if (b.classList.contains("hiw-next")) { if (walkI < routes[r].steps.length - 1) walk(walkI + 1, { travel: true }); else { mode = "full"; cycleT = 0; paint(true); syncPlay(); } }
      else if (b.classList.contains("hiw-back")) walk(walkI - 1, { auto: playing });
      else if (b.classList.contains("hiw-nextroute")) selectRoute(r + 1, true);
      else if (b.classList.contains("hiw-restart")) walk(0, { travel: true });
    });
    box.addEventListener("keydown", e => { if (e.key === "Escape" && openMove) { e.preventDefault(); closeMove(true); } });
    // it keeps playing under the mouse; Pause is the one control that stops it
    const card = $(".hiw-card", box) || box;
    if (playBtn) playBtn.addEventListener("click", () => {
      touched();
      if (playing) pause();
      else if (mode === "walk") resume();
      else walk(0, { travel: true });         // stopped at a summary: walk this route again
    });

    // the tab row scrolls on phones: fade its edge while there's more to see, and keep the chosen tab in view
    const tabRow = tabs[0].parentElement;
    const syncTabs = () => tabRow.classList.toggle("has-more", tabRow.scrollLeft + tabRow.clientWidth < tabRow.scrollWidth - 4);
    tabRow.addEventListener("scroll", syncTabs, { passive: true });
    onResize.push(syncTabs, syncStrip);
    tabs.forEach(tb => tb.addEventListener("click", () => {
      const a = tb.offsetLeft, b = a + tb.offsetWidth;
      if (a < tabRow.scrollLeft || b > tabRow.scrollLeft + tabRow.clientWidth) tabRow.scrollTo({ left: a - 12, behavior: still() ? "auto" : "smooth" });
    }));

    /* ---- start: at step 1 and still until the card is on screen, then the walk begins on its own */
    panels.forEach((p, j) => { p.hidden = j !== r; });
    box.classList.add("is-live");
    layout();
    const qaStep = capture && +(new URLSearchParams(location.search).get("hiw-step") || 0);
    if (qaStep) { mode = "walk"; walkI = clamp(qaStep - 1, 0, routes[r].steps.length - 1); walkT = travelOf(walkI); paint(true); }
    else if (capture) { mode = "full"; paint(true); }
    else {
      mode = "walk"; walkI = 0; walkT = 0; paint(true);
      if (!still()) {
        // begin once the card's top passes three quarters of the way up the screen, however tall it is
        const io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          if (!interacted) walk(0);
        }, { rootMargin: "0px 0px -25% 0px", threshold: 0 });
        io.observe(card);
      }
    }
    // scrolled away: hold, so nothing plays unseen; back on screen: carry on where it was
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && playing) { viewHold = true; pause(); }
      else if (e.isIntersecting && viewHold) { viewHold = false; if (!openMove) resume(); }
    }, { threshold: 0 }).observe(card);
    syncPlay(); syncTabs(); syncStrip();
    if (reduce.addEventListener) reduce.addEventListener("change", () => { if (reduce.matches) { pause(); paint(true); } });
    let rz = 0;
    const relayout = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); };
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(map); else onResize.push(relayout);
  });

  /* ---------------------------------------------------------------- copy to clipboard */
  feature("copy", () => {
    $$("[data-copy]").forEach(btn => btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try { await navigator.clipboard.writeText(text); } catch {
        const ta = Object.assign(document.createElement("textarea"), { value: text });
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.append(ta); ta.select();
        try { document.execCommand("copy"); } catch { /* ignore */ }
        ta.remove();
      }
      btn.classList.add("is-copied");
      toast(text.includes("@") ? "Email copied" : "Copied");
      setTimeout(() => btn.classList.remove("is-copied"), 1800);
    }));
  });

  /* ---------------------------------------------------------------- dialogs: live preview + film */
  feature("dialogs", () => {
    const sheet = $("#sheet"), film = $("#film");
    const sheetFrame = sheet && $(".sheet-frame iframe", sheet);
    const filmVideo = film && $("video", film);
    let lastFocus = null, openDialog = null;

    function fitPhone() {
      if (!sheet || !sheet.classList.contains("is-phone")) return;
      const body = $(".sheet-body", sheet);
      const s = Math.min(1, (body.clientHeight - 64) / 844, (body.clientWidth - 48) / 390);
      sheetFrame.style.setProperty("--ps", s.toFixed(4));
    }
    onResize.push(fitPhone);
    function show(dlg) {
      lastFocus = document.activeElement;
      openDialog = dlg;
      dlg.hidden = false;
      root.style.overflow = "hidden";
      requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add("is-open")));
      setTimeout(() => dlg.classList.add("is-open"), 60);
      const first = $("[data-close]:not(.sheet-backdrop)", dlg) || dlg;
      setTimeout(() => first.focus({ preventScroll: true }), 50);
    }
    function hide(dlg, after) {
      dlg.classList.remove("is-open");
      root.style.overflow = "";
      openDialog = null;
      setTimeout(() => { dlg.hidden = true; if (after) after(); }, reduce.matches ? 0 : 450);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    if (sheet && sheetFrame) {
      // Read at click time, so buttons whose target changes (the showcase's "Try it live") stay right.
      const openLive = btn => {
        const src = btn.dataset.live;
        if (!src) return;
        const title = btn.dataset.liveTitle || "Live preview";
        sheet.classList.remove("is-loaded");
        sheet.classList.toggle("is-phone", btn.dataset.liveDevice === "phone");
        const t = $(".sheet-title", sheet), u = $(".sheet-url", sheet), o = $(".sheet-open", sheet), l = $(".sheet-loading-text", sheet);
        if (t) t.textContent = title;
        if (u) u.textContent = urlFor(src.replace(/#.*$/, ""));
        if (o) o.href = src;
        if (l) l.textContent = `Loading ${title}`;
        sheetFrame.title = `${title}, live`;
        sheetFrame.onload = () => { applyEmbed(sheetFrame, btn.dataset.embed); sheet.classList.add("is-loaded"); };
        sheetFrame.src = src;
        show(sheet);
        requestAnimationFrame(fitPhone);
        setTimeout(fitPhone, 80);
      };
      $$("[data-live]").forEach(btn => btn.addEventListener("click", () => openLive(btn)));
      $$("[data-close]", sheet).forEach(el => el.addEventListener("click", () => hide(sheet, () => { sheetFrame.src = "about:blank"; })));
    }
    if (film && filmVideo) {
      $$("[data-film]").forEach(btn => btn.addEventListener("click", () => {
        filmVideo.poster = btn.dataset.poster || "";
        filmVideo.src = btn.dataset.film;
        show(film);
        filmVideo.play().catch(() => {});
      }));
      $$("[data-close]", film).forEach(el => el.addEventListener("click", () => hide(film, () => {
        filmVideo.pause(); filmVideo.removeAttribute("src"); filmVideo.load();
      })));
    }

    document.addEventListener("keydown", e => {
      if (!openDialog) {
        if (e.key === "Escape" && ui.closeMenu) ui.closeMenu();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const close = $("[data-close]", openDialog);
        if (close) close.click();
        return;
      }
      if (e.key === "Tab") { // keep focus inside the dialog
        const focusables = $$("a[href], button:not([hidden]), iframe, video[controls]", openDialog).filter(el => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  });

  /* ---------------------------------------------------------------- arriving at #section
     A case study's "Back to portfolio" or a shared link: land on it once the layout is final
     (the browser's own jump can be lost). */
  feature("hash", () => {
    if (!location.hash || capture) return;
    const land = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id && document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    };
    addEventListener("load", () => { land(); setTimeout(land, 300); });
  });

  /* ---------------------------------------------------------------- the loop */
  let ticking = false;
  const runFrame = () => {
    ticking = false;
    onFrame.forEach(fn => { try { fn(); } catch (err) { console.error("[portfolio] frame:", err); } });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(runFrame); } }, { passive: true });
  addEventListener("resize", () => {
    onResize.forEach(fn => { try { fn(); } catch (err) { console.error("[portfolio] resize:", err); } });
    runFrame();
  });
  runFrame();

  // for tools/check.py: did every feature start?
  root.dataset.portfolio = failed.length ? "errors" : "ok";
  if (failed.length) root.dataset.portfolioErrors = failed.join(",");
})();
