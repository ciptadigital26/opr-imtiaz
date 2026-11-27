# OPR IDEXS GENERATOR – SM Imtiaz YT Dungun

Aplikasi web (satu fail `index.html`) dengan backend **Vercel API Routes**.
Supabase digunakan hanya untuk log masuk, pangkalan data dan storan gambar.

```
index.html               ← aplikasi
api/telegram-send.js     ← POST /api/telegram-send  (hantar OPR ke Telegram)
api/ai-extract.js        ← POST /api/ai-extract     (AI OCR & jana impak)
api/_lib.js              ← fungsi bantu (bukan route)
package.json, vercel.json
supabase/schema.sql      ← jadual, RLS, storan (jalankan sekali di Supabase)
```

## 1. Supabase (log masuk + data)

1. Cipta projek di https://supabase.com.
2. **SQL Editor** → tampal `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: salin **Project URL** dan **anon public key**.
4. **Authentication → URL Configuration**: set *Site URL* kepada URL Vercel anda.

## 2. index.html

URL projek dan publishable key Supabase sudah diisi dalam blok **KONFIGURASI** (`SUPABASE_URL`, `SUPABASE_KEY`).
Jika anda tukar projek Supabase, kemas kini dua nilai itu. Gunakan URL projek sahaja, tanpa `/rest/v1/`.

## 3. Deploy ke Vercel

1. Muat naik folder ini ke GitHub → **Vercel → Add New → Project → Import**.
   Framework preset: **Other**, tanpa build command.
2. **Settings → Environment Variables** (Production), tambah:

| Nama | Nilai |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token baharu daripada @BotFather |
| `TELEGRAM_CHAT_ID` | ID group, contoh `-1001234567890` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (untuk AI OCR) |
| `SUPABASE_URL` | `https://iltqnzdzjzmtwfepkbjj.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable key yang sama seperti dalam index.html |
| `AI_MODEL` | (pilihan) default `claude-sonnet-5-5` |

3. **Deployments → Redeploy** supaya Environment Variables berkuat kuasa.

Semak API: buka `https://<app-anda>.vercel.app/api/telegram-send`. Ia sepatutnya papar `"configured":true`.

**Chat ID group:** tambah bot ke group dan jadikannya admin. Hantar satu mesej dalam group, kemudian buka
`https://api.telegram.org/bot<TOKEN>/getUpdates` dan salin `chat.id` (bermula `-100…`).

## 4. Admin pertama

Daftar akaun di aplikasi, kemudian dalam Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'emel-anda@contoh.com';
```

Log keluar dan log masuk semula. Dalam **Tetapan**, tekan **Uji sambungan Telegram**.

## Nota had Vercel

- Saiz permintaan maksimum 4.5 MB. Aplikasi mengecilkan gambar sebelum dihantar ke AI, dan
  OPR dihantar ke Telegram sebagai JPG atau PDF.
- `ai-extract` dibenarkan berjalan sehingga 60 saat (`vercel.json`).
