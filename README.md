# AI Hyper

Chat hybrid: satu kolom input, sistem yang memilih **lokal**, **cloud**, atau **hybrid**
di belakang layar. Prompt library jadi "karakter" — aktifkan 2 atau lebih dan mode
diskusi multi-agen otomatis menyala.

Ini bukan mockup. Semua logika di `js/` benar-benar jalan: model lokal via WebGPU,
routing rule-based, quota, tema, riwayat tersimpan di IndexedDB. Yang **tidak** bisa
jalan tanpa kamu isi sendiri adalah tiga hal yang memang butuh akun/kredensial milikmu
— dijelaskan di bawah, sejelas mungkin, tidak ditutup-tutupi.

## Jujur di awal: 3 batas teknis nyata

1. **"Model paling besar & paling pintar" vs "download sekali, jalan di browser
   siapa saja"** — dua hal ini tidak bisa dipenuhi bersamaan. Model kelas GPT-4/Claude
   berukuran ratusan GB dan butuh GPU datacenter. Yang realistis untuk jalan di
   perangkat lewat WebGPU (lihat `data/model-registry.json`) adalah kelas 3B–8B
   parameter — pintar untuk ukuran lokal, bukan kelas cloud terbesar.
2. **"Tanpa API key" vs "mode online yang lebih pintar dari model lokal"** — kalau mau
   ada cloud yang benar-benar lebih pintar, tetap ada API key di suatu tempat. Bedanya:
   di app ini kuncinya **tidak pernah** ada di browser/kode yang kamu bagikan — hanya
   hidup di `functions/index.js`, di server Firebase milikmu (lihat Bagian 4).
3. **VIP berbasis "pembayaran tercatat di GitHub"** — app ini menyediakan mekanismenya
   (daftar VIP di Firestore, kamu tambah manual), tapi tidak memverifikasi pembayaran
   otomatis. Itu perlu payment gateway (Stripe/Midtrans/dll) yang harus kamu pasang
   terpisah; repo ini kasih tempat "tempel hasilnya".

## Yang benar-benar jalan begitu kamu buka `index.html`

- UI lengkap: rail ikon, sidebar riwayat, 4 tema (ganti lewat ikon 🎨 atau Pengaturan)
- Pustaka Prompt: tambah karakter sebanyak yang kamu mau. 1 aktif = jawaban tunggal,
  2+ aktif = diskusi multi-agen (tampil sebagai blok "💬 Diskusi" di atas jawaban)
- Model lokal: unduh sekali (tersimpan di Cache Storage browser), pakai berulang,
  jalan offline — **butuh Chrome/Edge terbaru dengan WebGPU aktif**
- Kuota gratis 4 pesan/5 jam untuk yang belum VIP, ditandai di banner
- Semua riwayat & pengaturan tersimpan lokal di perangkat (IndexedDB/localStorage)

Tanpa konfigurasi Firebase, app tetap bisa dipakai penuh dalam **mode lokal murni**
(Pengaturan → Rute jawaban → Lokal/Privat). Login Google, cloud gateway, dan status VIP
baru aktif setelah kamu isi Bagian 4–5.

## 1. Coba langsung (tanpa server apa pun)

```bash
cd ai-hyper
python3 -m http.server 8080
# buka http://localhost:8080
```

Model lokal bisa diunduh dan dipakai dari sini. Login Google & cloud belum aktif
sampai Firebase dikonfigurasi.

## 2. Ganti nama "Ambara" → nama aplikasimu

Nama aplikasi ada satu tempat: `js/config.js` → `APP_NAME`, ditambah `index.html`
(`<title>`) dan `manifest.json`. Tidak ada string nama contoh lain yang perlu diburu —
semua label UI di `index.html`/`ui.js` netral ("AI Hyper" sudah dipakai konsisten).

## 3. Ganti/tambah model lokal

