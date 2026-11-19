/* ==========================================================================
   EDIT HERE — your links. Leave a value empty ("") to hide it.
   LINKEDIN : full LinkedIn profile URL
   RESUME   : path to your CV, e.g. "assets/Arun-Pandi-CV.pdf"
   DEMOS    : demo video link per project (YouTube / Google Drive)
   ========================================================================== */
const LINKEDIN = "";
const RESUME = "";
const DEMOS = {
  "ar-business-card": "",
  "ar-smartwatch": "",
  "vr-warehouse-binning": "",
  "bopt-simulator": "",
  "mixed-reality": "",
};

(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const narrow = () => innerWidth <= 820;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- config ---------- */
  if (LINKEDIN) { $("#linkedin").href = LINKEDIN; $("#linkedin-line").hidden = false; }
  if (RESUME) { const r = $("#resume"); r.href = RESUME; r.setAttribute("download", ""); r.hidden = false; }
  Object.entries(DEMOS).forEach(([id, url]) => {
    if (!url) return;
    const t = $(`#${id} .proj__text`); if (!t) return;
    const a = document.createElement("a");
    a.className = "btn btn--solid magnet demo-btn"; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Watch demo video";
    t.appendChild(a);
  });

  /* ---------- text splitting ---------- */
  $$("[data-split]").forEach((el) => {
    const txt = el.textContent; el.textContent = ""; const sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = txt; el.appendChild(sr);
    [...txt].forEach((c, i) => {
      const w = document.createElement("span"); w.className = "ch-wrap"; w.setAttribute("aria-hidden", "true");
      const s = document.createElement("span"); s.className = "ch"; s.textContent = c === " " ? " " : c; s.style.transitionDelay = `${i * 45}ms`;
      w.appendChild(s); el.appendChild(w);
    });
  });
  $$("[data-split-lines]").forEach((el) => {
    const full = el.textContent.trim(), words = full.split(/\s+/); el.textContent = ""; const sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = full; el.appendChild(sr);
    words.forEach((wd, i) => {
      const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
      const s = document.createElement("span"); s.textContent = wd; s.style.transitionDelay = `${i * 60}ms`;
      w.appendChild(s); el.appendChild(w); el.appendChild(document.createTextNode(" "));
    });
  });
  const manWords = [];
  $$("[data-words]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/); el.textContent = "";
    words.forEach((wd) => { const s = document.createElement("span"); s.className = "mw"; s.textContent = wd + " "; el.appendChild(s); manWords.push(s); });
  });

  /* ---------- point cloud ---------- */
  let cloud = null, cloudOpts = null;
  try {
    const cv = $(".stage");
    cloudOpts = { count: narrow() ? 11000 : 26000, maxDpr: narrow() ? 1.5 : 2, size: narrow() ? 3.8 : 3.7 };
    cloud = window.PointCloud && PointCloud.create(cv, cloudOpts);
  } catch (e) { cloud = null; }
  if (!cloud) html.classList.add("no-webgl");
  // scanned models replace the hand-built headset and pallet truck as soon as they arrive (hand-built ones stay as fallback)
  if (cloud) {
    cloud.load("headset", "assets/models/quest.pts", 0.06).catch(() => {});
    cloud.load("truck", "assets/models/bopt.pts", 0.06).catch(() => {});
  }

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href"); if (id.length < 2) return;
      const t = $(id); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.6, force: true });
    }));
  }
  const stopScroll = (on) => { if (lenis) on ? lenis.stop() : lenis.start(); };

  /* ---------- reveal on enter ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  const watchReveals = () => $$("[data-split-lines], .proj, [data-clip], .contact [data-split]").forEach((el) => io.observe(el));

  /* ---------- counters ---------- */
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    if (reduce) return;
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(tick); };
    el.textContent = "0"; requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach((el) => cio.observe(el));

  /* ---------- boot: name rises, the headset assembles behind it, the visor seam flashes and splits open ---------- */
  let intro = reduce ? 1 : 0, introStart = 0;
  const boot = $(".boot"), bootUI = $(".boot-ui"), nEl = $("[data-boot-n]"), barEl = $("[data-boot-bar]"), statusEl = $("[data-boot-status]");
  const steps = ["Initialising XR runtime", "Calibrating 6DoF tracking", "Mapping the room", "Rendering point cloud", "Tracking locked"];
  const ready = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  const t0 = performance.now(), dur = reduce ? 1 : 2600;
  let opened = false;
  html.classList.add("is-booting");
  stopScroll(true);
  requestAnimationFrame(() => bootUI.classList.add("is-in"));
  if (!reduce) introStart = performance.now() + 250;
  const loadTick = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, v = Math.round(100 * e);
    nEl.textContent = String(v).padStart(3, "0");
    barEl.style.transform = `scaleX(${e})`;
    statusEl.textContent = steps[Math.min(steps.length - 1, Math.floor(e * (steps.length - 0.01)))];
    if (p < 1) requestAnimationFrame(loadTick); else ready.then(openVisor);
  };
  const openVisor = () => {
    if (opened) return; opened = true;
    statusEl.textContent = steps[steps.length - 1]; nEl.textContent = "100"; barEl.style.transform = "scaleX(1)";
    if (reduce) { finishLoad(); boot.classList.add("is-done"); bootUI.classList.add("is-done"); return; }
    bootUI.classList.add("is-out");
    setTimeout(() => boot.classList.add("is-seal"), 380);
    setTimeout(() => { boot.classList.add("is-open"); bootUI.classList.add("is-done"); finishLoad(); }, 900);
    setTimeout(() => { boot.classList.add("is-done"); html.classList.remove("is-booting"); }, 2250);
  };
  const finishLoad = () => {
    if (html.classList.contains("is-loaded")) return;
    html.classList.add("is-loaded");
    if (reduce) html.classList.remove("is-booting");
    stopScroll(false);
    setTimeout(() => $$(".hero [data-split]").forEach((el) => el.classList.add("is-in")), 450);
    watchReveals();
  };
  requestAnimationFrame(loadTick);
  setTimeout(openVisor, 6000);
  const skip = () => { if (!opened) { introStart = performance.now() - 2400; openVisor(); } };
  bootUI.addEventListener("click", skip); addEventListener("keydown", skip, { once: true });

  /* ---------- pointer ---------- */
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, nmx = 9, nmy = 9, moved = false;
  const cur = $(".cursor"), ring = $(".cursor__ring"), dot = $(".cursor__dot"), clabel = $("[data-cursor-label]");
  if (fine && !reduce) {
    html.classList.add("has-cursor");
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; moved = true; }, { passive: true });
    document.addEventListener("pointerover", (e) => {
      const view = e.target.closest("[data-full]"), link = e.target.closest("a,button,summary");
      cur.classList.toggle("is-view", !!view); cur.classList.toggle("is-link", !view && !!link);
      clabel.textContent = view ? "View" : "";
    });
    $$(".magnet").forEach((b) => {
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.3}px`); b.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.4}px`); });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
  }

  /* ---------- text scramble on nav hover ---------- */
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>";
  $$("[data-scramble]").forEach((a) => {
    const orig = a.textContent; let raf;
    a.addEventListener("mouseenter", () => {
      if (reduce) return; let f = 0; cancelAnimationFrame(raf);
      const step = () => { a.textContent = [...orig].map((c, i) => (i < f / 2 ? c : glyphs[(Math.random() * glyphs.length) | 0])).join(""); f++; if (f / 2 <= orig.length) raf = requestAnimationFrame(step); else a.textContent = orig; };
      step();
    });
  });

  /* ---------- scroll-driven pieces ---------- */
  const shapeSecs = $$("[data-shape]");
  const nav = $(".nav"), navLinks = $$(".nav__links a"), navTargets = navLinks.map((a) => $(a.getAttribute("href")));
  const man = $(".manifesto"), workIdx = $(".work__index"), workN = $("[data-proj-n]"), projs = $$(".proj");
  const sectors = $(".sectors"), htrack = $("[data-htrack]"), tl = $("[data-tl]"), par = $("[data-parallax]"), ticker = $("[data-ticker]");
  const coords = $("[data-coords]");
  let lastY = scrollY, vel = 0, tickX = 0, sectorDist = 0;

  // duplicate ticker content for a seamless loop
  if (ticker) ticker.innerHTML += ticker.innerHTML;

  const layout = () => {
    if (cloud) cloud.resize();
    if (sectors && htrack) {
      if (narrow()) { sectors.style.height = ""; sectorDist = 0; }
      else {
        const ml = parseFloat(getComputedStyle(htrack).marginLeft) || 0;
        sectorDist = Math.max(0, ml + htrack.scrollWidth - innerWidth + 40);
        sectors.style.height = `${sectorDist + innerHeight}px`;
      }
    }
  };
  layout();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });

  const read = (el, k, mk, d) => { const v = narrow() && el.dataset[mk] !== undefined ? el.dataset[mk] : el.dataset[k]; return v === undefined ? d : parseFloat(v); };
  let pSmooth = 0;

  function scrollWork(y) {
    const vh = innerHeight;
    // nav hide/show
    const dy = y - lastY; vel = lerp(vel, dy, 0.2); lastY = y;
    if (y > 240 && dy > 2) nav.classList.add("is-hidden"); else if (dy < -2 || y < 240) nav.classList.remove("is-hidden");
    // active nav link
    let cur = -1; navTargets.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.45) cur = i; });
    navLinks.forEach((a, i) => a.classList.toggle("is-active", i === cur));
    // manifesto words
    if (man && manWords.length && !narrow()) {
      const r = man.getBoundingClientRect(), p = clamp(-r.top / (r.height - vh), 0, 1);
      const lit = Math.floor(p * 1.15 * manWords.length);
      manWords.forEach((w, i) => w.classList.toggle("on", i < lit));
    }
    // project counter
    let on = false;
    projs.forEach((pr) => { const r = pr.getBoundingClientRect(); if (r.top < vh * 0.55 && r.bottom > vh * 0.45) { on = true; workN.textContent = pr.dataset.n; } });
    workIdx.classList.toggle("on", on);
    // pinned horizontal sectors
    if (sectors && htrack && sectorDist) {
      const r = sectors.getBoundingClientRect(), p = clamp(-r.top / (r.height - vh), 0, 1);
      htrack.style.transform = `translate3d(${-p * sectorDist}px,0,0)`;
    }
    // timeline fill
    if (tl) { const r = tl.getBoundingClientRect(); tl.style.setProperty("--fill", clamp((vh * 0.85 - r.top) / (vh * 0.6), 0, 1).toFixed(3)); }
    // parallax
    if (par) { const r = par.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) par.style.setProperty("--py", `${(-8 + ((r.top + r.height / 2 - vh / 2) / vh) * -8).toFixed(2)}%`); }
  }

  /* ---------- the loop ---------- */
  const state = { from: "headset", to: "headset", mix: 0, time: 0, scale: 1, offX: 0, offY: 0, rotX: 0.15, rotY: 0, mouseX: 9, mouseY: 9, alpha: 1, jitter: reduce ? 0 : 1, scan: 0 };
  let visible = true;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; });

  let fCount = 0, fLast = 0, fSum = 0, degraded = false;
  function frame(t) {
    requestAnimationFrame(frame);
    if (cloud && !degraded && html.classList.contains("is-loaded")) {
      if (fLast) { fSum += t - fLast; fCount++; }
      fLast = t;
      if (fCount === 90) { if (fSum / fCount > 24) { degraded = true; cloudOpts.maxDpr = 1; cloud.resize(); } fCount = 0; fSum = 0; }
    }
    if (lenis) lenis.raf(t);
    if (!visible) return;
    const y = lenis ? lenis.scroll : scrollY;
    scrollWork(y);

    // ticker: base drift + scroll velocity, with skew
    if (ticker && !reduce) {
      tickX -= 0.6 + Math.abs(vel) * 0.35;
      const half = ticker.scrollWidth / 2; if (-tickX > half) tickX += half;
      ticker.style.transform = `translate3d(${tickX}px,0,0) skewX(${clamp(-vel * 0.4, -12, 12)}deg)`;
    }

    // cursor
    if (fine && !reduce) {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      clabel.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
      nmx = lerp(nmx === 9 ? 0 : nmx, (mx / innerWidth) * 2 - 1, 0.08);
      nmy = lerp(nmy === 9 ? 0 : nmy, -((my / innerHeight) * 2 - 1), 0.08);
    }

    if (!cloud) return;
    // which two shapes are we between?
    const vc = innerHeight / 2, centers = shapeSecs.map((s) => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    let p = 0;
    if (vc <= centers[0]) p = 0;
    else if (vc >= centers[centers.length - 1]) p = centers.length - 1;
    else for (let i = 0; i < centers.length - 1; i++) if (vc >= centers[i] && vc < centers[i + 1]) { p = i + (vc - centers[i]) / (centers[i + 1] - centers[i]); break; }
    pSmooth = reduce ? p : lerp(pSmooth, p, 0.12);
    const i = Math.min(Math.floor(pSmooth), shapeSecs.length - 1), j = Math.min(i + 1, shapeSecs.length - 1), k = smooth(0.18, 0.82, pSmooth - i);
    const A = shapeSecs[i], B = shapeSecs[j];
    const time = t / 1000;
    state.from = A.dataset.shape; state.to = B.dataset.shape; state.mix = k;
    state.offX = lerp(read(A, "x", "mx", 0), read(B, "x", "mx", 0), k);
    state.offY = lerp(read(A, "y", "my", 0), read(B, "y", "my", 0), k);
    state.scale = lerp(read(A, "s", "ms", 1), read(B, "s", "ms", 1), k);
    state.alpha = lerp(read(A, "a", "a", 1), read(B, "a", "a", 1), k) * (narrow() && A.classList.contains("proj") ? 0.9 : 1);

    // assemble from dust on first load
    if (intro < 1 && introStart) {
      intro = clamp((performance.now() - introStart) / 2400, 0, 1);
      if (pSmooth < 0.2) { state.from = "dust"; state.to = "headset"; state.mix = intro; }
    }

    state.time = time;
    const baseRy = lerp(read(A, "ry", "ry", 0.35), read(B, "ry", "ry", 0.35), k), swing = lerp(read(A, "sw", "sw", 0.55), read(B, "sw", "sw", 0.55), k);
    state.rotY = (reduce ? baseRy : Math.sin(time * 0.22) * swing + baseRy) + nmx * 0.35 * (fine ? 1 : 0);
    state.rotX = lerp(read(A, "rx", "rx", 0.18), read(B, "rx", "rx", 0.18), k) - nmy * 0.18 * (fine ? 1 : 0);
    state.mouseX = fine && moved ? nmx : 9; state.mouseY = fine && moved ? nmy : 9;
    state.scan = reduce ? -9 : ((time * 0.32) % 1) * 3.4 - 1.7;
    cloud.render(state);

    if (coords && fine) coords.textContent = `X ${(nmx * 2.35).toFixed(2).padStart(5, " ")}  Y ${(nmy * 1.32).toFixed(2).padStart(5, " ")}  Z ${(4.2 + pSmooth * 0.4).toFixed(2)}`;
  }
  requestAnimationFrame(frame);

  /* ---------- menu (phones and tablets) ---------- */
  const menuBtn = $(".nav__menu"), menu = $("#menu");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", open); menuBtn.querySelector(".sr-only").textContent = open ? "Close menu" : "Open menu";
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add("is-open")); stopScroll(true); }
    else { menu.classList.remove("is-open"); stopScroll(false); setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 800); }
  };
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); e.stopImmediatePropagation(); setMenu(false);
    const t = $(a.getAttribute("href"));
    setTimeout(() => (lenis ? lenis.scrollTo(t, { duration: 1.4 }) : t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })), 60);
  }, true));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") { setMenu(false); menuBtn.focus(); } });

  /* ---------- lightbox ---------- */
  const lb = $("#lightbox"), lbImg = $("#lb-img"), lbT = $("#lb-title"), lbC = $("#lb-cap"), lbN = $("#lb-count");
  let group = [], idx = 0, gTitle = "";
  const show = (n) => { idx = (n + group.length) % group.length; const b = group[idx]; lbImg.src = b.dataset.full; lbImg.alt = b.querySelector("img").alt; lbT.textContent = gTitle; lbC.textContent = b.dataset.caption || ""; lbN.textContent = `${idx + 1} / ${group.length}`; };
  $$("[data-gallery]").forEach((g) => { const items = $$("[data-full]", g); items.forEach((b, i) => b.addEventListener("click", () => { group = items; gTitle = g.dataset.gallery; show(i); stopScroll(true); lb.showModal ? lb.showModal() : lb.setAttribute("open", ""); })); });
  lb.addEventListener("close", () => stopScroll(false));
  $(".lb-prev").addEventListener("click", () => show(idx - 1));
  $(".lb-next").addEventListener("click", () => show(idx + 1));
  $(".lb-close").addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); });
  let sx = 0; lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });

  /* ---------- copy ---------- */
  const toast = $(".toast"); let tt;
  const say = (m) => { toast.textContent = m; toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 1800); };
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say("Copied to clipboard"); }
    catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say("Selected. Press Ctrl/Cmd + C"); }
  }));
})();
