# Sistem Monitoring Server (backend)

Deskripsi singkat: layanan backend berbasis Next.js (App Router) yang mensimulasikan data server setiap 2 detik dan menyediakan endpoint untuk mengambil data serta menyimpan email pengguna ke MongoDB.

## Fitur

- Simulasi bacaan server (CPU, Memory, Disk, Temperature) setiap 2 detik.
- Logika `Alert Threshold`: jika CPU > 90% atau suhu > 80°C, status alert disimpan ke koleksi `alerts` di MongoDB.
- Endpoint GET `/api/server-status` untuk mengambil status terbaru, riwayat (array titik), dan alert terakhir.
- Endpoint POST `/api/server-status/generate` untuk memaksa pembuatan 1 bacaan (berguna untuk testing).
- Endpoint GET `/api/server-status/history` untuk mengambil riwayat yang tersimpan di DB (query: `?limit=60`).
- Endpoint GET `/api/alerts` untuk melihat log alert terbaru.
- Riwayat bacaan disimpan di koleksi `history` pada MongoDB dan otomatis dihapus setelah 1 hari (TTL). 
- Endpoint POST `/api/email` untuk menyimpan alamat email pengguna ke koleksi `emails`.

## Struktur data (cocok untuk Chart.js / Recharts)

Setiap titik riwayat (`BacaanServer`):

{
  waktu: number,    // timestamp (ms)
  cpu: number,      // 0-100
  mem: number,      // 0-100
  disk: number,     // 0-100
  suhu: number,     // celcius
  alert?: boolean,
  pesanAlert?: string | null,
}

Contoh respon GET `/api/server-status`:

{
  "sukses": true,
  "data": {
    "terbaru": { /* bacaan */ },
    "riwayat": [ /* array bacaan (terurut) */ ],
    "alertTerakhir": { /* bacaan alert */ }
  }
}

## Environment

- `MONGODB_URI` - URL koneksi MongoDB (mis. `mongodb://127.0.0.1:27017/monitoring`)
- `GEMINI_API_URL` - Endpoint Gemini API (contoh: `https://generativelanguage.googleapis.com/v1beta2/models/gemini-1.5-flash:generateText`)
- `GEMINI_API_KEY` - API key untuk Gemini (simpan di `.env.local`, jangan commit ke repo)
- `GOOGLE_GENERATIVE_AI_API_KEY` - (alternate) Google Generative API key used by server actions
- `SOCKET_AUTH_SECRET` - HMAC secret for issuing ephemeral socket tokens (set in `.env.local`)

> Note: This project can run with a custom server (see `server.js`) to enable Socket.io with auth & rate-limiting. Use `npm run dev:custom` to start the custom server during development.
## Cara menjalankan (development)

1. Pastikan `MONGODB_URI` terpasang di `.env.local`.
2. Install dependencies dan jalankan Next.js:

```bash
npm install
npm run dev
```

3. Cek endpoint:

- GET http://localhost:3000/api/server-status
- POST http://localhost:3000/api/email  (body JSON: {"email":"user@example.com"})

## Catatan teknis

- Kode menggunakan TypeScript.
- Nama fungsi dan variabel ditulis dalam Bahasa Indonesia sesuai permintaan.
- Simulasi berjalan di memori (singleton); pastikan environment server tidak sering di-restart jika menginginkan riwayat terus menerus.

