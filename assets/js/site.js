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
    $$(".role-head").forEach((btn, i) => {
      if (i === 0) btn.setAttribute("aria-expanded", "true");
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
