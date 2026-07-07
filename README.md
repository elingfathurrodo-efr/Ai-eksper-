# AI Hyper — Final Preview Build

Build ini disiapkan sebagai versi yang lebih dekat ke target akhir: **rapi, komplit, bisa dipakai dulu oleh teman-teman**, dan tidak mengurangi fitur penting saat dibuka di mobile.

## Yang sudah dibenahi di build ini

- **Navigasi mobile tetap komplit**
  - Ada **bottom dock** untuk Chat, Riwayat, Prompt, Model, Setelan, Profil
  - Sidebar riwayat di mobile **bisa dibuka & ditutup**
  - Tap di area gelap luar drawer juga menutup panel
- **Tema diperbanyak** menjadi 8 tema
- **Profil & pengaturan tetap bisa diakses di non-desktop**
- **Pustaka Prompt/Agen** tetap jadi pusat multi-agen
- **Ekspor / impor riwayat** lokal JSON
- **Mode tampilan**: ukuran font, mode ringkas, bubble chat
- **PWA** tetap aktif, service worker diperbarui

## Arsitektur inti

- **Local-first**: model lokal via WebLLM / WebGPU
- **Cloud optional**: lewat Firebase Cloud Function (`functions/index.js`)
- **Prompt library = karakter**
  - 1 karakter aktif → jawaban tunggal
  - 2+ karakter aktif → diskusi multi-agen + sintesis
- **Quota**
  - non-VIP: 4 pesan / 5 jam
  - VIP / developer: unlimited

## Jalankan cepat

### Tanpa backend apa pun
```bash
python3 -m http.server 8080
```
Lalu buka `http://localhost:8080`

Ini sudah cukup untuk mencoba:
- UI final preview
- chat lokal (jika WebGPU tersedia)
- prompt karakter
- riwayat lokal
- tema
- export/import data

### Dengan Firebase + login Google + VIP + cloud gateway
Lihat file:
- `functions/index.js`
- `firestore.rules`
- `js/config.js`

Isi dulu konfigurasi berikut di `js/config.js`:
- `FIREBASE_CONFIG`
- `CLOUD_GATEWAY_URL`
- `DEVELOPER_EMAILS`

## Catatan jujur

- Build ini **sudah siap dipakai dulu** untuk testing/publish awal
- Tetapi supaya fitur login Google, VIP, dan cloud benar-benar hidup, kamu tetap perlu mengisi konfigurasi Firebase milikmu sendiri
- Konektor GitHub / Google Drive / Firebase di halaman setelan **sudah disiapkan titik masuk UI-nya**, tapi OAuth / SDK finalnya masih perlu kamu sambungkan sesuai akun project milikmu

## Struktur utama

- `index.html` → app shell utama
- `css/` → tema, layout, komponen
- `js/ui.js` → logika UI final preview
- `js/chat.js` → single-agent / multi-agent discussion
- `js/models.js` → local model runtime
- `functions/index.js` → cloud gateway + quota + VIP
- `data/model-registry.json` → daftar model lokal

## Saran publish awal

Kalau targetmu adalah **cepat dipakai teman-teman dulu**, jalur paling masuk akal:
1. deploy static app dulu
2. aktifkan model lokal
3. isi Firebase untuk login + VIP
4. baru aktifkan cloud gateway

Dengan begitu, versi ini sudah terasa nyata dulu sebelum masuk tahap integrasi lanjutan seperti storage sync penuh, connector OAuth lengkap, dan fitur multimodal berat.
