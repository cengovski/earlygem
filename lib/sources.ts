import { KNOWN_WALLETS, normalizeHandle } from "./known";
import { logEvent } from "./log";
import { getJson, getPulse, PULSE } from "./pulse";
import { featuredGems, rankGems, scoreGem } from "./score";
import { classifyTrader, isWatchedKind, traderIndex } from "./smart";
import type { ChainId, FindResult, Gem, GemBuyer, PulseStatus, SmartKind, TapeFill, Trader } from "./types";

const DEX = "https://api.dexscreener.com";
const FOMOAPI = "https://api.fomoapi.io";
const JUNK_SYMBOL = new Set(["sol", "wsol", "usdc", "usdt", "eth", "weth", "bnb", "wbnb", "btc", "wbtc", "pump", "pumpfun"]);
