import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { attachRosterFlags } from "../lib/alert-msg";
import { runAlertPass } from "../lib/alert-engine";
import { persistInstall, persistSet } from "../lib/persist";
import { maybeFlushHourDigest } from "../lib/hour-client";
import { ingestPool } from "../lib/pool";
import { fetchRadarBundle } from "../lib/radar";
import { telegramConfigured } from "../lib/telegram";
import { WINDOW_MIN } from "../lib/window";
import type { ClientKeys } from "../lib/client-keys";

const POLL_MS = 25_000;

type KeyFile = ClientKeys & {
  windowMin?: number;
  minUsd?: number;
  minBuys?: number;
};

function keysPath() {
  return process.env.EG_KEYS || path.join(process.cwd(), "keys.json");
}

function dataDir() {
  return process.env.EG_DATA_DIR || path.join(process.cwd(), "data");
}

function loadKeys(): KeyFile {
  const file = keysPath();
  if (!fs.existsSync(file)) {
    console.error(`keys.json yok. Önce kopyala: cp keys.example.json keys.json`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as KeyFile;
}

function applyEnv(keys: KeyFile) {
  if (keys.telegramBot) process.env.TELEGRAM_BOT_TOKEN = keys.telegramBot;
  if (keys.telegramChat) process.env.TELEGRAM_CHAT_ID = keys.telegramChat;
  if (keys.gmgn) process.env.GMGN_API_KEY = keys.gmgn;
  if (keys.gmgn2) process.env.GMGN_API_KEY_2 = keys.gmgn2;
  if (keys.gmgnProxy) process.env.GMGN_PROXY = keys.gmgnProxy;
  if (keys.fomo) process.env.FOMOAPI_KEY = keys.fomo;
  if (keys.binanceKey) process.env.BINANCE_WEB3_API_KEY = keys.binanceKey;
  if (keys.goplus) process.env.GOPLUS_API_KEY = keys.goplus;
  if (keys.goplusSecret) process.env.GOPLUS_APP_SECRET = keys.goplusSecret;
  if (keys.honeypotis) process.env.HONEYPOTIS_API_KEY = keys.honeypotis;
  if (keys.nansen) process.env.NANSEN_API_KEY = keys.nansen;
  if (keys.windowMin) process.env.ALERT_WINDOW_MIN = String(keys.windowMin);
  if (keys.minUsd) process.env.ALERT_MIN_USD = String(keys.minUsd);
  if (keys.minBuys) process.env.ALERT_MIN_BUYS = String(keys.minBuys);
}

function bootPersist() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const initial: Record<string, string> = {};
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    initial[name.slice(0, -5)] = fs.readFileSync(path.join(dir, name), "utf8");
  }
  persistInstall({
    initial,
    write: (key, value) => {
      fs.writeFileSync(path.join(dir, `${key}.json`), value);
    },
  });
}

function pingTermux(text: string) {
  try {
    spawn("termux-notification", ["--id", "earlygem", "--ongoing", "--title", "earlygem", "--content", text], {
      stdio: "ignore",
      detached: true,
    }).unref();
  } catch {
    /* not on Termux */
  }
}

async function tick(n: number) {
  const t0 = Date.now();
  const bundle = await fetchRadarBundle({ force: true });
  const tape = ingestPool(attachRosterFlags([...(bundle.tape || []), ...(bundle.solTape || [])], bundle.traders || []), WINDOW_MIN);
  await runAlertPass(tape);
  const hour = await maybeFlushHourDigest();
  const line = `#${n} tape ${tape.length} · pulse ${bundle.tape.length} · sol ${bundle.solTape?.length || 0} · ${Date.now() - t0}ms${hour.sent ? " · saatlik gitti" : ""}`;
  console.log(line);
  pingTermux(line.slice(0, 48));
}

async function main() {
  bootPersist();
  const keys = loadKeys();
  applyEnv(keys);
  persistSet("eg_client_keys", JSON.stringify(keys));
  persistSet(
    "eg_alert_rule",
    JSON.stringify({
      windowMin: keys.windowMin || 20,
      minUsd: keys.minUsd || 1000,
      minBuys: keys.minBuys || 5,
    }),
  );
  if (!telegramConfigured()) {
    console.error("telegramBot + telegramChat keys.json içinde olmalı");
    process.exit(1);
  }
  console.log("earlygem watch · Chrome gerekmez · 25sn radar · MC $250k–$25M");
  pingTermux("izleniyor");
  try {
    spawn("termux-wake-lock", { stdio: "ignore" }).unref();
  } catch {
    /* optional */
  }
  let n = 0;
  for (;;) {
    n += 1;
    try {
      await tick(n);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

void main();
