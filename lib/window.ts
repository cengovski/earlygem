/** Single sliding pool: ingest → stack → dedupe → tape → telegram. */
export const WINDOW_MIN = 10;
export const WINDOW_MS = WINDOW_MIN * 60_000;
