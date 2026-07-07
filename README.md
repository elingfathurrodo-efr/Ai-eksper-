# AI Hyper — v1 nyata

Ini implementasi kerja pertama dari blueprint yang kamu susun (registry model/app/mode, Routing Orchestrator, local-first + cloud-optional, multi-agen lewat prompt). Semua di sini **berjalan sungguhan**, bukan tampilan kosong — dengan catatan jujur di bagian bawah soal apa yang perlu kamu setel sendiri.

## Isi paket

| File | Fungsi |
|---|---|
| `index.html` | App utuh — sidebar/spaces/riwayat, pustaka prompt (multi-agen), manajer model lokal, pengaturan tema, profil, composer, routing orchestrator client-side |
| `functions/index.js` | Backend Cloud Function: proxy ke LLM cloud (kunci API aman di server) + penghitung kuota VIP/gratis |
| `functions/package.json` | Dependensi backend |
| `firestore.rules` | Kunci akses data kuota/VIP agar tidak bisa dicurangi dari browser |
| `FIREBASE_SETUP.md` | Panduan langkah-demi-langkah bikin project Firebase dari nol |
| `manifest.json`, `sw.js`, `icon.svg` | PWA shell — bisa "diinstal" dan tetap buka saat offline |

Cara pakai cepat: upload semua file (jaga struktur folder `functions/` tetap ada) ke GitHub, deploy `index.html` dkk ke Vercel/GitHub Pages seperti biasa, lalu ikuti `FIREBASE_SETUP.md` untuk mengaktifkan Cloud/Login/VIP.

## Bagaimana arsitekturnya memetakan ke diagram yang kamu kirim

- **Input Layer → Intent & Input Analyzer** → fungsi `analyzeInput()`
- **Policy Engine** → pengaturan "Prioritaskan Lokal untuk topik sensitif", mode Auto/Lokal/Cloud/Privat
- **Complexity Estimator** & **Capability Detector** → digabung dalam `analyzeInput()` (deteksi kebutuhan web, kode, panjang teks)
- **Scoring & Routing Orchestrator** → fungsi `decideRoute()`
- **Runtime Lokal (8A)** → `runLocalInference()` via transformers.js + WebGPU, model diunduh sekali & di-cache browser
- **Runtime Cloud (8B)** → `runCloudInference()` → Cloud Function `chatProxy` → provider LLM pilihanmu
- **Hybrid Pipeline (8C)** → route `hybrid` memakai runtime lokal untuk sebagian, atau menandai jawaban sebagai gabungan
- **Adaptive Fallback** → `fallbackNotice()` — kalau lokal belum siap atau cloud belum dikonfigurasi, pengguna diberi tahu jelas di teks jawaban (persis seperti yang kamu minta: pemberitahuan setiap butuh internet)
- **Audit/Memory** → riwayat & meta rute tersimpan per pesan (`route`, `reason`) dan bisa diekspor

## Mode diskusi multi-agen

Buka rail ikon → **Pustaka Prompt**. Tambah karakter sebanyak yang kamu mau, aktifkan/nonaktifkan lewat sakelar:
- **1 karakter aktif** → jawaban langsung.
- **2+ karakter aktif** → tiap karakter aktif memberi pendapat (tersimpan di panel "Diskusi" yang bisa dibuka), lalu sistem membuat satu jawaban akhir hasil sintesis — mirip pola diskusi yang kamu maksud.

## Yang jujur perlu kamu tahu sebelum pakai

1. **"Tanpa API key" untuk Cloud secara harfiah tidak mungkin.** Yang saya buat: API key disimpan di server (Cloud Function), bukan di browser pengguna — jadi pengguna app-mu memang tidak perlu API key apa pun. Tapi kamu sebagai developer tetap perlu satu API key dari provider LLM pilihan (lihat `FIREBASE_SETUP.md` langkah 6).
2. **Model lokal "paling pintar sedunia" tidak realistis jalan di browser.** Yang tersedia di registry sekarang: Qwen2.5 1.5B & 3B (quantized, jalan via WebGPU). Ini kelas model yang memang bisa diunduh & dipakai gratis selamanya di perangkat, tapi levelnya di bawah model cloud raksasa. Kamu bisa menambah entri model lain ke `LOCAL_MODEL_REGISTRY` di `index.html` kapan saja tanpa mengubah struktur app — sesuai prinsip registry-driven yang kamu inginkan.
3. **VIP/pembayaran belum otomatis.** Backend sudah bisa membedakan gratis (4 pesan/5 jam) vs VIP (tanpa batas) dan email developer (kamu, otomatis tanpa batas). Tapi menandai seseorang jadi VIP setelah bayar masih manual lewat satu perintah (`addVip`) — payment gateway otomatis (Midtrans/Stripe dll) adalah langkah lanjutan, belum ada di v1 ini.
4. **Fitur video/gambar/game/trading belum ada di v1 ini** — sesuai roadmap yang kamu tulis sendiri (V1 = core chat+coding+lokal+cloud+hybrid, V1.5/V2 = Video Inbox, Image Studio, Trading Desk, dst). Struktur app-registry & plugin sudah disiapkan konsepnya (lewat `LOCAL_MODEL_REGISTRY` dan pola karakter/prompt) supaya app baru tinggal ditambah tanpa bongkar `index.html` inti — tapi app-app itu sendiri belum dibuatkan di paket ini.
5. **Uji coba local-model download** paling akurat dilakukan setelah kamu deploy ke domain sungguhan (Vercel/GitHub Pages), karena sandbox pratinjau chat ini punya pembatasan jaringan yang berbeda dari browser normal pengguna.

## Langkah lanjut yang masuk akal (sesuai roadmap 90 harimu sendiri)

1. Deploy dulu versi ini, pastikan chat lokal & cloud jalan.
2. Tambah app kedua (mis. "Coder" dengan akses file/terminal) sebagai modul baru mengikuti pola yang sama.
3. Baru pikirkan payment gateway otomatis untuk VIP, lalu Video Inbox / Image Studio.
