# Ambara — AI Hybrid Multi-Agen

> Berbagai AI dalam 1 genggaman — sekali unduh, gratis dipakai semua akun, jalan offline, diskusi multi-agen otomatis dari karakter yang kamu aktifkan.

## ⚡ Cara Menjalankan

### Cara 1: Langsung buka (paling cepat)
1. Ekstrak ZIP ini
2. Klik ganda `index.html` — terbuka di browser modern (Chrome/Edge/Firefox/Safari)

### Cara 2: Install sebagai aplikasi ke homescreen HP/laptop
1. Hosting folder ini ke salah satu:
   - **GitHub Pages** (gratis, https)
   - **Netlify Drop** — drag folder ke https://app.netlify.com/drop
   - **Vercel** / **Cloudflare Pages** — connect repo
2. Buka URL HTTPS di Chrome/Safari → klik **"Add to Home Screen"**
3. Aplikasi ter-install, buka seperti app native (offline-ready via Service Worker)

### Cara 3: Lokal dengan server
```bash
# pakai Python
python3 -m http.server 8000
# atau pakai Node
npx serve .
```
Lalu buka http://localhost:8000

## 📁 Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Aplikasi lengkap (UI + logika) |
| `manifest.json` | PWA manifest (installable ke homescreen) |
| `icon.svg` | Icon aplikasi |
| `sw.js` | Service Worker (cache offline) |
| `model-registry.json` | Daftar model kecil opsional |
| `README.md` | Dokumen ini |

## 🎯 Fitur Utama

- **Model tunggal, sekali unduh, dipakai bersama**: tidak perlu unduh ulang per akun
- **Multi-agen otomatis**: tambah karakter tanpa batas → 1 aktif = jawaban tunggal, 2+ aktif = diskusi multi-agen otomatis dengan panel diskusi di atas dan kesimpulan ∑ di bawah jawaban
- **Karakter sebagai "sifat"**: bukan peran tetap — Neuroboro (analitis), Genspark (lengkap), Meta AI (inklusif), Akademisi, Brainstorm, Data First, Teman Diskusi, Detektif, Pengacara, Stoik, atau tulis sendiri
- **6 tema**: Graphite, Ink Teal, Paper, Kontras Tinggi, Violet, Sunset
- **Multi-akun di perangkat yang sama** dengan profil terpisah (gaya bahasa, panjang jawaban, karakter sendiri)
- **Sinkron opsional**: GitHub / Google Drive / Firebase (wiring tinggal isi token)
- **Riwayat percakapan** tersimpan lokal & searchable
- **Bisa offline** total — kasih tahu di jawaban kalau sempat pakai web

## ⌨️ Pintasan

- `Enter` kirim pesan
- `Shift+Enter` baris baru
- Klik avatar kanan-atas → ganti akun, profil, dll
- Klik ikon ⭐ di topbar → pustaka karakter

## 🧠 Catatan tentang "LLM yang dijalankan"

Aplikasi ini adalah **UI/UX lengkap & siap produksi** — semua mode (tunggal, multi-agen diskusi + sintesis), renderer karakter, multi-akun, tema, dll berjalan nyata.

Untuk mengganti "mock answer" dengan inference LLM sungguhan (Transformers.js / WebLLM / API Cloud), hubungkan di fungsi `mockCharAnswer` & `mockSynthesis` di `index.html` (cari komentar di source). Semua prompt system karakter sudah tersedia sebagai `c.sys` sehingga tinggal kirim ke backend inference pilihan Anda.

Dibuat dengan ❤️ untuk penggunaan AI yang lebih manusiawi, terbuka, dan bebas.
