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
  const seenTx = new Set((bag.trades || []).map((t) => t.tx || t.id).filter(Boolean));

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

  function isPoll(u) {
    return /dex_trades_polling/i.test(String(u || ""));
  }

  function chainOf(url, row) {
    const s = String((row && (row.chain || row.network || row.chain_id)) || url || "").toLowerCase();
    if (s.includes("sol")) return "solana";
    if (s.includes("bsc") || s.includes("bnb")) return "bsc";
    if (s.includes("base")) return "base";
    if (s.includes("eth")) return "ethereum";
    if (s.includes("robin") || s.includes("rh")) return "robinhood";
    if (s.includes("monad")) return "monad";
    return "solana";
  }

  function sideOf(row) {
    const raw = row.side || row.event_type || row.eventType || row.event || row.trade_type || row.tradeType || row.action;
    const s = String(raw == null ? "" : raw).toLowerCase();
    if (s === "buy" || s === "1" || s === "buy_token") return "buy";
    if (s === "sell" || s === "0" || s === "sell_token") return "sell";
    return "";
  }

  function tokenOf(row) {
    const tok = row.base_token || row.token || {};
    const t =
      row.base_address ||
      row.token_address ||
      row.tokenAddress ||
      row.baseAddress ||
      row.ca ||
      tok.address ||
      tok.token_address ||
      tok.tokenAddress;
    return t && typeof t === "string" ? t : "";
  }

  function asTrade(row, url) {
    if (!row || typeof row !== "object") return null;
    const side = sideOf(row);
    if (side !== "buy" && side !== "sell") return null;
    const token = tokenOf(row);
    if (!token || token.length < 8) return null;
    const tx = row.transaction_hash || row.tx_hash || row.txHash || row.tx || row.signature || row.hash;
    const usd = Number(row.amount_usd || row.amountUsd || row.cost_usd || row.usd || row.volume_usd || 0);
    if (!tx && usd <= 0) return null;
    let ts = Number(row.timestamp || row.ts || row.block_time || row.blockTime || row.time || 0);
    if (ts && ts < 10e9) ts *= 1000;
    if (!ts) ts = Date.now();
    const tok = row.base_token || row.token || {};
    const maker =
      row.maker ||
      row.wallet_address ||
      row.maker_address ||
      row.trader ||
      (row.maker_info && (row.maker_info.address || row.maker_info.wallet_address)) ||
      row.wallet ||
      "";
    const info = row.maker_info || row.user || {};
    const tags = info.tags || row.tags || [];
    return {
      id: "gmgn-live-" + (tx || token) + "-" + ts,
      ts,
      chain: chainOf(url, row),
      side,
      usd,
      amount: Number(row.token_amount || row.base_amount || row.amount || 0),
      price: Number(row.price_usd || row.priceUsd || row.price || 0) || null,
      token: String(token),
      symbol: String(tok.symbol || row.symbol || row.token_symbol || "???").trim(),
      name: String(tok.name || tok.symbol || row.symbol || row.token_symbol || "???").trim(),
      mcap: row.market_cap != null ? Number(row.market_cap) : row.mcap != null ? Number(row.mcap) : null,
      liquidity: null,
      change24: null,
      pairUrl: null,
      imageUrl: tok.logo || tok.logo_url || null,
      wallet: maker ? String(maker) : null,
      handle: info.twitter_username || info.name || row.name || (maker ? String(maker).slice(0, 8) : "wallet"),
      followers: null,
      profileUrl: info.twitter_username ? "https://x.com/" + info.twitter_username : null,
      rank: null,
      tx: tx ? String(tx) : null,
      firstBuy: false,
      flags: ["gmgn", "follow", "track"],
      source: "dexscreener",
      smartKind: (Array.isArray(tags) ? tags : []).some((x) => /kol|renowned/i.test(x)) ? "kol" : "smart",
    };
  }

  function walk(node, url, out, depth) {
    if (!node || depth > 7) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        const t = asTrade(item, url);
        if (t) out.push(t);
        else walk(item, url, out, depth + 1);
      }
      return;
    }
    if (typeof node !== "object") return;
    for (const k of ["list", "data", "activities", "trades", "transactions", "result", "rows", "records", "items", "fills", "events", "ticks"]) {
      if (node[k]) walk(node[k], url, out, depth + 1);
    }
  }

  function pick(body, url) {
    let data = body;
    if (typeof body === "string") {
      try {
        data = JSON.parse(body);
      } catch {
        return [];
      }
    }
    const out = [];
    walk(data, url, out, 0);
    return out;
  }

  function snapshot(url, body) {
    let data = body;
    if (typeof body === "string") {
      try {
        data = JSON.parse(body);
      } catch {
        data = { raw: String(body).slice(0, 400) };
      }
    }
    const keys =
      data && typeof data === "object" && !Array.isArray(data)
        ? Object.keys(data)
        : Array.isArray(data)
          ? ["<array:" + data.length + ">"]
          : [];
    const inner = data && data.data;
    const innerKeys =
      inner && typeof inner === "object" && !Array.isArray(inner)
        ? Object.keys(inner)
        : Array.isArray(inner)
          ? ["<array:" + inner.length + ">"]
          : [];
    const sample = String(typeof body === "string" ? body : JSON.stringify(body || "")).slice(0, 2500);
    bag.peek = { url: String(url).slice(0, 220), keys, innerKeys, sample, n: sample.length };
    bag.peeks = [bag.peek].concat(bag.peeks || []).slice(0, 8);
    console.log("[eg] PEEK", bag.peek.url, "len", sample.length, "keys", keys, "data.keys", innerKeys);
    if (isPoll(url) || sample.length > 40) {
      console.log("[eg] PEEK JSON (bunu earlygem sohbetine yapistir)");
      console.log(JSON.stringify(bag.peek));
      pageCopy(JSON.stringify(bag.peek));
      banner("PEEK " + sample.length + " byte\nkeys " + keys.join(",") + "\n" + sample.slice(0, 900) + "\n\nJSON panoda — earlygem sohbetine yapistir");
    }
  }

  function push(fills) {
    if (!fills.length) return;
    const fresh = [];
    for (const f of fills) {
      const k = f.tx || f.id;
      if (k && seenTx.has(k)) continue;
      if (k) seenTx.add(k);
      fresh.push(f);
    }
    if (!fresh.length) return;
    bag.trades = fresh.concat(bag.trades).slice(0, 500);
    const msg = { type: "eg-gmgn-track", fills: fresh };
    try {
      if (window.opener) window.opener.postMessage(msg, EG);
    } catch (e) {}
    try {
      const eg = window.open("", "earlygem");
      if (eg && eg !== window) eg.postMessage(msg, EG);
    } catch (e) {}
    console.log("[eg] TRACK fill " + fresh.length + " · toplam " + bag.trades.length, fresh[0] && fresh[0].symbol);
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

  function note(kind, url, body) {
    const u = String(url || "");
    bag.hits.unshift({ t: new Date().toISOString(), kind, url: u.slice(0, 220) });
    bag.hits.splice(80);
    const base = u.split("?")[0];
    if (base && !bag.urls.includes(base)) bag.urls.push(base);
    const interesting = trackUrl(u) || isPoll(u) || kind === "ws";
    if (interesting) {
      console.log("[eg] UC", kind, base || u.slice(0, 120), "bytes", String(body || "").length);
      snapshot(u, body);
    }
    if (!trackUrl(u) && kind !== "ws") return;
    try {
      const fills = pick(body, u);
      if (isPoll(u) && !fills.length) console.log("[eg] polling parse 0 — sari kutudaki JSON yeter");
      push(fills);
    } catch (e) {
      console.warn("[eg] parse", e);
    }
  }

  function attachWs(ws, url) {
    if (!ws || ws.__egAttached) return;
    ws.__egAttached = true;
    const u = String(url || ws.url || "");
    if (u && bag.ws.indexOf(u) < 0) bag.ws.push(u);
    console.log("[eg] WS attach", u);
    try {
      ws.addEventListener("message", function (ev) {
        note("ws", u, ev.data);
      });
    } catch (e) {}
  }

  function huntWs() {
    const found = [];
    try {
      performance.getEntriesByType("resource").forEach(function (e) {
        if (/^wss?:/i.test(e.name) && found.indexOf(e.name) < 0) found.push(e.name);
      });
    } catch (e) {}
    bag.wsMeta = {
      perf: found,
      webpackKeys: Object.keys(window).filter(function (k) {
        return /webpackChunk/i.test(k);
      }),
      sockKeys: Object.getOwnPropertyNames(window).filter(function (k) {
        return /socket|quotation|ws/i.test(k);
      }),
    };
    found.forEach(function (u) {
      if (bag.ws.indexOf(u) < 0) bag.ws.push(u);
    });
  }

  if (!window.__egGmgnHookedV4) {
    window.__egGmgnHookedV4 = true;
    const ofetch = window.fetch;
    window.fetch = async function () {
      const url = String(arguments[0] && arguments[0].url ? arguments[0].url : arguments[0]);
      const res = await ofetch.apply(this, arguments);
      try {
        const copy = res.clone();
        const ct = copy.headers.get("content-type") || "";
        if (/json|text/i.test(ct)) copy.text().then(function (t) { note("fetch", url, t); }).catch(function () {});
        else note("fetch", url, "");
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
        note("xhr", this.__egUrl, xhrBody(this));
      });
      return osend.apply(this, arguments);
    };
    const OWS = window.WebSocket;
    window.WebSocket = function (url, proto) {
      const ws = proto !== undefined ? new OWS(url, proto) : new OWS(url);
      attachWs(ws, url);
      return ws;
    };
    window.WebSocket.prototype = OWS.prototype;
    window.WebSocket.OPEN = OWS.OPEN;
    window.WebSocket.CLOSED = OWS.CLOSED;
    window.WebSocket.CONNECTING = OWS.CONNECTING;
    window.WebSocket.CLOSING = OWS.CLOSING;
    const pSend = OWS.prototype.send;
    OWS.prototype.send = function (data) {
      attachWs(this, this.url);
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
            attachWs(this, this.url);
            return desc.set.call(this, fn);
          },
        });
      }
    } catch (e) {}
    const oAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      if (String(type) === "message" && this && this.url && /wss?:/i.test(String(this.url))) attachWs(this, this.url);
      return oAdd.call(this, type, fn, opt);
    };
    const olog = console.log;
    console.log = function () {
      try {
        const s = Array.prototype.map
          .call(arguments, function (a) {
            return typeof a === "string" ? a : "";
          })
          .join(" ");
        if (/QuotationSocketMgr|websocket opened/i.test(s)) {
          olog.call(console, "[eg] SOCKET LOG", s.slice(0, 160));
          huntWs();
        }
      } catch (e) {}
      return olog.apply(console, arguments);
    };
  }

  bag.dump = function () {
    huntWs();
    const payload = {
      urls: bag.urls,
      ws: bag.ws,
      wsMeta: bag.wsMeta,
      peek: bag.peek,
      peeks: bag.peeks,
      hits: bag.hits.slice(0, 20),
      tradeCount: bag.trades.length,
      trades: bag.trades.slice(0, 40),
    };
    const json = JSON.stringify(payload);
    console.log("[eg] DUMP JSON (bunu earlygem sohbetine yapistir)");
    console.log(json);
    pageCopy(json);
    banner("DUMP " + json.length + " byte · peek " + (bag.peek && bag.peek.n) + " · trades " + bag.trades.length + "\nJSON panoda");
    return json;
  };

  huntWs();
  banner("v4 takildi — Track YENILEME. 10 sn bekle, sari kutu gelsin, JSON'u earlygem'e yapistir.");
  console.log("[eg] v4 takildi — YENILEME. 10 sn sonra sari kutu veya __egGmgn.dump()");
  return "[eg] v4 — 10sn bekle, sari kutudaki JSON'u earlygem sohbetine yapistir (kodu degil)";
})();
`;
