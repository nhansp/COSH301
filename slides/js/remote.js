/* Shared by ctl.html (phone) and presenter.html (laptop): follows the deck through serve.py and sends commands. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const R = window.Remote = {
    state: { slide: 1, total: 0, outline: [], speakers: {} },
    on: {},
    send(cmd, to) {
      if (navigator.vibrate) navigator.vibrate(12);
      return fetch("/api/cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd, to: to == null ? "" : String(to) }) });
    },
    speaker(key) { return (R.state.speakers || {})[key] || null; },
    // A preview is a read-only copy of the deck; moving between slides is a hash change.
    frame(box, n) {
      box.classList.toggle("none", !n);
      const ifr = box.querySelector("iframe");
      if (!n) return;
      ifr.dataset.want = "#" + n;
      if (!ifr.src) {
        ifr.addEventListener("load", () => {
          ifr.dataset.loaded = "1";
          if (ifr.contentWindow.location.hash !== ifr.dataset.want) ifr.contentWindow.location.hash = ifr.dataset.want;
        });
        ifr.src = "/index.html?preview&chips#" + n;
      } else if (ifr.dataset.loaded && ifr.contentWindow.location.hash !== "#" + n) ifr.contentWindow.location.hash = "#" + n;
    },
    chip(el, key) {
      const sp = R.speaker(key);
      el.innerHTML = sp ? '<i style="background:' + sp.color + '"></i>' + esc(sp.name) : "";
      el.hidden = !sp;
    },
    speakerTotals() {
      const t = {};
      (R.state.outline || []).forEach(o => { if (o.s) t[o.s] = (t[o.s] || 0) + (o.time || 0); });
      return t;
    },
    fmt, esc,
    connect(dot) {
      const es = new EventSource("/api/events");
      es.onopen = () => { if (dot) dot.classList.add("on"); fetch("/api/cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"cmd":"sync"}' }); };
      es.addEventListener("state", e => { R.state = Object.assign(R.state, JSON.parse(e.data)); if (R.on.state) R.on.state(R.state); });
      es.onerror = () => { if (dot) dot.classList.remove("on"); };
    }
  };
})();
