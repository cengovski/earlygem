/** Single sliding pool: ingest → stack → dedupe → tape → telegram. */
export const WINDOW_MIN = 20;
export const WINDOW_MS = WINDOW_MIN * 60_000;
/** DexScreener MC for telegram: refresh often so a sub-$250k print can cross the band. */
export const ALERT_MCAP_TTL_MS = 25_000;
