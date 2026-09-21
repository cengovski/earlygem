import type { ChainId } from "./types";

export type ChainLane = {
  id: ChainId;
  short: string;
  title: string;
  source: "pulse" | "dex";
  blurb: string;
};

export const CHAIN_LANES: ChainLane[] = [
  { id: "robinhood", short: "RH", title: "Robinhood Chain", source: "pulse", blurb: "Tek ağda FOMO handle + tape fill var. Smart küme buradan." },
  { id: "solana", short: "SOL", title: "Solana", source: "dex", blurb: "FOMO SOL cüzdanı çözüldüyse swap tape. Yoksa DexScreener izleme." },
  { id: "base", short: "BASE", title: "Base", source: "dex", blurb: "FOMO app’te var. Cüzdan/handle eşlemesi yok — sadece havuz izleme." },
  { id: "bsc", short: "BSC", title: "BNB Chain", source: "dex", blurb: "FOMO app’te var. Public KOL tape yok." },
  { id: "ethereum", short: "ETH", title: "Ethereum", source: "dex", blurb: "FOMO app’te var. Public KOL tape yok." },
  { id: "monad", short: "MON", title: "Monad", source: "dex", blurb: "FOMO app’te var. Public KOL tape yok." },
];
