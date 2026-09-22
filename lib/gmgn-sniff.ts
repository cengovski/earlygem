export const GMGN_SNIFF_ORIGIN = "https://earlygem-live.vercel.app";

/** Paste into the logged-in gmgn.ai Track tab console. Do not hard-reload after paste. */
export const GMGN_SNIFF_JS = String.raw`(() => {
  const EG = "https://earlygem-live.vercel.app";
  const bag = (window.__egGmgn = window.__egGmgn || {
    urls: [],
    ws: [],
    hits: [],
    trades: [],
    peeks: [],
    peek: null,
    wsMeta: null,
  });
  if (!bag.seen) {
    bag.seen = new Set((bag.trades || []).map(function (t) { return t.tx || t.id; }).filter(Boolean));
  }

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

  function chainOf(row, url) {
    const s = String((row && (row.n || row.chain || row.network || row.chain_id)) || url || "").toLowerCase();
    if (s.includes("sol")) return "solana";
    if (s.includes("bsc") || s.includes("bnb")) return "bsc";
    if (s.includes("base")) return "base";
    if (s.includes("eth")) return "ethereum";
    if (s.includes("robin") || s.includes("rh")) return "robinhood";
    if (s.includes("monad")) return "monad";
    const token = String((row && (row.a || row.token || "")) || "");
    if (token.indexOf("0x") === 0) return "ethereum";
    return "solana";
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
    const firstBuy = row.firstBuy === true || Number(row.ooc) === 1;
    return {
      id: "gmgn-live-" + (tx || token) + "-" + ts,
      ts: ts,
      chain: chainOf(row, ""),
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
    return { type: "eg-gmgn-track", fills: buys.slice(0, 20) };
  }

  function copyBuys() {
    var payload = buyPayload();
    if (!payload.fills.length) return false;
    if (pageCopy(JSON.stringify(payload))) {
      bag.copied = payload.fills.length;
      return true;
    }
    return false;
  }

  function shoot(win, payload) {
    if (!win || win === window) return false;
    var blank = false;
    try {
      var href = String(win.location.href || "");
      blank = !href || href === "about:blank" || href.indexOf("about:") === 0 || /gmgn\.ai/i.test(href);
    } catch (e) {
      try {
        win.postMessage(payload, "*");
        try { win.postMessage(payload, EG); } catch (e0) {}
        return true;
      } catch (e2) {
        return false;
      }
    }
    if (blank) {
      try { if (win !== window.opener) win.close(); } catch (e3) {}
      return false;
    }
    try {
      win.postMessage(payload, "*");
      try { win.postMessage(payload, EG); } catch (e0) {}
      return true;
    } catch (e4) {
      return false;
    }
  }

  function postEg(payload) {
    var sent = false;
    try {
      if (shoot(window.opener, payload)) sent = true;
    } catch (e) {}
    bag.posted = sent;
    return sent;
  }

  function formRelay(buys) {
    if (!buys || !buys.length || bag.formBlocked) return;
    if (!window.__egCspHook) {
      window.__egCspHook = true;
      document.addEventListener("securitypolicyviolation", function (ev) {
        var d = String(ev.effectiveDirective || ev.violatedDirective || "");
        if (d.indexOf("form-action") >= 0) bag.formBlocked = true;
      });
    }
    var form = document.getElementById("eg-relay-form");
    if (!form) {
      form = document.createElement("form");
      form.id = "eg-relay-form";
      form.method = "POST";
      form.action = EG + "/api/gmgn-ingest";
      form.target = "eg_gmgn_relay";
      form.enctype = "application/x-www-form-urlencoded";
      form.setAttribute("hidden", "");
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      form.appendChild(input);
      document.body.appendChild(form);
    }
    form.querySelector("input").value = JSON.stringify({ type: "eg-gmgn-track", fills: buys.slice(0, 20) });
    try {
      form.submit();
      bag.relayed = (bag.relayed || 0) + 1;
    } catch (e) {
      bag.formBlocked = true;
    }
  }

  if (!window.__egAckHook) {
    window.__egAckHook = true;
    window.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.type !== "eg-gmgn-track-ack") return;
      bag.acked = ev.data.count;
      console.log("[eg] radar ack", ev.data.count, "buy");
      banner("TRACK radar OK · " + ev.data.count + " buy havuza");
    });
  }

  function push(fills) {
    if (!fills || !fills.length) return;
    const fresh = [];
    for (var i = 0; i < fills.length; i++) {
      const f = fills[i];
      const k = f.tx || f.id;
      if (k && bag.seen.has(k)) continue;
      if (k && (bag.trades || []).some(function (t) { return (t.tx || t.id) === k; })) continue;
      if (k) bag.seen.add(k);
      fresh.push(f);
    }
    if (!fresh.length) return;
    bag.trades = fresh.concat(bag.trades).slice(0, 500);
    const buys = fresh.filter(function (f) { return f.side === "buy"; });
    if (!buys.length) return;
    postEg({ type: "eg-gmgn-track", fills: buys });
    setTimeout(function () {
      formRelay(buys);
      var now = Date.now();
      if (!bag.copyAt || now - bag.copyAt > 2000) {
        copyBuys();
        bag.copyAt = now;
      }
    }, 0);
    const hint = bag.acked != null
      ? "radar OK " + bag.acked
      : bag.formBlocked
        ? "CSP · JSON panoda · earlygem tıkla"
        : "pano · earlygem tıkla";
    const line =
      "[eg] TRACK fill " +
      fresh.length +
      " · buy " +
      buys.length +
      " · toplam " +
      bag.trades.length +
      " · " +
      (buys[0].symbol || "") +
      " buy $" +
      Math.round(buys[0].usd || 0) +
      " · " +
      hint;
    console.log(line, buys[0] && buys[0].token);
    banner(line + "\n" + (buys[0].token || ""));
  }

  function ingestWs(body) {
    var data = body;
    if (typeof body === "string") {
      try {
        data = JSON.parse(body);
      } catch (e) {
        return;
      }
    }
    if (!data || typeof data !== "object") return;
    if (data.channel !== "following_wallet_activity") return;
    const rows = Array.isArray(data.data) ? data.data : [];
    const fills = [];
    for (var i = 0; i < rows.length; i++) {
      const t = asFollowTrade(rows[i]);
      if (t) fills.push(t);
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
    if (t) {
      t.chain = chainOf(row, url);
      return t;
    }
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
      try {
        data = JSON.parse(body);
      } catch (e) {
        return [];
      }
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
    try {
      return xhr.responseText;
    } catch (e) {
      try {
        return JSON.stringify(xhr.response);
      } catch (e2) {
        return "";
      }
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
      console.warn("[eg] parse", e);
    }
  }

  function attachFollow(ws, url) {
    if (!ws || ws.__egFollow54) return;
    ws.__egFollow54 = true;
    const u = shortUrl(url || ws.url || "");
    if (u && bag.ws.indexOf(u) < 0) bag.ws.push(u);
    console.log("[eg] v5.4 follow attach", u || "ws");
    try {
      ws.addEventListener("message", function (ev) {
        ingestWs(ev.data);
      });
    } catch (e) {}
  }

  const OWS = window.WebSocket;
  const pSend = OWS.prototype.send;
  if (!window.__egGmgnHookedV54) {
    window.__egGmgnHookedV54 = true;
    OWS.prototype.send = function (data) {
      attachFollow(this, this.url);
      return pSend.call(this, data);
    };
    try {
      const desc = Object.getOwnPropertyDescriptor(OWS.prototype, "onmessage");
      if (desc && desc.set) {
        Object.defineProperty(OWS.prototype, "onmessage", {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: function (fn) {
            attachFollow(this, this.url);
            return desc.set.call(this, fn);
          },
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
      copied: bag.copied || 0,
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

  banner("v5.4 takildi — Track YENILEME. fetch yok (CSP). Buy JSON panoda; earlygem tıkla.");
  console.log("[eg] v5.4 takildi — YENİLEME. connect-src fetch yok, pano + form");
  return "[eg] v5.4 — Track yenileme, fetch yok, earlygem tıkla";
})();
`;
