/**
 * 轻量埋点层（无依赖，纯前端）
 *
 * 用法：在 config.js 里配置 window.ANALYTICS，可同时接多家：
 *
 *   window.ANALYTICS = {
 *     providers: [
 *       { provider: "ga4",     id: "G-XXXXXXXXXX" },
 *       { provider: "clarity", id: "abcdefghij" }
 *     ]
 *   };
 *
 * 也兼容老写法（只接一家）：
 *   window.ANALYTICS = { provider: "baidu", id: "xxxx" };
 *
 * 支持：ga4 / baidu / umami / clarity / cloudflare
 * 业务事件统一走 window.track(name, params)；无论是否配置平台，
 * 都会写入 window.__trackLog（最近 200 条）便于本地调试。
 */
(function () {
  var cfg = window.ANALYTICS || {};
  var list = [];
  if (cfg.providers && cfg.providers.length) {
    list = cfg.providers.filter(function (x) { return x && x.provider && x.provider !== "none"; });
  } else if (cfg.provider && cfg.provider !== "none") {
    list = [{ provider: cfg.provider, id: cfg.id }];
  }

  window.__trackLog = [];
  function log(name, params) {
    var rec = { t: Date.now(), name: name, params: params || {} };
    window.__trackLog.push(rec);
    if (window.__trackLog.length > 200) window.__trackLog.shift();
    if (window.__trackDebug) console.log("[track]", name, rec.params);
  }

  var CLARITY_TAGS = ["lib", "type", "value", "label", "mode", "action", "trigger", "id"];

  function dispatch(p, name, params) {
    try {
      if (p === "ga4" && window.gtag) {
        window.gtag("event", name, params || {});
      } else if (p === "baidu" && window._hmt) {
        var pp = params || {};
        window._hmt.push(["_trackEvent", pp.lib || "app", name, JSON.stringify(pp)]);
      } else if (p === "umami" && window.umami) {
        window.umami.track(name, params || {});
      } else if (p === "clarity" && window.clarity) {
        window.clarity("event", name);
        var p2 = params || {};
        CLARITY_TAGS.forEach(function (k) {
          if (p2[k] !== undefined && p2[k] !== null && p2[k] !== "") {
            window.clarity("set", k, String(p2[k]).slice(0, 60));
          }
        });
      }
    } catch (e) { /* 埋点不能影响主流程 */ }
  }

  window.track = function (name, params) {
    try {
      log(name, params);
      list.forEach(function (item) { dispatch(item.provider, name, params); });
    } catch (e) { }
  };

  function addScript(src, attrs) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
  }

  list.forEach(function (item) {
    var p = item.provider, id = item.id;
    if (!id) {
      console.warn("[analytics]", p, "缺少 id，已跳过");
      return;
    }
    if (p === "ga4") {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", id, { send_page_view: true, anonymize_ip: true });
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
    } else if (p === "baidu") {
      window._hmt = window._hmt || [];
      addScript("https://hm.baidu.com/hm.js?" + encodeURIComponent(id));
    } else if (p === "umami") {
      addScript("https://cloud.umami.is/script.js", { "data-website-id": id });
    } else if (p === "clarity") {
      (function (c, l, a, r, i) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        var t = l.createElement(r); t.async = 1;
        t.src = "https://www.clarity.ms/tag/" + i;
        var y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, "clarity", "script", id);
    } else if (p === "cloudflare") {
      addScript("https://static.cloudflareinsights.com/beacon.min.js", { "data-cf-beacon": JSON.stringify({ token: id }) });
    } else {
      console.warn("[analytics] 未知 provider:", p);
    }
  });
})();
