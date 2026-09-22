export const GMGN_SNIFF_ORIGIN = "https://earlygem-live.vercel.app";

const GMGN_SNIFF_TEMPLATE = String.raw`(() => {
  const EG = "__EG_ORIGIN__";
  const bag = (window.__egGmgn = window.__egGmgn || {
    urls: [],
    ws: [],
    hits: [],
    trades: [],
    peeks: [],
    peek: null,
    wsMeta: null,
  });
  function legKey(t) {
    return String((t && t.tx) || "") + "|" + String((t && t.token) || "").toLowerCase() + "|" + String((t && t.side) || "");
  }
  bag.seen = new Set((bag.trades || []).map(legKey).filter(function (k) { return k && k !== "||"; }));
  bag.seenV = 56;

  function shortUrl(u) {
    return String(u || "").split("?")[0];
  }

  function pageCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text || "");
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch (e) {
      return false;
    }
  }

  function banner(text) {
    let el = document.getElementById("eg-gmgn-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "eg-gmgn-banner";
      el.style.cssText =
        "position:fixed;z-index:2147483647;left:8px;right:8px;bottom:8px;max-height:42vh;overflow:auto;background:#16140c;color:#c6ff9a;font:12px/1.4 ui-monospace,SFMono-Regular,monospace;padding:10px 12px;border:1px solid #7dff8a;border-radius:8px;white-space:pre-wrap;word-break:break-all";
      document.body.appendChild(el);
    }
    el.textContent = String(text || "");
  }

  var CHAIN = {
    sol: "solana", solana: "solana",
    bsc: "bsc", bnb: "bsc",
    base: "base",
    eth: "ethereum", ethereum: "ethereum",
    rh: "robinhood", rhood: "robinhood", robinhood: "robinhood",
    monad: "monad", mon: "monad",
    arb: "arbitrum", arbitrum: "arbitrum",
    hyper: "hyperevm", hype: "hyperevm", hyperevm: "hyperevm",
    mega: "megaeth", megaeth: "megaeth",
    xlayer: "xlayer", okx: "xlayer",
    stable: "stable",
    arc: "arc"
  };

  function mapChain(raw) {
    var s = String(raw || "").toLowerCase().trim();
    if (!s || s === "0") return "";
    if (CHAIN[s]) return CHAIN[s];
    var parts = s.split(/[^a-z0-9]+/);
    for (var i = 0; i < parts.length; i++) {
      if (CHAIN[parts[i]]) return CHAIN[parts[i]];
    }
    return "";
  }

  var pageCache = { at: 0, v: "" };
  function pageChain() {
    var now = Date.now();
    if (now - pageCache.at < 5000) return pageCache.v;
    var v = "";
    try {
      var q = new URLSearchParams(location.search);
      v = mapChain(q.get("chain") || q.get("network") || "");
    } catch (e) {}
    if (!v) {
      var seg = String(location.pathname || "").split("/").filter(Boolean)[0] || "";
      v = mapChain(seg);
    }
    if (!v) {
      try {
        var el = document.querySelector("[data-chain],[aria-selected='true'][data-chain]");
        if (el) v = mapChain(el.getAttribute("data-chain") || "");
      } catch (e2) {}
    }
    if (!v) {
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i) || "";
          if (!/chain/i.test(k) || /device|fp_did|token|key|secret/i.test(k)) continue;
          var stored = String(localStorage.getItem(k) || "").replace(/"/g, "").slice(0, 32);
          var hit = mapChain(stored);
          if (hit) { v = hit; break; }
        }
      } catch (e3) {}
    }
    pageCache = { at: now, v: v };
    return v;
  }

  function rawChain(row) {
    var keys = ["n", "chain", "cn", "ch", "network", "chain_id", "ci"];
    for (var i = 0; i < keys.length; i++) {
      var v = row && row[keys[i]];
      if (v != null && String(v) && String(v) !== "0") return String(v);
    }
    return "";
  }

  function chainOf(row) {
    var raw = rawChain(row);
    var mapped = mapChain(raw);
    var page = mapped ? "" : pageChain();
    var token = String((row && (row.a || row.ba || row.token || "")) || "");
    var chain = mapped || page || "";
    var guessed = !chain;
    if (!chain && token.indexOf("0x") !== 0 && token.indexOf("0X") !== 0) chain = "solana";
    return { chain: chain, chainRaw: raw, fromPage: Boolean(page) && !mapped, guessed: guessed };
  }

  function asFollowTrade(row) {
    if (!row || typeof row !== "object") return null;
    const side = String(row.s || row.side || "").toLowerCase();
    if (side !== "buy" && side !== "sell") return null;
    const token = row.a || row.ba || row.token_address || row.token || "";
    if (!token || String(token).length < 8) return null;
    const tx = row.h || row.tx || row.signature || row.hash || "";
    const usd = Number(row.au || row.cu || row.amount_usd || row.usd || 0);
    if (!tx && usd <= 0) return null;
    let ts = Number(row.ts || row.timestamp || 0);
    if (ts && ts < 10e9) ts *= 1000;
    if (!ts) ts = Date.now();
    const maker = row.m || row.ma || row.maker || "";
    const tags = Array.isArray(row.t) ? row.t : [];
    const handle = row.nm || row.tun || row.un || (maker ? String(maker).slice(0, 8) : "wallet");
    const net = chainOf(row);
    const firstBuy = row.firstBuy === true || Number(row.ooc) === 1;
    return {
      id: "gmgn-live-" + (tx || "x") + "-" + token + "-" + ts,
      ts: ts,
      chain: net.chain,
      chainRaw: net.chainRaw,
      fromPage: net.fromPage,
      guessed: net.guessed,
      side: side,
      usd: usd,
      amount: Number(row.ta || row.token_amount || row.amount || 0),
      price: Number(row.pu || row.price_usd || row.price || 0) || null,
      token: String(token),
      symbol: String(row.bs || row.symbol || "???").trim(),
      name: String(row.tn || row.bs || row.symbol || "???").trim(),
      mcap: null,
      liquidity: null,
      change24: null,
      pairUrl: null,
      imageUrl: row.bl || row.avatar || null,
      wallet: maker ? String(maker) : null,
      handle: String(handle),
      followers: row.fc != null ? Number(row.fc) : null,
      profileUrl: row.tun ? "https://x.com/" + row.tun : null,
      rank: null,
      tx: tx ? String(tx) : null,
      firstBuy: firstBuy,
      flags: ["gmgn", "follow", "track"],
      source: "dexscreener",
      smartKind: tags.some(function (x) { return /kol|renowned/i.test(String(x)); }) ? "kol" : "smart",
      venue: row.tlp || row.tl || null,
    };
  }

  function buyPayload() {
    var buys = [];
    for (var i = 0; i < (bag.trades || []).length; i++) {
      if (bag.trades[i].side === "buy") buys.push(bag.trades[i]);
    }
    return { type: "eg-gmgn-track", fills: buys.slice(0, 40) };
  }

  function radarAlive(win) {
    if (!win || win.closed) return false;
    try {
      var href = String(win.location.href || "");
      return Boolean(href) && href !== "about:blank" && href.indexOf("about:") !== 0;
    } catch (e) {
      return true;
    }
  }

  function targets() {
    var list = [];
    function add(win) {
      if (!radarAlive(win)) return;
      if (list.indexOf(win) >= 0) return;
      list.push(win);
    }
    try { add(window.opener); } catch (e) {}
    add(bag.radar);
    return list;
  }

  function egLog(line) {
    var text = String(line || "");
    console.log(text);
    var msg = { type: "eg-gmgn-track-log", line: text };
    var list = targets();
    for (var i = 0; i < list.length; i++) {
      try { list[i].postMessage(msg, "*"); } catch (e) {}
    }
  }

  function ship(buys) {
    if (!buys || !buys.length) return false;
    var msg = { type: "eg-gmgn-track", fills: buys };
    var list = targets();
    if (!list.length) return false;
    var ok = false;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i].postMessage(msg, "*");
        try { list[i].postMessage(msg, EG); } catch (e0) {}
        ok = true;
      } catch (e) {
        egLog("[eg] postMessage " + (e && e.message ? e.message : e));
      }
    }
    if (ok) bag.shipped = (bag.shipped || 0) + buys.length;
    return ok;
  }

  if (!window.__egAckHook56) {
    window.__egAckHook56 = true;
    window.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.type !== "eg-gmgn-track-ack") return;
      bag.acked = ev.data.count;
      console.log("[eg] radar ack", ev.data.count, "buy");
      banner("TRACK radar OK · " + ev.data.count + " buy havuza");
    });
  }

  var queue = [];
  var flushTimer = 0;
  function flushQueue() {
    flushTimer = 0;
    if (!queue.length) return;
    var batch = queue;
    queue = [];
    var shipped = false;
    try { shipped = ship(batch); } catch (e) { egLog("[eg] ship " + (e && e.message ? e.message : e)); }
    var symbols = [];
    for (var i = 0; i < batch.length; i++) {
      var b = batch[i];
      symbols.push((b.symbol || "?") + " " + (b.chainRaw || (b.fromPage ? b.chain : "?")) + (b.chain ? "/" + b.chain : ""));
    }
    var line = "[eg] TRACK batch " + batch.length + " · " + symbols.join(", ") + " · " + (shipped ? "postMessage" : "radar yok");
    egLog(line);
    banner(line);
  }
  function enqueue(buys) {
    for (var i = 0; i < buys.length; i++) queue.push(buys[i]);
    if (flushTimer) return;
    flushTimer = setTimeout(flushQueue, 450);
  }

  function push(fills) {
    if (!fills || !fills.length) return;
    const fresh = [];
    for (var i = 0; i < fills.length; i++) {
      const f = fills[i];
      const k = legKey(f);
      if (k && bag.seen.has(k)) continue;
      if (k) bag.seen.add(k);
      fresh.push(f);
    }
    if (!fresh.length) return;
    bag.trades = fresh.concat(bag.trades).slice(0, 500);
    const buys = fresh.filter(function (f) { return f.side === "buy"; });
    if (!buys.length) return;
    enqueue(buys);
  }

  function ingestWs(body) {
    var data = body;
    if (typeof body === "string") {
      try { data = JSON.parse(body); } catch (e) { return; }
    }
    if (!data || typeof data !== "object") return;
    if (data.channel !== "following_wallet_activity") return;
    const rows = Array.isArray(data.data) ? data.data : [];
    const fills = [];
    for (var i = 0; i < rows.length; i++) {
      try {
        const t = asFollowTrade(rows[i]);
        if (t) fills.push(t);
      } catch (e) {
        egLog("[eg] fill " + (e && e.message ? e.message : e));
      }
    }
    if (fills.length) push(fills);
  }

  function isPoll(u) {
    return /dex_trades_polling/i.test(String(u || ""));
  }

  function trackUrl(u) {
    const s = String(u || "");
    if (
      /balances|holdings|twitter|analytics|google-analytics|\/g\/collect|batch_get|trade_config|get_coins|hybrid|is_bound|messages|business_group|wallet\/list|tapi\/v1\/wallet|list_wallet|walletNew|get_configs|get_groups/i.test(
        s,
      )
    )
      return false;
    return /dex_trades_polling|follow_wallet|follow\/.*trade|wallet_activity|\/dex_trades(?:_|\b)/i.test(s);
  }

  function asTrade(row, url) {
    const t = asFollowTrade(row);
    if (t) return t;
    return null;
  }

  function walk(node, url, out, depth) {
    if (!node || depth > 7) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        const t = asTrade(node[i], url);
        if (t) out.push(t);
        else walk(node[i], url, out, depth + 1);
      }
      return;
    }
    if (typeof node !== "object") return;
    const keys = ["list", "data", "activities", "trades", "transactions", "result", "rows", "records", "items", "fills", "events", "ticks"];
    for (var k = 0; k < keys.length; k++) {
      if (node[keys[k]]) walk(node[keys[k]], url, out, depth + 1);
    }
  }

  function pick(body, url) {
    var data = body;
    if (typeof body === "string") {
      try { data = JSON.parse(body); } catch (e) { return []; }
    }
    const out = [];
    walk(data, url, out, 0);
    return out;
  }

  function xhrBody(xhr) {
    try {
      if (xhr.responseType === "json" && xhr.response != null) {
        return typeof xhr.response === "string" ? xhr.response : JSON.stringify(xhr.response);
      }
    } catch (e) {}
    try { return xhr.responseText; } catch (e) {
      try { return JSON.stringify(xhr.response); } catch (e2) { return ""; }
    }
  }

  function noteHttp(kind, url, body) {
    const u = String(url || "");
    bag.hits.unshift({ t: new Date().toISOString(), kind: kind, url: shortUrl(u) });
    bag.hits.splice(80);
    const base = shortUrl(u);
    if (base && bag.urls.indexOf(base) < 0) bag.urls.push(base);
    if (!trackUrl(u)) return;
    try {
      const fills = pick(body, u);
      if (isPoll(u) && fills.length) console.log("[eg] polling fill", fills.length);
      push(fills);
    } catch (e) {
      egLog("[eg] parse " + (e && e.message ? e.message : e));
    }
  }

  function attachFollow(ws, url) {
    if (!ws || ws.__egFollow56) return;
    ws.__egFollow56 = true;
    const u = shortUrl(url || ws.url || "");
    if (u && bag.ws.indexOf(u) < 0) bag.ws.push(u);
    egLog("[eg] v5.6 follow attach " + (u || "ws"));
    try {
      ws.addEventListener("message", function (ev) {
        ingestWs(ev.data);
      });
    } catch (e) {
      egLog("[eg] ws listener " + (e && e.message ? e.message : e));
    }
  }

  const OWS = window.WebSocket;
  if (!window.__egGmgnHookedV56) {
    window.__egGmgnHookedV56 = true;
    const prevSend = OWS.prototype.send;
    OWS.prototype.send = function (data) {
      attachFollow(this, this.url);
      return prevSend.call(this, data);
    };
    try {
      const desc = Object.getOwnPropertyDescriptor(OWS.prototype, "onmessage");
      if (desc && desc.set && !desc.set.__eg56) {
        const prevSet = desc.set;
        const wrapped = function (fn) {
          attachFollow(this, this.url);
          return prevSet.call(this, fn);
        };
        wrapped.__eg56 = true;
        Object.defineProperty(OWS.prototype, "onmessage", {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: wrapped,
        });
      }
    } catch (e) {}
  }

  if (!window.__egGmgnHookedV5http) {
    window.__egGmgnHookedV5http = true;
    const ofetch = window.fetch;
    window.fetch = async function () {
      const url = String(arguments[0] && arguments[0].url ? arguments[0].url : arguments[0]);
      const res = await ofetch.apply(this, arguments);
      try {
        if (trackUrl(url)) {
          const copy = res.clone();
          const ct = copy.headers.get("content-type") || "";
          if (/json|text/i.test(ct)) copy.text().then(function (t) { noteHttp("fetch", url, t); }).catch(function () {});
        }
      } catch (e) {}
      return res;
    };
    const oxhr = XMLHttpRequest.prototype.open;
    const osend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__egUrl = u;
      return oxhr.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener("load", function () {
        if (trackUrl(this.__egUrl)) noteHttp("xhr", this.__egUrl, xhrBody(this));
      });
      return osend.apply(this, arguments);
    };
    if (!window.__egGmgnHookedV4) {
      const Ctor = window.WebSocket;
      window.WebSocket = function (url, proto) {
        const ws = proto !== undefined ? new Ctor(url, proto) : new Ctor(url);
        attachFollow(ws, url);
        return ws;
      };
      window.WebSocket.prototype = Ctor.prototype;
      window.WebSocket.OPEN = Ctor.OPEN;
      window.WebSocket.CLOSED = Ctor.CLOSED;
      window.WebSocket.CONNECTING = Ctor.CONNECTING;
      window.WebSocket.CLOSING = Ctor.CLOSING;
    }
  }

  bag.dump = function () {
    const payload = buyPayload();
    const json = JSON.stringify({
      urls: bag.urls,
      ws: bag.ws,
      posted: bag.posted || false,
      acked: bag.acked == null ? null : bag.acked,
      tradeCount: bag.trades.length,
      trades: bag.trades.slice(0, 40),
      fills: payload.fills,
    });
    console.log("[eg] DUMP", bag.trades.length, "trades ·", payload.fills.length, "buy");
    console.log(json);
    pageCopy(json);
    banner("DUMP " + payload.fills.length + " buy · JSON panoda");
    return json;
  };

  try {
    if (radarAlive(window.opener)) bag.radar = window.opener;
    else bag.radar = window.open(EG + "/tape", "earlygem");
  } catch (e) {
    egLog("[eg] radar penceresi " + (e && e.message ? e.message : e));
  }
  var opened = radarAlive(bag.radar) || radarAlive(window.opener);
  var hello = opened
    ? "v5.6 takildi — batch + ag tespiti. Eski overlay varsa Track'i bir kez yenile."
    : "v5.6 — radar penceresi yok. earlygem /tape acik kalsin.";
  banner(hello);
  egLog("[eg] " + hello);
  return hello;
})();
`;

export function gmgnSniffSource(origin = GMGN_SNIFF_ORIGIN) {
  const safe = /^https?:\/\/[a-z0-9.:-]+$/i.test(origin) ? origin.replace(/\/$/, "") : GMGN_SNIFF_ORIGIN;
  return GMGN_SNIFF_TEMPLATE.split("__EG_ORIGIN__").join(safe);
}

export const GMGN_SNIFF_JS = gmgnSniffSource();
