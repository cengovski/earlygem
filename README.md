# earlygem

FOMO early gem radar. Tüm feed istekleri **tarayıcıdan / senin IP’nden** gider.

## Akış

1. `/admin` — GMGN, Binance, FOMO, CabalSpy, Telegram vb. key’leri yaz. `localStorage`’da kalır, sunucuya gitmez. Takip listesi (Nansen + elle Solana) GMGN `address/name/emoji` JSON olarak export edilir; gmgn.ai/follow’a yapıştır.
2. Radar her ~25 sn kaynakları tarayıcıdan çeker. GMGN iki ayak: **VPS** (`/api/gmgn`, key 2) ve **PC** (doğrudan `openapi.gmgn.ai`, key 1), sırayla. 429 yalnız o ayağı soğutur. Opera PC ayağını keser; Chrome kullan. Termux `keys.json` içinde `gmgn`, `gmgn2`, `gmgnPem` (follow Track imzası), `gmgnProxy` (`https://…/api/gmgn`). Private PEM varsa tape, gmgn.ai/follow listesinin resmi `follow_wallet` akışını kullanır (sayfa scrape yok).
3. Fill’ler **20 dakikalık havuza** yazılır (`eg_10m_pool`). Aynı tx / cüzdan+token+usd çakışmaları elenir. DexScreener MC tape satırına basılır ve Telegram için ~25 sn’de bir yenilenir; $250k altı küme izlenir, bandı geçince gider.
4. Tape bu havuzu basar.
5. Eşik dolunca CA honeypot taramasından geçer (ücretsiz: GoPlus + Honeypot.is EVM, GoPlus + RugCheck Solana). Telegram’da 🟢 HONEYPOT PASSED veya 🔴 HONEYPOT. Key şart değil. GoPlus panosunda **APP Name yazılmaz**; `goplus` = APP Key, `goplusSecret` = APP Secret. Radar SHA-1 imza ile access token alır. Alıcı satırları kaynağa göre ayrılır: `KOL` / `SMART` / `NANSEN` / `BINANCE` / `PUMP` / `AXIOM`.
6. Saatlik özet: DexScreener linki, token ilk düştüğündeki MC, son MC.

```bash
npm install
npm run dev
```

Vercel: Next.js. Admin şifresi `ADMIN_PASSWORD`. Feed key’leri Vercel env değil, tarayıcı.

Nansen: resmi API. `/admin` → Nansen API key. `POST /api/v1/smart-money/dex-trades` **son 24s**, **Solana + Base + Ethereum + BNB + Robinhood**, Smart Trader/30D/90D/180D/Fund, min **$200**, **5 kredi / sayfa** (1000 işlem). Günlük 2 sayfa, «şimdi çek» 3. Liste **21 gün birikir** (tavan 2000). GMGN follow listesine API yazılmaz — export JSON’u [gmgn.ai/follow](https://gmgn.ai/follow) bulk import’a yapıştır. PEM varsa tape yalnız `follow_wallet` (Nansen listesi GMGN Track’te); kol/smart ve wallet_activity aynı listeyi tarmaz.

Telegram çalışmıyorsa `/admin` → **telegram test**. Bot kanalda admin olmalı, chat id `-100…` grup/kanal id’si.

## GMGN public key / follow imzası

`follow_wallet` imzalı auth ister. Çift, API key oluştururken GMGN’e yapıştırdığın public ile aynı olmalı.

```bash
npx gmgn-cli config
```

veya `/admin` → **Ed25519 üret**. Public PEM’i (BEGIN/END dahil) [gmgn.ai/ai](https://gmgn.ai/ai) formuna yapıştır. Dönen API key’i **GMGN key (PC)** kutusuna, private PEM’i **GMGN private key** kutusuna yaz. Private Vercel’e gitmez. API key geldikten sonra CLI: `npx gmgn-cli config --apply <API_KEY>`.

## GoPlus format

GoPlus panosundaki üç alan:

- **APP Name** — yazma. Sadece senin etiketin, API kullanmaz.
- **APP Key** — `/admin` → GoPlus APP Key, veya Termux `keys.json` içinde `"goplus"`.
- **APP Secret** — `/admin` → GoPlus APP Secret, veya `"goplusSecret"`.

İkisini ayrı yapıştır; tek kutuya `Name Key Secret` yazma. Radar `sha1(app_key + time + app_secret)` ile token alır, Token Security çağrılarına `Authorization: Bearer` koyar.

## Android (Chrome değil)

Play Store’da bu radar yok. Chrome / PWA oyun açıkken arka planda ölür. Telefonda **Termux** bir sunucu gibi `npm run watch` çalıştırır; oyun önde kalır.

```bash
pkg update
pkg install nodejs-lts git
git clone https://github.com/cengovski/earlygem.git
cd earlygem
npm install
cp keys.example.json keys.json
# keys.json: telegramBot, telegramChat, goplus (APP Key), goplusSecret (APP Secret)
termux-wake-lock
npm run watch
```

Ayarlar → Uygulamalar → Termux → Pil → **Kısıtlanmamış**. İstersen Termux:API ile kalıcı bildirim, Termux:Boot ile açılışta start.

### Oyunun üstünde küçük kutu

Android arka planı keser; **görünen** küçük pencere süreci önde tutar. Chrome gerekmez.

1. **Termux:Float** (F-Droid / GitHub, Play Store resmi Termux değil). Aç, küçük terminali köşeye küçült. İçinde `cd earlygem && termux-wake-lock && npm run watch`. Sonra oyunu aç. Kutuyu sürükle, şeffaflığı artır.
2. Telefonun kendi yüzen penceresi: son uygulamalar → Termux simgesi → **açılır pencere / pop-up / serbest pencere**. Minik yap, köşeye bırak, oyunu aç.
3. İkisinde de Termux bildirimde kalsın. Bazı oyunlar overlay’i engeller; o zaman 2. yol.

Laptop sayfasının açık olması gerekmez. Feed’ler telefonun IP’sinden gider. Ağır oyun + ısınma yine kesebilir; o zaman mini PC daha durur.
