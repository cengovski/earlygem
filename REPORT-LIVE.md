# earlygem — canlı Vercel + repo raporu

Tarih: 2026-09-21.  
Repo: [cengovski/earlygem](https://github.com/cengovski/earlygem) `main` @ `27d4b638859c75a17a4e91c76977c4be686c0157`  
(“fix: AlertRadar telegram lock = 10m window”, 2026-09-21 11:14 +0300)

Önceki inceleme (`d4e0c6d`, ~67 commit geride) kapanmış maddeler ve **hâlâ açık prod sızıntısı** aşağıda. Secret değerleri rapora yazılmadı; canlı endpoint’ten sızan Binance key **hemen rotate edilmeli**.

---

## Deploy gerçeği

Aynı Git SHA iki Vercel projesine production olarak basılmış. **Asıl prod `earlygem-live`.** `earlygem` (three) env’siz gölge kopya.

| | earlygem-live | earlygem |
|---|---|---|
| Proje | `prj_vPAzC3sNqWdqkvTi1JI6fMNNalOg` | `prj_KZ7UakDIcF5F2rO0YSOULAcVaWnU` |
| Prod URL | https://earlygem-live.vercel.app | https://earlygem-three.vercel.app |
| Deployment | `dpl_GA4bC4R7cA1qnZCzPp9dAVwvWwU8` READY | `dpl_D2bSyqLD1EkfKTakUYrVhZHEUEG5` READY |
| SHA | `27d4b63` | `27d4b63` |
| Region | fra1 | fra1 |
| Node | 24.x | 24.x |
| Framework | Next.js 15.5.21 | aynı |
| Env | dolu (GMGN, Binance, Telegram, cron, admin, VPS) | **hiç env yok** |
| Password / SSO / IP allow | kapalı | kapalı |

Hobby plan, `cengovski`. Homepage her iki alias’ta **200**, title `earlygem — FOMO erken gem radar`.

`earlygem-live` env anahtarları (değer yok, sadece isim):  
`GMGN_API_KEY`, `BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`, `APP_SECRET`, `ADMIN_PASSWORD`, `FOMOAPI_KEY`, `FOMO_API_KEY`, `ALERT_WINDOW_MIN=10`, `ALERT_MIN_USD=1000`, `ALERT_MIN_BUYS=5`, `PULSE_ORIGIN=http://107.175.85.233:8787` (plain).

---

## Canlı probe (exploit yok)

`earlygem-live.vercel.app`:

| İstek | Sonuç |
|---|---|
| `GET /` `/tape` `/alerts` `/admin` | 200 |
| `GET /api/health` | 200 `{ok, service: earlygem}` |
| `GET /api/debug` | **404** `{error: not_found}` — önceki P1 kapandı |
| `GET /api/cron/alerts` | **401** — secret zorunlu, önceki H1 kapandı |
| `POST /api/telegram` `{test:true}` | **401** — önceki C2 kısmen kapandı |
| `POST /api/refresh` | **401** |
| `GET /api/binance` | **401** |
| `GET /api/binance/sign` | **200, imzalı ticket + canlı API key** — C1 **hâlâ açık** |
| `POST /api/alert-fire` `{}` | **200** `{ok, sent:0}` — Telegram env var, auth yok |
| `GET /api/alert-rule` | 200 `{windowMin:10, minUsd:1000, minBuys:5}` |
| `GET /api/gmgn-feed` | **200** (sunucu GMGN kotası, auth yok) |
| `GET /api/find?q=unipcs` | 200 (Find artık server route) |
| `GET /api/admin/me` | 200 `{ok:false}` |
| `POST /api/hour-flush` | GET 405; POST auth yok (kod) |

`earlygem-three.vercel.app`: aynı SHA ama `binance/sign` **503** `binance_env_yok`, `alert-fire` **503** `telegram_env_yok`. Gölge proje.

VPS `http://107.175.85.233:8787/health` → 200 `{ok:true, settings:true}` (auth yok).  
`POST /api/gmgn/activity` → **401** (önceki açık GMGN proxy kapanmış).

---

## Önceki rapordan ne kapandı

- `/api/telegram`, `/api/cron/alerts`, `/api/refresh`, `/api/gmgn-activity`, `/api/binance` (data) → `requireSecret`.
- `/api/debug` prod’da 404.
- Hardcoded demo GMGN key `lib/gmgn.ts`’ten çıkmış.
- `lib/pulse.ts` içindeki sabit VPS IP kalkmış; origin env’den.
- CF worker CORS `*` → `https://earlygem-live.vercel.app`; `APP_SECRET` gate var.
- VPS proxy `APP_SECRET` + origin allowlist; GMGN POST 401.
- `/api/find` server-side.
- Admin cookie (`HttpOnly; Secure`) + `/admin`.
- Lint/test script `package.json`’da var (build hâlâ ESLint/TS’i yutuyor).

---

## Hâlâ açık / yeni açıklar

### P0 — `GET /api/binance/sign` prod’da key sızdırıyor

`earlygem-live` bu route’a **auth koymamış**. Canlı cevap `tickets[].headers.X-OC-APIKEY` + `X-OC-SIGN` + 60 sn pencere.

Bu raporu yazarken endpoint **gerçek key’i HTTP 200 ile verdi**. Key yanmış kabul edin:

1. Binance Web3 API key/secret’i **hemen rotate**.
2. Route’u silin veya `requireSecret` arkasına alın.
3. İmzayı tarayıcıya hiç vermeyin; `loadBinanceFeedsDirect()` sunucuda kalsın (`GET /api/binance` zaten 401).

`lib/binance.ts` hâlâ `NEXT_PUBLIC_BINANCE_WEB3_API_KEY` / `_SECRET` okuyor. Env’de NEXT_PUBLIC yok (iyi); admin `localStorage` (`eg_client_keys`) client-side HMAC için ayrı risk.

### P0 — `POST /api/alert-fire` ve `POST /api/hour-flush` auth yok

AlertRadar her tape poll’da `/api/alert-fire` çağırıyor. Live’da Telegram **açık**; boş body 200 dönüyor. Eşik gevşek: `buys >= 2 && usd >= 100`, `TOKEN_RE` yok, chain allowlist yok.

`/api/hour-flush` tarayıcıdaki hour-book’u Telegram’a basıyor. Sembol `esc()` var; yine de herkes gruba “saatlik özet” basabilir (spam). Cron boş digest’i atlıyor; bu route atlamıyor.

**Patch:** ikisine de `requireSecret` veya admin session. Client fire yerine cron/admin. Hour-flush’ı kaldırıp sadece cron digest.

### P1 — Çift Vercel projesi, env sapması

`earlygem` (three) env’siz; `earlygem-live` dolu. Aynı SHA. Yanlış URL’ye bakmak “çalışmıyor” sanılır; three’de secret yok diye daha güvenli, live’de sızıntı var.

Tek prod alias: `earlygem-live.vercel.app`. Diğer projeyi dondurun veya silin.

### P1 — `GET /api/gmgn-feed` public, sunucu GMGN key yakar

Auth yok, `maxDuration 30`. Her GET `fetchExternalFeeds()`.

### P1 — Admin login: rate limit yok, cookie zayıf

`checkPassword` timing-safe. Cookie = `exp.HMAC(exp)`; user id yok. `signKey` = `CRON_SECRET || APP_SECRET || ADMIN_PASSWORD`. CRON_SECRET sızarsa admin cookie forge edilir. Brute-force koruması yok. `ADMIN_PASSWORD` `.env.example`’da yok.

### P1 — `PULSE_ORIGIN` plain + VPS `/health` açık

Env’de IP `http://107.175.85.233:8787` **plain** (Vercel dashboard’da gizlenmiyor). Health auth’süz. GMGN kilitli; Pulse relay allowlist’i hâlâ duruyor — `APP_SECRET` yoksa `gated()` false (kod: `if (!GATE) return false`).

### P2 — Client key deposu

`/admin` GMGN / Binance / CabalSpy / Bitquery key’lerini `localStorage` (`eg_client_keys`) yazar. XSS = key çalma. `NEXT_PUBLIC_*` slot’ları bundle’a sızmaya hazır; şu an env’de set değil.

Radar 25 sn `force: true` poll. Her açık sekme Pulse + GMGN + extra feeds.

### P2 — Build kalitesi geriledi

```ts
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },  // önceki false idi
```

TS hatalı kod prod’a girebilir. Test hâlâ `echo`.

### P2 — Ürün / alert sapması

- UI kuralı env `10dk / $1000 / 5 alış`; AlertRadar client lock = 10 dk `localStorage` (sekme bazlı, her tarayıcı ayrı).
- Cron öğlen UTC saatlik digest; anlık alert client `alert-fire`.
- Hour book serverless `let book` — instance kayınca boş.
- `featured` / skor önceki rapordaki heuristic’ler duruyor; CabalSpy opsiyonel, key yoksa skip (commit mesajı).

### P3

- README hâlâ 10 satır; admin, cron, VPS, CabalSpy yok.
- `.env.example` `ADMIN_PASSWORD`, extra feed key’leri yok.
- `images.remotePatterns: **` duruyor.
- `worker.js` hâlâ UA spoof edebilir (eski davranış); CORS düzelmiş.

---

## Auth matrisi (canlı `earlygem-live`)

| Route | Canlı | Kod |
|---|---|---|
| `/api/health` | 200 açık | açık |
| `/api/debug` | 404 | prod 404 |
| `/api/cron/alerts` | 401 | `requireSecret` |
| `/api/telegram` | 401 | `requireSecret` |
| `/api/refresh` | 401 | `requireSecret` |
| `/api/binance` | 401 | `requireSecret` |
| `/api/gmgn-activity` | (probe yok) | `requireSecret` |
| `/api/binance/sign` | **200 + key** | **auth yok** |
| `/api/alert-fire` | **200** | **auth yok** |
| `/api/hour-flush` | POST açık | **auth yok** |
| `/api/gmgn-feed` | **200** | **auth yok** |
| `/api/alert-rule` | 200 kural JSON | açık (ok) |
| `/api/admin/*` | cookie | `sessionOk` |
| VPS `/health` | 200 | açık |
| VPS `/api/gmgn/activity` | 401 | `APP_SECRET` |

---

## Hemen yapılacak (sıra)

1. **Binance Web3 key rotate.** `/api/binance/sign` sil veya 401. Client ticket modelini bırak.
2. `/api/alert-fire` + `/api/hour-flush` kilitle veya sil; Telegram’ı cron/admin’e çek.
3. `/api/gmgn-feed` kilitle.
4. `earlygem` (three) projesini durdur; tek prod `earlygem-live`.
5. `PULSE_ORIGIN`’i secret yap; VPS `/health`’e gate.
6. `typescript.ignoreBuildErrors` → `false`.
7. Admin login’e kaba rate limit; cookie’ye nonce/user bağla.
8. `localStorage` API secret’larını kaldır; sunucu env yeterli.

Önceki `REVIEW.md` patch’leri (auth helper, sign silme, cron zorunlu secret) kısmen uygulandı. Prod’da kalan delik: **imza endpoint + client telegram fire**.
