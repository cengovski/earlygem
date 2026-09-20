export const KNOWN_WALLETS: Record<string, { evm?: string; solana?: string; note: string }> = {
  unipcs: {
    evm: "0x0a6ebed0155edb4b21d92ad02897a626cd90119e",
    solana: "2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF",
    note: "fomopulse tape + public PnL list",
  },
  dumbcrayoneater: {
    evm: "0x8f62a08537cede87d511aca6436274ab4ca080a3",
    solana: "5FGoPPj1nL8LCnfVnpTmreqQtqLuMXXAwuS1uahMrp8V",
    note: "public all-time PnL list Aug 2026",
  },
  mino: {
    evm: "0x6ab164092c03cf84f5e2d4ea968678062c774772",
    solana: "BApmmTd7dcnRsBTUZ9ciKmugTwAreFzKwFWGnEKeGtGr",
    note: "fomoapi sample",
  },
  frankdegods: {
    evm: "0x696d1265c8fc4f14797abebfae3c43ebfa9d8e28",
    solana: "498g1rVnFcnjBjpfw1xyqA1WvgQXUU8RWuELjxkjAayQ",
    note: "fomoapi sample",
  },
};

export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?fomo\.family\/profile\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}
