# earlygem

FOMO early gem radar. Tüm feed istekleri **tarayıcıdan / senin IP’nden** gider.

## Akış

1. `/admin` — GMGN, Binance, FOMO, CabalSpy, Telegram vb. key’leri yaz. `localStorage`’da kalır, sunucuya gitmez.
2. Radar her ~25 sn kaynakları tarayıcıdan çeker.
3. Fill’ler **10 dakikalık havuza** yazılır (`eg_10m_pool`). Aynı tx / cüzdan+token+usd çakışmaları elenir.
4. Tape bu havuzu basar.
5. Eşik dolunca CA honeypot taramasından geçer (ücretsiz: GoPlus + Honeypot.is EVM, GoPlus + RugCheck Solana). Telegram’da 🟢 HONEYPOT PASSED veya 🔴 HONEYPOT. Key şart değil. GoPlus panosunda **APP Name yazılmaz**; `goplus` = APP Key, `goplusSecret` = APP Secret. Radar SHA-1 imza ile access token alır.
6. Saatlik özet: DexScreener linki, token ilk düştüğündeki MC, son MC.

```bash
npm install
npm run dev
```

Vercel: Next.js. Admin şifresi `ADMIN_PASSWORD`. Feed key’leri Vercel env değil, tarayıcı.

Telegram çalışmıyorsa `/admin` → **telegram test**. Bot kanalda admin olmalı, chat id `-100…` grup/kanal id’si.

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
