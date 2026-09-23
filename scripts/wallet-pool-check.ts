import { mergeWalletSeeds, sourceOfFill } from "../lib/wallet-pool";
import type { TapeFill } from "../lib/types";

const evm = "0x0a6ebed0155edb4b21d92ad02897a626cd90119e";
const sol = "2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF";

const merged = mergeWalletSeeds([], [
  { address: evm, chain: "base", handle: evm.slice(0, 8), source: "tape" },
  { address: evm.toUpperCase().replace("0X", "0x"), chain: "ethereum", handle: "unipcs", source: "nansen" },
  { address: sol, chain: "solana", handle: "unipcs", source: "known" },
  { address: "0x696d1265c8fc4f14797abebfae3c43ebfa9d8e28", handle: "frankdegods", source: "pump" },
]);

if (merged.length !== 3) {
  console.error("expected 3 rows", merged.length);
  process.exit(1);
}
const evmRow = merged.find((r) => r.family === "evm" && r.address === evm);
if (!evmRow || evmRow.primary !== "nansen" || evmRow.handle !== "unipcs") {
  console.error("evm merge failed", evmRow);
  process.exit(1);
}
if (!evmRow.chains.includes("base") || !evmRow.chains.includes("ethereum") || evmRow.chains.includes("solana")) {
  console.error("chains", evmRow.chains);
  process.exit(1);
}
const solRow = merged.find((r) => r.family === "solana");
if (!solRow || solRow.address !== sol || solRow.chains.join() !== "solana") {
  console.error("sol row", solRow);
  process.exit(1);
}
const bare = merged.find((r) => r.address.endsWith("8e28"));
if (!bare || bare.chains.length !== 0 || bare.family !== "evm") {
  console.error("chainless evm stamped", bare);
  process.exit(1);
}

const again = mergeWalletSeeds(merged, [
  { address: evm, chain: "bsc", handle: "0a6ebed0", source: "binance" },
]);
const againEvm = again.find((r) => r.address === evm);
if (!againEvm || againEvm.handle !== "unipcs" || !againEvm.chains.includes("bsc") || againEvm.primary !== "nansen") {
  console.error("restamp", againEvm);
  process.exit(1);
}
if (again.filter((r) => r.address === evm).length !== 1) {
  console.error("duplicate evm");
  process.exit(1);
}

const fill = { flags: ["nansen", "base"], source: "dexscreener", chain: "base" } as TapeFill;
if (sourceOfFill(fill) !== "nansen") {
  console.error("fill source");
  process.exit(1);
}
const pulse = { flags: ["kol"], source: "fomopulse", chain: "robinhood" } as TapeFill;
if (sourceOfFill(pulse) !== "pulse") {
  console.error("pulse source", sourceOfFill(pulse));
  process.exit(1);
}

console.log("wallet-pool ok", merged.length);
