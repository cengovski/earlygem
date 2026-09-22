export type ChainId =
  | "robinhood"
  | "solana"
  | "base"
  | "bsc"
  | "ethereum"
  | "monad"
  | "arbitrum"
  | "hyperevm"
  | "megaeth"
  | "xlayer"
  | "stable"
  | "arc"
  | "unknown";

export type TapeSide = "buy" | "sell";

export type SmartKind = "kol" | "smart" | "active" | "noise";

export type TapeFill = {
  id: string;
  ts: number;
  chain: ChainId;
  side: TapeSide;
  usd: number;
  amount: number;
  price: number | null;
  token: string;
  symbol: string;
  name: string;
  mcap: number | null;
  liquidity: number | null;
  change24: number | null;
  pairUrl: string | null;
  imageUrl: string | null;
  wallet: string | null;
  handle: string | null;
  followers: number | null;
  profileUrl: string | null;
  rank: number | null;
  tx: string | null;
  firstBuy: boolean;
  flags: string[];
  source: "fomopulse" | "dexscreener";
  smartKind: SmartKind | null;
};

export type GemBuyer = {
  handle: string;
  usd: number;
  ts: number;
  rank: number | null;
  followers: number;
  kind: SmartKind;
  avatarUrl: string | null;
};

export type Gem = {
  id: string;
  chain: ChainId;
  token: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  price: number | null;
  mcap: number | null;
  liquidity: number | null;
  change24: number | null;
  volume24: number | null;
  pairUrl: string | null;
  pairCreatedAt: number | null;
  buyers: number;
  firstBuyer: string | null;
  boughtUsd: number;
  soldUsd: number;
  score: number;
  reasons: string[];
  source: string;
  smartBuyers: GemBuyer[];
  kolCount: number;
  smartCount: number;
  lastSmartTs: number | null;
  bestRank: number | null;
  isStock: boolean;
  launchpad?: string | null;
  honeypot?: boolean | null;
  securityOk?: boolean;
  sellTax?: number | null;
};

export type Trader = {
  handle: string;
  address: string | null;
  solana: string | null;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
  clan: string | null;
  profileUrl: string;
  fills: number;
  volume: number;
  realized: number;
  unrealized: number;
  wins: number;
  trips: number;
  openTokens: number;
  rank: number | null;
  lastTs: number | null;
  kind: SmartKind;
  smartScore: number;
  smartReasons: string[];
};

export type PulseStatus = {
  chainId: number;
  wallets: number;
  trades: number;
  lagSeconds: number;
  latencyMs: number;
  lastBlock: number;
  fills24h: number;
  volume24h: number;
  tokens24h: number;
  biggestBuy: { usd: number; symbol: string; handle: string } | null;
  source: string;
};

export type FindResult = {
  query: string;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  followers: number | null;
  evm: string | null;
  solana: string | null;
  proven: "verified" | "mapped" | "unproven";
  note: string;
  trader: Trader | null;
};
