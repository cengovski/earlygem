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
