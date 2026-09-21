const g = globalThis as typeof globalThis & {
  __egPersist?: Map<string, string>;
  __egPersistWrite?: (key: string, value: string) => void;
};

function bag() {
  if (!g.__egPersist) g.__egPersist = new Map();
  return g.__egPersist;
}

export function persistGet(key: string): string | null {
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return bag().get(key) ?? null;
}

export function persistSet(key: string, value: string) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* quota */
    }
    return;
  }
  bag().set(key, value);
  g.__egPersistWrite?.(key, value);
}

export function persistInstall(opts: {
  initial?: Record<string, string>;
  write?: (key: string, value: string) => void;
}) {
  if (opts.initial) {
    for (const [k, v] of Object.entries(opts.initial)) bag().set(k, v);
  }
  if (opts.write) g.__egPersistWrite = opts.write;
}
