(function () {
  "use strict";

  var DATA = window.STICKER_SETS;
  var $ = function (s) { return document.querySelector(s); };
  var grid = $("#grid");
  var empty = $("#empty");
  var modal = $("#modal");
  var modelsModal = $("#modelsModal");
  var qInput = $("#q");
  var favKey = "sticker-library-favs-v1";
  var baseTitle = document.title;
  var toastTimer = null;
  var searchTimer = null;
  var lastFocus = null;
  var modelsLastFocus = null;

  if (!DATA || !Array.isArray(DATA.sets)) {
    grid.innerHTML = '<div class="empty"><b>数据没有加载成功</b><span>请确认 data/sticker-sets.js 与 index.html 在同一目录下。</span></div>';
    return;
  }

  var SETS = DATA.sets.slice();
  var state = { q: "", favOnly: false, visible: [], current: null };
  var favs = loadFavs();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function loadFavs() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(favKey) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) { return new Set(); }
  }

  function saveFavs() {
    try { window.localStorage.setItem(favKey, JSON.stringify(Array.from(favs))); } catch (e) { }
  }

  function matches(s, q) {
    if (!q) return true;
    var hay = [
      s.title, s.creator, s.platform, s.direction,
      (s.tags || []).join(" "), s.style, s.why, s.language
    ].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return SETS.filter(function (s) {
      if (state.favOnly && !favs.has(s.id)) return false;
      return matches(s, q);
    });
  }

  function cardHTML(s, i) {
    var tags = (s.tags || []).filter(function (t) { return t !== "human" && t !== "animal"; });
    var shown = tags.slice(0, 3).map(function (t) {
      return '<span class="card-tag">' + esc(t) + "</span>";
    }).join("");
    if (tags.length > 3) shown += '<span class="card-tag more">+' + (tags.length - 3) + "</span>";
    var isFav = favs.has(s.id);
    var isPack = !!s.pack;
    var countLabel = isPack ? (s.pack.count || 12) + " 张" : s.sticker_count + " 个";
    var cardPreview = (isPack && s.source_preview) ? s.source_preview : s.preview;
    var load = i < 4 ? ' loading="eager" fetchpriority="' + (i === 0 ? "high" : "auto") + '"' : ' loading="lazy"';
    return '<div class="card" data-id="' + esc(s.id) + '" role="button" tabindex="0" aria-label="查看 ' + esc(s.title) + '">'
      + '<div class="card-media' + (isPack ? " is-pack" : "") + '">'
      + '<img src="' + esc(cardPreview) + '" alt="' + esc(s.title) + ' 原始引用"' + load + ' decoding="async">'
      + '<span class="num">' + esc(s.id) + "</span>"
      + '<button class="fav' + (isFav ? " on" : "") + '" data-fav-id="' + esc(s.id) + '" aria-label="' + (isFav ? "取消收藏" : "收藏") + '" aria-pressed="' + (isFav ? "true" : "false") + '">'
      + '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.6 12 20 12 20Z"/></svg>'
      + "</button>"
      + "</div>"
      + '<div class="card-body">'
      + '<div class="card-head"><h2>' + esc(s.title) + '</h2><span class="direction">' + esc(s.direction) + "</span></div>"
      + '<p class="maker">' + esc(s.platform) + " · " + esc(s.creator) + "</p>"
      + '<div class="card-tags">' + shown + "</div>"
      + '<div class="card-foot"><span>' + esc(countLabel) + "</span><span class=\"sep\"></span><span>" + (s.animated ? "动效" : "静态") + "</span></div>"
      + "</div></div>";
  }

  function render() {
    var list = filtered();
    state.visible = list.map(function (s) { return s.id; });
    grid.innerHTML = list.map(cardHTML).join("");
    empty.hidden = list.length > 0;
    $("#favCount").textContent = favs.size;
    bindCards();
    if (state.current) syncFav();
  }

  function bindCards() {
    grid.querySelectorAll(".card").forEach(function (card) {
      card.onclick = function () { openModal(card.dataset.id, true); };
      card.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(card.dataset.id, true); }
      };
    });
    grid.querySelectorAll("[data-fav-id]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        toggleFav(btn.dataset.favId);
      };
    });
  }

  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    render();
    if (state.current && state.current.id === id) syncFav();
  }

  function syncFav() {
    $("#favCount").textContent = favs.size;
    var btn = $("#mfav");
    if (!btn) return;
    var on = !!(state.current && favs.has(state.current.id));
    btn.classList.toggle("on", on);
    btn.textContent = on ? "已收藏 ♥" : "收藏";
  }

  function setTabState() {
    var allBtn = document.querySelector("[data-all]");
    if (allBtn) {
      var allOn = !state.favOnly;
      allBtn.classList.toggle("on", allOn);
      allBtn.setAttribute("aria-pressed", allOn ? "true" : "false");
    }
    var favBtn = document.querySelector("[data-fav]");
    favBtn.classList.toggle("on", state.favOnly);
    favBtn.setAttribute("aria-pressed", state.favOnly ? "true" : "false");
  }

  function openModels() {
    modelsLastFocus = document.activeElement;
    modelsModal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(function () { $("#modelsClose").focus(); }, 30);
  }

  function closeModels() {
    if (modelsModal.hidden) return;
    modelsModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (modelsLastFocus && modelsLastFocus.focus) modelsLastFocus.focus();
  }

  function openModal(id, updateHash) {
    var s = SETS.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    state.current = s;
    lastFocus = document.activeElement;
    document.title = s.title + " · 贴纸灵感库";

    $("#mnum").textContent = "NO. " + s.id;
    $("#mtitle").textContent = s.title;
    $("#msourcelink").href = s.url;
    $("#mimg").src = s.source_preview || s.preview;
    $("#mimg").alt = s.title + " 原始引用";
    $("#mdemo").src = s.preview;
    $("#mdemo").alt = s.title + " 生成 Demo";

    var list = state.visible.length ? state.visible : SETS.map(function (x) { return x.id; });
    var idx = list.indexOf(s.id);
    $("#mindex").textContent = (idx >= 0 ? idx + 1 : "–") + " / " + list.length;
    syncFav();

    modal.hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector(".sheet").scrollTop = 0;
    if (updateHash) {
      try { history.replaceState(null, "", "#s" + s.id); } catch (e) { }
    }
    setTimeout(function () { $("#close").focus(); }, 30);
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    state.current = null;
    document.title = baseTitle;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function step(delta) {
    if (!state.current) return;
    var list = state.visible.length ? state.visible : SETS.map(function (x) { return x.id; });
    var idx = list.indexOf(state.current.id);
    if (idx < 0) idx = 0;
    var next = list[(idx + delta + list.length) % list.length];
    openModal(next, true);
  }

  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("on"); }, 1700);
  }

  function copyText(text, done, fail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done, fail); });
    } else {
      fallbackCopy(text, done, fail);
    }
  }

  function fallbackCopy(text, done, fail) {
    var t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.top = "-1000px";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.focus();
    t.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    t.remove();
    if (ok) done(); else fail();
  }

  function hashId() {
    var m = location.hash.match(/^#s(\d{2})$/);
    return m ? m[1] : null;
  }

  /* events */
  document.querySelector("[data-all]").onclick = function () {
    state.favOnly = false;
    state.q = "";
    qInput.value = "";
    setTabState();
    render();
  };
  document.querySelector("[data-fav]").onclick = function () {
    state.favOnly = !state.favOnly;
    setTabState();
    render();
  };
  qInput.oninput = function () {
    var v = this.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = v;
      render();
    }, 120);
  };
  qInput.onkeydown = function (e) {
    if (e.key === "Escape") {
      this.value = "";
      state.q = "";
      render();
    }
  };
  $("#random").onclick = function () {
    var list = filtered();
    if (!list.length) list = SETS;
    openModal(list[Math.floor(Math.random() * list.length)].id, true);
  };
  $("#modelsBtn").onclick = openModels;
  $("#modelsClose").onclick = closeModels;
  modelsModal.onclick = function (e) { if (e.target === modelsModal) closeModels(); };

  $("#close").onclick = closeModal;
  modal.onclick = function (e) { if (e.target === modal) closeModal(); };
  $("#prev").onclick = function () { step(-1); };
  $("#next").onclick = function () { step(1); };

  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
    if (!modelsModal.hidden) {
      if (e.key === "Escape") { e.preventDefault(); closeModels(); }
      return;
    }
    if (modal.hidden) {
      if (e.key === "/" && !typing) { e.preventDefault(); qInput.focus(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeModal(); }
    else if (!typing && e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (!typing && e.key === "ArrowRight") { e.preventDefault(); step(1); }
  });

  window.addEventListener("hashchange", function () {
    var id = hashId();
    if (id) openModal(id, false);
    else closeModal();
  });

  setTabState();
  render();
  var initial = hashId();
  if (initial) setTimeout(function () { openModal(initial, false); }, 0);
})();
