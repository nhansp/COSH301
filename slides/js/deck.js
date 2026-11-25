/*
 * Deck runtime. Slides live in content/*.md (listed in content/index.json); see md.js for the syntax.
 *
 *   === id=hold layout=default tone=paper speaker=huy kicker="Dữ liệu" time=60
 *   body in Markdown ("|||" splits columns)
 *   NOTES:
 *   speaker notes, shown in /presenter and /ctl
 *
 * Attributes: id, layout (default|title|section|diagram|quote|demo-steps|demo-all), tone (paper|ink|stage),
 *             speaker, kicker, time (seconds), cols (CSS grid columns), badge, no, title (outline label),
 *             figh (max figure height in px).
 * Demo slides are generated from media/demo/manifest.json, one per chapter, each playing only its segment.
 * Query: ?preview renders a read-only copy for the remote views; ?chips shows speaker chips.
 */
(function () {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const PREVIEW = Q.has("preview");
  const LIVE = location.protocol.startsWith("http");
  const deck = document.getElementById("deck");
  const root = document.documentElement;
  if (PREVIEW) root.classList.add("preview");
  if (Q.has("chips")) { root.classList.add("chips"); document.body.classList.add("chips"); }

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const fmt = t => { t = Math.max(0, t); return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const json = url => fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(url); return r.json(); });
  const text = url => fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(url); return r.text(); });

  let index = { speakers: {}, files: [] };
  let manifest = null;
  const slides = [];   // { el, attrs, notes, title, section }
  let cur = 0;
  let ready = false;

  // ---- source parsing -------------------------------------------------------------------------------------

  function parseAttrs(s) {
    const a = {};
    (s.match(/[\w-]+=(?:"[^"]*"|\S+)/g) || []).forEach(p => {
      const k = p.slice(0, p.indexOf("="));
      a[k] = p.slice(k.length + 1).replace(/^"|"$/g, "");
    });
    return a;
  }

  function parseFile(src, section) {
    const out = [];
    let curSlide = null;
    src.replace(/\r/g, "").split("\n").forEach(line => {
      const m = /^===\s*(.*)$/.exec(line);
      if (m) { curSlide = { attrs: parseAttrs(m[1]), body: [], section }; out.push(curSlide); }
      else if (curSlide) curSlide.body.push(line);
    });
    return out.map(s => {
      const lines = s.body;
      const n = lines.findIndex(l => /^NOTES:\s*$/.test(l));
      const notes = n >= 0 ? lines.slice(n + 1).join("\n").trim() : "";
      return { attrs: s.attrs, md: (n >= 0 ? lines.slice(0, n) : lines).join("\n"), notes, section: s.section };
    });
  }

  // ---- slide DOM ------------------------------------------------------------------------------------------

  function chip(speaker) {
    const sp = index.speakers[speaker];
    return '<div class="chip" data-speaker="' + esc(speaker || "") + '"' + (sp ? ' style="--c:' + sp.color + '"' : "") +
      "><i></i>" + esc(sp ? sp.short : speaker || "") + "</div>";
  }

  function build(def, n, total) {
    const a = def.attrs;
    const layout = a.layout || "default";
    const tone = a.tone || (layout === "title" || layout === "section" ? "ink" : layout.startsWith("demo") ? "stage" : "ink");
    const el = document.createElement("section");
    el.className = "slide layout-" + (layout.startsWith("demo") ? "demo" : layout) + (layout === "demo-all" ? " all" : "");
    el.dataset.tone = tone;
    if (a.speaker) el.dataset.speaker = a.speaker;
    el.dataset.id = a.id || "s" + n;
    if (a.figh) el.style.setProperty("--fig-h", a.figh + "px");

    let body = def.html != null ? def.html : (/^\|\|\|\s*$/m.test(def.md) ? columns(def.md, a.cols) : md.render(def.md));
    const kick = a.kicker ? '<div class="kicker"><span class="no">' + String(def.secNo || "").padStart(2, "0") + "</span>" + esc(a.kicker) + "</div>" : "";
    const foot = '<div class="foot"><span>' + esc(def.section || "COSH301 · EventTicketing") + "</span><b>" + n + " / " + total + "</b></div>";
    const badge = a.badge ? '<div class="badge pill ' + esc(a.badge.split(":")[0]) + '">' + esc(a.badge.split(":")[1] || "") + "</div>" : "";

    if (layout === "title") {
      el.innerHTML = '<div class="seatgrid"></div><div class="t-wrap">' + body + "</div>" + chip(a.speaker);
      seatgrid($(".seatgrid", el));
    } else if (layout === "section") {
      el.innerHTML = '<div class="no">' + esc(a.no || "") + "</div>" + kick + body + chip(a.speaker) + foot;
    } else if (layout.startsWith("demo")) {
      el.innerHTML = body + chip(a.speaker) + foot;
    } else {
      el.innerHTML = kick + badge + body + chip(a.speaker) + foot;
    }
    // LaTeX: <div class="tex"> for display formulas, <span class="texi"> inline.
    if (window.katex) el.querySelectorAll(".tex, .texi").forEach(m => {
      katex.render(m.textContent, m, { displayMode: m.classList.contains("tex"), throwOnError: false, strict: "ignore" });
    });
    return el;
  }

  function columns(mdSrc, tpl) {
    const parts = mdSrc.split(/^\|\|\|\s*$/m);
    const style = tpl ? ' style="--cols:' + esc(tpl) + '"' : "";
    // everything before the first separator spans the slide when it opens with a heading
    let head = "";
    if (/^\s*#{1,3}\s/.test(parts[0])) head = md.render(parts.shift());
    return head + '<div class="cols"' + style + ">" + parts.map(p => '<div class="col">' + md.render(p) + "</div>").join("") + "</div>";
  }

  function seatgrid(el) {
    // The title backdrop plays the seat map: a cursor picks a free seat, holds it, and some holds end up sold.
    const COLS = 34, ROWS = 8, GAP = 56;
    const seats = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = document.createElement("i");
      i.className = Math.random() < 0.18 ? "s-sold" : "s-free";
      i.style.left = 28 + GAP * x + "px"; i.style.top = 28 + GAP * y + "px";
      el.appendChild(i); seats.push(i);
    }
    const free = () => seats.filter(s => s.className === "s-free");
    const step = () => {
      if (document.hidden || !el.closest(".slide").classList.contains("is-active")) return;
      const pool = free();
      if (pool.length < seats.length * 0.25) seats.forEach(s => { s.className = Math.random() < 0.18 ? "s-sold" : "s-free"; });
      const seat = pool[Math.floor(Math.random() * pool.length)];
      if (!seat) return;
      seat.className = "s-pick";
      setTimeout(() => { seat.className = "s-held"; }, 700);
      setTimeout(() => { seat.className = Math.random() < 0.6 ? "s-sold" : "s-free"; }, 2600 + Math.random() * 1800);
    };
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(step, 420);
  }

  // ---- components inside slides ---------------------------------------------------------------------------

  function mountComponents(el) {
    $$(".comp", el).forEach(c => {
      const name = c.dataset.comp;
      if (name === "legend") {
        c.className = "legend";
        c.innerHTML = '<span><i class="seat"></i>Còn trống</span><span><i class="seat mine"></i>Bạn đang giữ</span><span><i class="seat held"></i>Người khác giữ</span><span><i class="seat sold"></i>Đã bán</span>';
      }
    });
  }

  // ---- demo: one shared <video>, each slide plays its own segment -----------------------------------------

  const demo = { video: null, seg: null, raf: 0, slot: null };

  function ensureVideo() {
    if (demo.video || PREVIEW || !manifest) return demo.video;
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.controls = false;
    v.src = "media/demo/" + manifest.video;
    v.addEventListener("error", () => { if (demo.slot) demo.slot.classList.add("missing"); });
    demo.video = v;
    return v;
  }

  function enterDemo(slide) {
    const slot = $(".vslot", slide.el);
    if (!slot || !ensureVideo()) return;
    demo.slot = slot;
    slot.classList.remove("missing");
    slot.insertBefore(demo.video, slot.firstChild);
    if (demo.video.error) slot.classList.add("missing");
    const dur = () => demo.video.duration || manifest.duration || 0;
    const s = +slot.dataset.start || 0;
    const e = slot.dataset.end ? +slot.dataset.end : null;
    demo.seg = { s, e: e == null ? dur() : e, open: e == null, slot, slide };
    playSegment();
  }

  function playSegment() {
    const sg = demo.seg, v = demo.video;
    if (!sg || !v) return;
    cancelAnimationFrame(demo.raf);
    const go = () => {
      if (sg.open) sg.e = v.duration || sg.e;
      v.currentTime = sg.s;
      sg.slot.classList.remove("paused");
      v.play().catch(() => sg.slot.classList.add("paused"));
      tick();
    };
    if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
  }

  function tick() {
    const sg = demo.seg, v = demo.video;
    if (!sg) return;
    const t = v.currentTime;
    const span = Math.max(0.01, sg.e - sg.s);
    const fill = $(".fill", sg.slide.el);
    if (fill) fill.style.width = Math.min(100, Math.max(0, (t - sg.s) / span * 100)) + "%";
    const tc = $(".tcur", sg.slide.el);
    if (tc) tc.textContent = fmt(t - (sg.open ? 0 : sg.s));
    if (t >= sg.e - 0.04 || v.ended) {
      // stop on the last frame of the segment, not the first of the next one
      v.pause();
      v.currentTime = Math.max(sg.s, sg.e - 0.05);
      sg.slot.classList.add("paused");
      if (fill) fill.style.width = "100%";
      return;
    }
    demo.raf = requestAnimationFrame(tick);
  }

  function leaveDemo() {
    cancelAnimationFrame(demo.raf);
    if (demo.video) demo.video.pause();
    demo.seg = null;
  }

  function toggleDemo() {
    const sg = demo.seg, v = demo.video;
    if (!sg || !v) return;
    if (v.paused) {
      if (v.currentTime >= sg.e - 0.1) return playSegment();
      sg.slot.classList.remove("paused");
      v.play().catch(() => {});
      cancelAnimationFrame(demo.raf);
      tick();
    } else {
      v.pause();
      sg.slot.classList.add("paused");
      cancelAnimationFrame(demo.raf);
    }
  }

  function demoSlides() {
    const m = manifest;
    if (!m || !Array.isArray(m.chapters) || !m.chapters.length) {
      return [{ attrs: { id: "demo-missing", layout: "default", tone: "stage", kicker: "Demo trực tiếp", speaker: "nhan" },
        md: "## Chưa có video demo\n\nĐặt `media/demo/e2e.mp4` và `media/demo/manifest.json`, xem `slides/README.md`.", notes: "", section: "Demo trực tiếp" }];
    }
    const n = m.chapters.length;
    return m.chapters.map((c, i) => {
      const dur = Math.max(0, c.end - c.start);
      const rail = m.chapters.map((_, j) => '<i class="' + (j < i ? "done" : j === i ? "cur" : "") + '"></i>').join("");
      const html = '<div class="kicker"><span class="no">Demo</span>Trực tiếp · bước ' + (i + 1) + "/" + n + "</div>" +
        "<h2>" + esc(c.title) + "</h2>" +
        '<div class="demo-grid"><div>' + vslot(c.start, c.end) + segBar(c.start, c.end, false) + "</div>" +
        '<div class="demo-side"><div class="rail">' + rail + '</div><div class="step">' + (i + 1) + "<small> / " + n + "</small></div>" +
        (c.pov ? '<div class="pov">Góc nhìn: ' + esc(c.pov) + "</div>" : "") +
        '<div class="cap">' + esc(c.caption || "") + "</div>" + "</div></div>";
      return { attrs: { id: "demo-" + c.id, layout: "demo-step", tone: "stage", speaker: c.speaker || "nhan", time: String(Math.round(dur) + 2), title: "Demo " + (i + 1) + ": " + c.title },
        html, notes: c.notes || c.caption || "", section: "Demo trực tiếp" };
    });
  }

  function vslot(s, e) {
    return '<div class="vslot" data-start="' + s + '"' + (e != null ? ' data-end="' + e + '"' : "") +
      '><div class="vmiss">Chưa có video. Đặt <code>media/demo/' + esc(manifest ? manifest.video : "e2e.mp4") + "</code> (xem slides/README.md).</div>" +
      '<div class="vstate">Đã dừng</div></div>';
  }

  function segBar(s, e, withChapters) {
    let ticks = "", labels = "";
    if (withChapters) {
      const total = manifest.duration || manifest.chapters[manifest.chapters.length - 1].end;
      manifest.chapters.forEach((c, i) => {
        const x = c.start / total * 100;
        if (i) ticks += '<i class="tick" style="left:' + x + '%"></i>';
        labels += '<span style="left:' + ((c.start + (c.end - c.start) / 2) / total * 100) + '%">' + (i + 1) + "</span>";
      });
    }
    return '<div class="seg"><div class="bar"><div class="fill"></div>' + ticks + "</div>" +
      (withChapters ? '<div class="labels">' + labels + "</div>" : "") +
      '<div class="times"><span class="tcur">0:00</span><span>' + (e != null ? fmt(e - s) : "toàn bộ") + "</span></div></div>";
  }

  function demoAll(def) {
        def.html = '<div class="kicker"><span class="no">Demo</span>Trực tiếp · toàn bộ</div><h2>' + esc(def.attrs.title || "Toàn bộ demo") + "</h2>" +
      '<div class="demo-grid"><div>' + vslot(0, null) + (manifest && manifest.chapters ? segBar(0, null, true) : "") + "</div>" +
      '<div class="demo-side"><div class="cap">' + esc(def.attrs.caption || "Chạy liền một mạch, từ trang chủ đến giá mới.") + "</div>" + "</div></div>";
    def.attrs.time = def.attrs.time || "20";   // the video plays alongside the step slides, so it adds little talking time
    return def;
  }

  // ---- navigation -----------------------------------------------------------------------------------------

  function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    const was = slides[cur];
    if (ready && was && n !== cur) leaveDemo();
    cur = n;
    slides.forEach((s, i) => s.el.classList.toggle("is-active", i === cur));
    if (!PREVIEW) {
      const h = "#" + (cur + 1);
      if (location.hash !== h) history.replaceState(null, "", h);
    }
    const s = slides[cur];
    if (!PREVIEW) {
      if (s.attrs.layout && s.attrs.layout.startsWith("demo")) enterDemo(s);
    }
    report();
  }
  const step = d => show(cur + d);

  function go(h) {
    h = String(h || "").replace(/^#/, "");
    if (/^\d+$/.test(h)) return show(parseInt(h, 10) - 1);
    const i = slides.findIndex(s => s.attrs.id === h);
    if (i >= 0) show(i);
  }

  function outline() {
    return slides.map(s => ({ id: s.attrs.id, t: s.title, s: s.attrs.speaker || "", sec: s.section, time: +s.attrs.time || 0 }));
  }

  function report() {
    if (!ready || PREVIEW || !LIVE) return;
    const s = slides[cur], nx = slides[cur + 1];
    fetch("/api/state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slide: cur + 1, total: slides.length, id: s.attrs.id, title: s.title, section: s.section,
        speaker: s.attrs.speaker || "", notes: s.notes, nextTitle: nx ? nx.title : "", nextSpeaker: nx ? nx.attrs.speaker || "" : "",
        outline: outline(), speakers: index.speakers
      })
    }).catch(() => {});
  }

  function fit() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    deck.style.transform = "translate(-50%, -50%) scale(" + k + ")";
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function command(c, to) {
    if (c === "next") step(1);
    else if (c === "prev") step(-1);
    else if (c === "goto") go(to);
    else if (c === "sync") report();
    else if (c === "replay") playSegment();
    else if (c === "toggle") toggleDemo();
  }

  function wire() {
    addEventListener("resize", fit);
    addEventListener("hashchange", () => go(location.hash));
    if (PREVIEW) return;
    addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); step(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); step(-1); }
      else if (k === "Home") show(0);
      else if (k === "End") show(slides.length - 1);
      else if (k === "f") fullscreen();
      else if (k === "s") { document.body.classList.toggle("chips"); root.classList.toggle("chips"); }
      else if (k === "r") playSegment();
      else if (k === "p" || k === "k") toggleDemo();
      else if (k === "m" && demo.video) demo.video.muted = !demo.video.muted;
    });
    addEventListener("click", e => {
      if (e.target.closest("a, video")) return;
      step(e.clientX > innerWidth / 3 ? 1 : -1);
    });
    if (LIVE) {
      const es = new EventSource("/api/events");
      es.addEventListener("cmd", e => { const c = JSON.parse(e.data); command(c.cmd, c.to); });
    }
  }

  // ---- start ----------------------------------------------------------------------------------------------

  async function start() {
    index = await json("content/index.json");
    try { manifest = await json("media/demo/manifest.json"); } catch (e) { manifest = null; }
    const sources = await Promise.all(index.files.map(f => text("content/" + f.file)));

    let defs = [];
    index.files.forEach((f, i) => {
      parseFile(sources[i], f.section).forEach(d => {
        d.secNo = f.no;
        if (d.attrs.layout === "demo-steps") demoSlides().forEach(x => { x.secNo = f.no; defs.push(x); });
        else if (d.attrs.layout === "demo-all") defs.push(demoAll(d));
        else defs.push(d);
      });
    });

    defs.forEach((d, i) => {
      const h = /^\s*#{1,3}\s+(.*)$/m.exec(d.md || "");
      const hh = d.html && /<h2>(.*?)<\/h2>/.exec(d.html);
      d.title = d.attrs.title || (h ? h[1].replace(/[`*]/g, "") : hh ? hh[1] : d.attrs.id || "Slide " + (i + 1));
      d.title = d.title.replace(/<[^>]+>/g, "");
      const el = build(d, i + 1, defs.length);
      mountComponents(el);
      deck.appendChild(el);
      slides.push({ el, attrs: d.attrs, notes: d.notes, title: d.title, section: d.section });
    });
    document.title = "EventTicketing · COSH301";
    fit();
    wire();
    ready = true;
    go(location.hash || "#1");
    if (!location.hash) show(0);
    window.__deck = { slides, show, step, command, get cur() { return cur; }, manifest, demo };
  }

  start().catch(err => {
    console.error(err);
    deck.innerHTML = '<div style="padding:80px;color:#fff;font:36px/1.4 sans-serif">Không tải được nội dung slide: ' + esc(err.message) + "<br>Chạy <code>python3 slides/serve.py</code> rồi mở lại.</div>";
    fit();
  });
})();
