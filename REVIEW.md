# earlygem — inceleme ve patch raporu

Kaynak: [cengovski/earlygem](https://github.com/cengovski/earlygem) (`main` @ `d4e0c6d`, 2026-09-20).  
Kapsam: repo ağacı, API yüzeyleri, secret akışı, VPS/CF proxy, skor/alert mantığı, ölü kod. Canlı prod’a exploit denemesi yapılmadı.

## Yönetici özeti

earlygem, FOMO KOL/smart cüzdan alışlarını birleştiren bir Next.js 15 radar. Pulse (fomopulse) Vercel IP’den 403 yediği için veri **tarayıcıdan** çekiliyor; Binance imzası ve Telegram gönderimi de tarayıcıya açık API’lere bağlanmış. Bu tasarım, birkaç **kritik kimlik doğrulama boşluğu** üretiyor.

En acil üç iş:

1. `/api/binance/sign` Binance API key + HMAC imzasını herkese veriyor.
2. `/api/telegram` auth yok; bot spam / HTML enjeksiyonu.
3. VPS proxy (`107.175.85.233:8787`) ve CF worker CORS `*`, auth yok; GMGN kotası yakılabilir.

Auth eklenmeden prod’a secret koymayın.

---

## Mimari (kısa)

```
[tarayıcı] ──fetchRadarBundle(force)──► pulse / GMGN / DexScreener
     │                                    ▲
     ├─ GET  /api/binance/sign  ──► tickets {url, X-OC-APIKEY, X-OC-SIGN}
     ├─ POST /api/gmgn-activity ──► GMGN_API_KEY (sunucu)
     ├─ POST /api/telegram      ──► TELEGRAM_BOT_TOKEN (sunucu)
     └─ GET  /api/upstream/*    ──► VPS http://107.175.85.233:8787
                                      └─ GMGN_API_KEY + fomopulse relay

[Vercel cron 12:00 UTC] GET /api/cron/alerts
     └─ CRON_SECRET yoksa herkese açık
```

Radar asıl olarak `components/RadarProvider.tsx` içinde 45 sn’de bir `force: true` ile çalışır. `/api/cron/alerts` ayrı, in-memory cooldown paylaşılmaz.

---

## Bulgular

### P0 — Kritik

#### C1. Binance imza sızıntısı (`/api/binance/sign`)

`lib/binance.ts` tarayıcıdaysa imzalı ticket ister; route auth kontrol etmez.

```6:12:app/api/binance/sign/route.ts
export async function GET() {
  if (!binanceConfigured()) {
    return NextResponse.json({ ok: false, error: "binance_env_yok" }, { status: 400 });
  }
  const tickets = await signBinanceJobs();
  return NextResponse.json({ ok: true, tickets });
}
```

Ticket içinde `X-OC-APIKEY` (kalıcı key) ve `X-OC-SIGN` (60 sn pencere) var. Saldırgan endpoint’i poll’layıp dört Binance Web3 işini sürekli imzalatır.

**Etki:** API key ifşası, kota/abuse, olası hesap kısıtı.  
**Patch:** İmza asla client’a dönmesin. Sadece sunucu `loadBinanceFeedsDirect()` kullansın; `/api/binance/sign` silinsin veya iç proxy’ye çevrilsin.

#### C2. Auth’süz Telegram (`POST /api/telegram`)

`RadarProvider` her poll’da `fireTapeAlerts()` çağırır → her açık sekme `/api/telegram`’a POST atar. Alerts sayfasındaki “test mesaj” da aynı endpoint.

**Etki:**

- Bot’a rastgele HTML mesaj (token/chain `href` içinde escape edilmiyor).
- `test: true` ile sınırsız test spam.
- Payload’daki `symbol`/`name`/`handles` `esc()` ile kaçıyor; `chain` ve `token` URL’de kaçmıyor:

```98:101:lib/alert-msg.ts
export function tokenLinks(chain: ChainId, token: string) {
  const dex = `https://dexscreener.com/${chain}/${token}`;
  const gmgn = `https://gmgn.ai/${gmgnChain(chain)}/token/${token}`;
```

`chain=solana" onclick="alert(1)` veya `token=x"><script` HTML parse’ını bozar (`parse_mode: HTML`).

**Patch:** Ortak `requireAppAuth()`. Telegram’ı sadece cron/server-side cluster’dan gönder. Client `fireTapeAlerts` kalksın. `chain` allowlist + `token` `[a-zA-Z0-9]+` + `encodeURIComponent`.

#### C3. Açık VPS + CF worker (GMGN/Pulse proxy)

Sabit IP birden fazla yerde: `lib/pulse.ts`, `app/api/upstream/[...path]/route.ts`, `vps/proxy.mjs`.

- `vps/proxy.mjs`: `0.0.0.0:8787`, CORS `*`, `POST /api/gmgn/activity` auth yok, `GMGN_API_KEY` ile upstream.
- `worker.js`: path allowlist var ama CORS `*` ve tarayıcı UA/Referer spoof (CF ToS riski).
- `/health` gerçek IP’yi JSON’da basıyor.

**Etki:** İnternetten GMGN kotası yakma, Pulse’a açık relay, altyapı ifşası.  
**Patch:** Shared secret header (`X-Earlygem-Key`). CORS’u app origin’e sık. IP’yi koddan çıkar, sadece `PULSE_ORIGIN`. Worker’ı aynı secret ile kilitle.

### P1 — Yüksek

#### H1. Cron secret opsiyonel

```11:16:app/api/cron/alerts/route.ts
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cron = process.env.CRON_SECRET;
  if (cron && auth !== `Bearer ${cron}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
```

`CRON_SECRET` yoksa 60 sn radar + Telegram herkese açık. `.env.example`’da da yok.

**Patch:** Secret zorunlu olsun; yoksa 503. Vercel cron `Authorization: Bearer CRON_SECRET` ekler.

#### H2. `/api/debug` ve `/api/gmgn-activity` açık

- Debug: origin listesi, DexScreener sample, in-memory log. Prod recon.
- `POST /api/gmgn-activity`: body’deki cüzdanlarla GMGN çağrısı; demo key fallback (`gmgn_solbscbaseethmonadtron`) kotayı paylaşır.

**Patch:** Debug’ı `NODE_ENV !== "production"` veya auth arkasına al. GMGN route’una auth + trader sayısı limiti (zaten 3–4 job; yine de auth şart). Demo key’i sil; key yoksa feed’i skip et.

#### H3. `/api/refresh` auth yok

Cache bust + `revalidatePath("/", "layout")`. DoS / gereksiz rebuild. Client zaten `radar.reload()` yapıyor; server bust şart değil.

#### H4. Alert eşiği yalan söylüyor

UI kuralı `localStorage` (`earlygem.alert`). Cron `DEFAULT_RULE` kullanır (`3 dk / $2500 / 3 alış`). Asıl spam yolu client poll + `/api/telegram`. Kullanıcı eşiği sandığı şeyi sunucu uygulamaz.

**Patch:** Tek kaynak: env veya KV. Client’tan alert atma.

### P2 — Orta

#### M1. Hardcoded GMGN demo key

```4:15:lib/gmgn.ts
const DEMO_KEY = "gmgn_solbscbaseethmonadtron";
export function gmgnApiKey() {
  return process.env.GMGN_API_KEY || DEMO_KEY;
}
```

`lib/gmgn-key.ts` aynı fonksiyonu boş fallback ile tanımlıyor; **hiç import edilmiyor**. Ölü kod + kafa karışıklığı.

#### M2. In-memory store serverless’da işe yaramaz

`lib/store.ts` / `lib/log.ts` / Telegram cooldown `Map` instance’a bağlı. Vercel’de instance değişince cache/cooldown sıfır. Duplicate Telegram ve “fresh cache” illüzyonu.

**Patch:** Upstash Redis veya en azından Telegram için KV. Yoksa cooldown’u token+saat bucket ile Telegram tarafında belgele.

#### M3. Çift `fetchRadarBundle`

| Dosya | Kullanım |
|---|---|
| `lib/radar.ts` | UI + cron (asıl) |
| `lib/sources.ts` | `fetchAllGems` / `fetchMixedTape` — UI’dan çağrılmıyor |

`sources.ts` içindeki `fetchSolanaGems` de `dexwatch.fetchSolWatch` ile örtüşüyor. Bakım maliyeti, skor sapması.

#### M4. `FOMOAPI_KEY` Find sayfasında ölür

`findTrader()` client’tan koşar. `FOMOAPI_KEY` `NEXT_PUBLIC_` değil → tarayıcıda `undefined`. README “optional FOMOAPI_KEY” diyor; UI hiç kullanmaz.

**Patch:** `POST /api/find` server route.

#### M5. 45 sn `force: true` poll

Her açık sekme Pulse + GMGN + Binance sign + DexScreener. Kota ve rate-limit’in asıl kaynağı bu. `FRESH_MS = 25s` client `force` yüzünden bypass.

#### M6. ESLint build’de kapalı

```3:4:next.config.ts
eslint: { ignoreDuringBuilds: true },
```

PR #1 (Vercel Agent, draft) `sources.ts` içinde `await` in non-async `map` düzeltmesinden bahsediyor — bu `main`’de hâlâ riskli alan. Lint’i açın.

#### M7. `images.remotePatterns: hostname **`

Next Image her HTTPS host. SSRF/image abuse yüzeyi (şu an az `next/image` kullanımı olsa da config geniş).

#### M8. Scoring / ürün boşlukları

- `classifyTrader` follower + rank; cüzdan ≠ profil uyarısı kodda var, UI’da zayıf.
- Pump.fun roster’ı `kind: smart`’e zorlanıyor (`noise` → `smart`).
- `featuredGems` `securityOk === true` ister; GMGN scan 16 token / 10 sn timeout — çoğu gem featured’a giremez.
- Launchpad `token.endsWith("pump")` heuristic; yanlış pozitif.
- Wrapped-base filtresi alert’te var, skor/featured’da yok (WETH cluster hâlâ tape’de).
- `scam.ts` blocklist 2 adres; bakımı yok.

### P3 — Düşük / hijyen

- README 10 satır; env’lerin çoğu (Telegram, Binance, cron, VPS) belgesiz.
- `.env.example` `CRON_SECRET` / `FOMOAPI_KEY` / `PULSE_ORIGIN` eksik.
- Test yok. `package.json`’da `lint`/`test` script yok.
- `preferredRegion = fra1` layout + bazı route’larda; worker/VPS US IP — latency/CF mismatch.
- `worker.js` Cloudflare `cf: { cacheTtl }` — Next bundle’ına da konmuş; Vercel’de no-op.
- Açık PR #1: Vercel Web Analytics. Güvenlikle ilgisiz; merge öncesi `sources.ts` “bonus fix” iddiasını doğrula.

---

## Önerilen sıra

1. Secret’ları rotate et (Binance, Telegram, GMGN) — sign endpoint public olduğu sürece key yanmış sayılır.
2. Auth helper + C1/C2/H1/H2/H3 kapat.
3. VPS/worker’a shared secret; hardcoded IP çık.
4. Client alert ve `/api/binance/sign` kaldır; radar server-side veya tek `/api/radar` JSON.
5. Demo GMGN key + ölü `gmgn-key.ts` + duplicate `sources.fetchRadarBundle` sil.
6. `.env.example` + README. ESLint’i build’de aç. Find’i server route yap.

---

## Patch’ler (uygulanacak diff’ler)

Aşağıdaki patch’ler earlygem repo’suna yönelik. Bu workspace kopyası değil; hedef: `cengovski/earlygem`.

### P-auth — ortak bearer

`.env.example` ekle:

```
CRON_SECRET=
APP_SECRET=
```

`APP_SECRET` yoksa `CRON_SECRET` kullan. Client radar’ı server `/api/radar` arkasına alınca tarayıcıya secret koyma; cron ve iç route’lar server-only kalsın.

```ts
// lib/auth.ts
import { NextResponse } from "next/server";

export function appSecret() {
  return process.env.APP_SECRET || process.env.CRON_SECRET || "";
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export function requireSecret(req: Request) {
  const secret = appSecret();
  if (!secret) return NextResponse.json({ ok: false, error: "auth_unconfigured" }, { status: 503 });
  const header = req.headers.get("authorization") || "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (bearer !== secret && query !== secret) return unauthorized();
  return null;
}
```

Query `?secret=` sadece cron fallback; tercihen header.

### P-C1 — Binance ticket’ı kapat

`app/api/binance/sign/route.ts` sil.

`lib/binance.ts` içinde `fetchBinanceFeeds` her zaman `loadBinanceFeedsDirect()`:

```ts
export async function fetchBinanceFeeds() {
  return loadBinanceFeedsDirect();
}
```

UI Binance’i sunucu `/api/binance` (auth’lu) üzerinden alsın; key header’ı tarayıcıya gitmesin.

`app/api/binance/route.ts`:

```ts
import { requireSecret } from "@/lib/auth";
import { loadBinanceFeedsDirect } from "@/lib/binance";

export async function GET(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const data = await loadBinanceFeedsDirect().catch(() => ({ fills: [], traders: [] }));
  return Response.json({ ok: true, ...data });
}
```

### P-C2 — Telegram kilidi + URL escape

`app/api/telegram/route.ts`:

```ts
import { requireSecret } from "@/lib/auth";
import { CHAINS } from "@/lib/types"; // veya yerel allowlist

const TOKEN_RE = /^[a-zA-Z0-9]{32,64}$|^0x[a-fA-F0-9]{40}$/;

export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  // ... mevcut telegramConfigured kontrolü
  const chain = body?.chain;
  const token = body?.token || "";
  if (body?.test) { /* sadece secret sonrası */ }
  if (!CHAINS.includes(chain) || !TOKEN_RE.test(token) || usd <= 0) {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }
}
```

`lib/alert-msg.ts` `tokenLinks`:

```ts
export function tokenLinks(chain: ChainId, token: string) {
  const c = encodeURIComponent(chain);
  const t = encodeURIComponent(token);
  const dex = `https://dexscreener.com/${c}/${t}`;
  const gmgn = `https://gmgn.ai/${gmgnChain(chain)}/token/${t}`;
  // ...
}
```

`components/RadarProvider.tsx` içinden `fireTapeAlerts` satırını sil. Alert yalnızca cron.

### P-H1 — cron zorunlu secret

```ts
export async function GET(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  // ...
}
```

`vercel.json` aynı path; Vercel dashboard’da `CRON_SECRET` set.

### P-H2 — debug / gmgn / refresh

```ts
// app/api/debug/route.ts
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // ...
}
```

`app/api/gmgn-activity/route.ts` ve `app/api/refresh/route.ts` başına `requireSecret`.

`lib/gmgn.ts`:

```ts
export function gmgnApiKey() {
  return process.env.GMGN_API_KEY || "";
}
export function gmgnConfigured() {
  return Boolean(gmgnApiKey());
}
```

`fetchGmgnWalletTape` başında `if (!gmgnConfigured()) return [];`  
`lib/gmgn-key.ts` sil.

### P-C3 — VPS / upstream

`vps/proxy.mjs` (özet):

```js
const GATE = process.env.APP_SECRET || "";
function gated(req) {
  if (!GATE) return false;
  const auth = req.headers["authorization"] || "";
  return auth === `Bearer ${GATE}`;
}
// OPTIONS hariç her handler başında:
if (!gated(req)) {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
  return;
}
```

CORS:

```js
res.setHeader("Access-Control-Allow-Origin", process.env.APP_ORIGIN || "https://YOUR_APP.vercel.app");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
```

`/health` IP basmasın: `{ ok: true }`.

`lib/pulse.ts` / upstream:

```ts
const VPS = (process.env.PULSE_ORIGIN || "").replace(/\/$/, "");
```

Fallback hardcoded IP yok. `worker.js` ALLOW listesini koru; `authorization` doğrula; UA spoof’u kaldır (kendi `earlygem-worker` UA).

### P-H4 / Find

`app/api/find/route.ts`:

```ts
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ error: "q_required" }, { status: 400 });
  const row = await findTrader(q);
  return NextResponse.json(row);
}
```

`app/find/page.tsx` `findTrader(q)` yerine `fetch("/api/find?q="+encodeURIComponent(q))`.

Alert UI metnini değiştir: “eşik sadece bu tarayıcıda; sunucu cron `DEFAULT_RULE` kullanır” — veya kuralı env’den oku:

```
ALERT_WINDOW_MIN=3
ALERT_MIN_USD=2500
ALERT_MIN_BUYS=3
```

### P-M3 — ölü kod

Sil veya tek yola indir:

- `lib/sources.ts` → `fetchRadarBundle`, `fetchAllGems`, `fetchMixedTape`, `fetchSolanaGems` (UI `lib/radar.ts` + `lib/dexwatch.ts` kullanıyor)
- `lib/gmgn-key.ts`

### P-M6 — lint

`next.config.ts`: `eslint: { ignoreDuringBuilds: true }` satırını kaldır.  
`package.json` scripts:

```json
"lint": "next lint",
"test": "echo \"no tests yet\" && exit 0"
```

---

## Auth matrisi (hedef durum)

| Route | Şimdi | Hedef |
|---|---|---|
| `GET /api/health` | açık | açık (liveness) |
| `GET /api/debug` | açık | 404 prod / auth |
| `GET /api/binance/sign` | açık + key sızdırır | **sil** |
| `GET /api/binance` | açık, sunucu fetch | `requireSecret` |
| `POST /api/telegram` | açık | `requireSecret` veya sil (sadece cron) |
| `GET /api/cron/alerts` | secret **opsiyonel** | secret **zorunlu** |
| `POST /api/gmgn-activity` | açık | `requireSecret` veya iç fonksiyon |
| `POST /api/refresh` | açık | `requireSecret` veya sil |
| `GET /api/upstream/*` | açık proxy | secret + allowlist |
| `POST VPS /api/gmgn/activity` | açık | Bearer `APP_SECRET` |

---

## Doğrulama (patch sonrası)

Manuel, exploit PoC yok:

1. `curl -i https://<app>/api/binance/sign` → 404.
2. `curl -i -X POST https://<app>/api/telegram -H 'content-type: application/json' -d '{"test":true}'` → 401.
3. `curl -i https://<app>/api/cron/alerts` → 401; `Authorization: Bearer $CRON_SECRET` ile 200.
4. `curl -i https://<app>/api/debug` prod → 404.
5. VPS `curl -i http://$PULSE_ORIGIN/api/gmgn/activity` POST → 401.
6. Alerts sayfası “test mesaj” ya kalkar ya da server-only.
7. `GMGN_API_KEY` boşken app ayağa kalkar, feed boş, crash yok.
8. `next build` ESLint açıkken geçer.

---

## Bilinçli kapsam dışı

- Canlı Binance/Telegram/GMGN key’lerine istek atılmadı.
- VPS kutusuna login/scan yok.
- Skor modelinin “doğru gem” performansı (backtest yok).
- Vercel Analytics PR (#1) merge kararı.

## Sonuç

Ürün yönü net (FOMO tape + multi-chain discovery) ama **secret’lı endpoint’ler public**. Önce auth ve imza sızıntısı; sonra proxy sertleştirme ve ölü kod. Alert’i tarayıcıdan kesip cron’a almak hem spam’i hem C2’yi kapatır.