Edit `data/model-registry.json`. ID model harus cocok dengan ID resmi di
[MLC WebLLM model list](https://github.com/mlc-ai/web-llm) — app tidak meng-hardcode
model tertentu di `js/models.js`, jadi menambah model = edit JSON ini saja, tanpa sentuh
kode.

## 4. Setup Firebase (Auth Google + Firestore untuk VIP)

1. Buat project di https://console.firebase.google.com
2. Aktifkan **Authentication → Google** sebagai sign-in provider
3. Aktifkan **Firestore Database**
4. Salin config web app (Project settings → General → Your apps → Web) ke
   `js/config.js` → `FIREBASE_CONFIG`
5. Deploy security rules: `firebase deploy --only firestore:rules`
6. Tambahkan email Google-mu sendiri ke `DEVELOPER_EMAILS` di `js/config.js`
   **dan** `DEVELOPER_EMAILS` di `functions/index.js` (dua tempat, sengaja dipisah
   supaya server tidak percaya begitu saja pada nilai dari client)

## 5. Setup cloud gateway (mode online, tanpa user perlu API key)

```bash
cd functions
npm install
firebase functions:secrets:set LLM_API_KEY   # tempel API key provider pilihanmu
firebase deploy --only functions
```

Salin URL function yang muncul ke `js/config.js` → `CLOUD_GATEWAY_URL`.
`functions/index.js` sudah berisi contoh pemanggilan Anthropic Messages API — ganti
blok `fetch(...)` di sana kalau kamu pakai provider lain (OpenAI, Groq, dll), polanya
sama: kirim `messages`, terima teks balasan.

## 6. Menambahkan VIP (setelah user bayar lewat jalur manapun)

Tambahkan dokumen di Firestore, koleksi `vip_users`, **doc id = email lowercase**:

```
vip_users/budi@gmail.com  →  { active: true }
```

Bisa lewat Firebase Console langsung (tanpa kode), atau lewat GitHub Actions/script
kalau kamu ingin mencatat pembayaran di repo dulu lalu sinkron ke Firestore — itu bagian
yang perlu kamu bangun sesuai alur pembayaran yang kamu pakai (repo ini menyediakan
titik integrasinya, bukan payment processor-nya).

## 7. Deploy

Paling sederhana — Firebase Hosting (satu perintah, sudah cocok dengan `firebase.json`):

```bash
firebase deploy --only hosting,functions
```

Alternatif: GitHub Pages (statis saja, cloud gateway tetap lewat Firebase Functions
terpisah) — cukup push folder ini ke branch `gh-pages` atau aktifkan Pages di
repo settings.

## 8. Sambungkan GitHub / Google Drive sebagai penyimpanan pribadi

Tombol "Sambungkan GitHub" / "Sambungkan Google Drive" di Pengaturan sudah ada di UI
sebagai titik masuk (`data-link="github"` / `"drive"` di `index.html`), tapi OAuth
flow-nya belum disambungkan — ini butuh kamu daftarkan OAuth App di GitHub Developer
Settings dan Google Cloud Console (client ID masing-masing), lalu isi handler-nya di
`js/ui.js` (`storage-links` click listener belum ditulis, sengaja: kredensial itu milik
akunmu, bukan sesuatu yang bisa saya isi otomatis).

## Struktur folder

```
ai-hyper/
  index.html
  manifest.json          PWA
  sw.js                  offline app-shell cache
  css/                   tokens · layout · components · themes
  js/
    config.js            SEMUA hal yang perlu diisi ada di sini
    storage.js            IndexedDB/localStorage
    agents.js             prompt library -> single/multi-agent
    models.js              local LLM runtime (WebLLM/WebGPU)
    router.js              local/cloud/hybrid decision
    chat.js                orchestrator: single-answer & multi-agent discussion
    auth.js                Firebase Google sign-in + VIP lookup
    quota.js               4 pesan/5 jam client-side
    ui.js                   semua DOM
  data/model-registry.json  daftar model lokal — edit ini untuk tambah model
  functions/index.js       cloud gateway — SATU-SATUNYA tempat API key hidup
  firestore.rules
  firebase.json
```

## Roadmap yang jujur (belum ada, urutan realistis)

1. OAuth GitHub/Drive untuk storage pribadi (poin 8 di atas)
2. Streaming asli dari cloud gateway (saat ini non-streaming, satu balasan utuh)
3. Web search sungguhan di jalur cloud/hybrid (saat ini heuristik kata kunci saja
   yang menentukan rute — belum benar-benar memanggil search API)
4. Payment gateway otomatis untuk status VIP (saat ini manual via Firestore)
5. Multimodal (gambar/video) — arsitektur registry sudah menyiapkan tempatnya
   (`capabilities` di model-registry, `agents`/`router` bisa diperluas), belum diisi
