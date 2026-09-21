# earlygem

FOMO early gem radar. Tüm feed istekleri **tarayıcıdan / senin IP’nden** gider.

## Akış

1. `/admin` — GMGN, Binance, FOMO, CabalSpy, Telegram vb. key’leri yaz. `localStorage`’da kalır, sunucuya gitmez.
2. Radar her ~25 sn kaynakları tarayıcıdan çeker.
3. Fill’ler **10 dakikalık havuza** yazılır (`eg_10m_pool`). Aynı tx / cüzdan+token+usd çakışmaları elenir.
4. Tape bu havuzu basar.
5. Eşik (varsayılan 10 dk / $1000 / 5 alım, 2 farklı handle) dolunca alarm tarayıcıdan Telegram’a gider. Market cap **$250k–$25M** dışındakiler basılmaz. Aynı token 10 dk’da bir kez gider; panelde **gönderildi** görünür.
6. Saatlik özet: DexScreener linki, token ilk düştüğündeki MC, son MC.

```bash
npm install
npm run dev
```

Vercel: Next.js. Admin şifresi `ADMIN_PASSWORD`. Feed key’leri Vercel env değil, tarayıcı.

Telegram çalışmıyorsa `/admin` → **telegram test**. Bot kanalda admin olmalı, chat id `-100…` grup/kanal id’si.

## Android (Chrome değil)

Play Store’da bu radar yok. Chrome / PWA oyun açıkken arka planda ölür. Telefonda **Termux** bir sunucu gibi `npm run watch` çalıştırır; oyun önde kalır.

```bash
pkg update
pkg install nodejs-lts git
git clone https://github.com/cengovski/earlygem.git
cd earlygem
npm install
cp keys.example.json keys.json
# keys.json içine telegramBot, telegramChat ve feed key’lerini yaz
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
