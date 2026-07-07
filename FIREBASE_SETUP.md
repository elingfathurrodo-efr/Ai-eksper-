# Panduan Setup Firebase — AI Hyper

Kamu belum punya project Firebase, jadi ikuti urutan ini dari nol. Perkiraan waktu: 30–45 menit untuk yang baru pertama kali.

## 1. Buat project Firebase

1. Buka https://console.firebase.google.com → **Add project**.
2. Beri nama (misal `ai-hyper`), lanjutkan, Google Analytics boleh dimatikan.
3. Setelah project jadi, klik ikon **Web (`</>`)** untuk mendaftarkan web app.
4. Salin objek `firebaseConfig` yang muncul — bentuknya seperti:
   ```json
   {
     "apiKey": "AIza...",
     "authDomain": "ai-hyper.firebaseapp.com",
     "projectId": "ai-hyper",
     "storageBucket": "ai-hyper.appspot.com",
     "messagingSenderId": "...",
     "appId": "1:...:web:..."
   }
   ```
5. Tempel JSON ini di app AI Hyper → **Pengaturan → Firebase → Simpan konfigurasi**.

## 2. Aktifkan Google Sign-In

1. Di Firebase Console → **Build → Authentication → Get started**.
2. Tab **Sign-in method** → aktifkan **Google**.
3. Isi email support, simpan.
4. Tambahkan domain tempat kamu men-deploy app (misal `ai-hyper.vercel.app`) ke **Authorized domains**.

## 3. Aktifkan Firestore

1. **Build → Firestore Database → Create database**.
2. Pilih **Production mode**, region terdekat (misal `asia-southeast2`).
3. Setelah dibuat, buka tab **Rules**, ganti isinya dengan file `firestore.rules` yang sudah disiapkan, lalu **Publish**.

## 4. Install Firebase CLI & login

```bash
npm install -g firebase-tools
firebase login
```

## 5. Hubungkan folder project ke Firebase

Dari root folder `ai-hyper/`:
```bash
firebase init
```
- Pilih **Functions** dan **Firestore** (spasi untuk pilih, Enter untuk lanjut).
- Pilih project yang sudah kamu buat di langkah 1.
- Saat ditanya bahasa Functions: pilih **JavaScript**.
- Saat ditanya "overwrite functions/index.js?" → **No** (biarkan yang sudah dibuatkan ini).
- Saat ditanya "overwrite firestore.rules?" → **No**.

## 6. Pasang API key LLM di server (BUKAN di browser)

Pilih salah satu provider LLM cloud yang kamu punya API key-nya (OpenAI, Groq, OpenRouter, dll — bukan Anthropic karena Claude Code/Claude.ai tidak menyediakan kunci gratis untuk dipakai ulang di app pihak ketiga). Lalu jalankan:

```bash
firebase functions:config:set \
  llm.provider="groq" \
  llm.key="ISI_API_KEY_KAMU" \
  llm.model="llama-3.3-70b-versatile" \
  app.dev_emails="emailkamu@gmail.com" \
  app.admin_secret="buat-string-acak-rahasia-sendiri"
```

Ganti `llm.provider`, `llm.model` sesuai provider pilihanmu. `app.dev_emails` adalah daftar email (pisahkan koma) yang otomatis **tanpa batas pemakaian** — masukkan emailmu sendiri di sini.

> Kenapa harus begini? Karena "tanpa API key" secara harfiah tidak mungkin untuk model cloud — kuncinya harus ada di suatu tempat. Menaruhnya di Cloud Function (server) jauh lebih aman daripada di kode browser, karena tidak akan pernah terlihat atau dicuri oleh pengguna aplikasi.

## 7. Deploy

```bash
firebase deploy --only functions,firestore:rules
```

Setelah selesai, terminal akan menampilkan URL seperti:
```
https://REGION-PROJECTID.cloudfunctions.net/chatProxy
```

## 8. Sambungkan ke app

1. Buka AI Hyper → **Model → tab Cloud**.
2. Tempel URL `chatProxy` di atas → **Simpan** → **Tes koneksi**.
3. Kalau muncul "Terhubung!", jalur Cloud & Hybrid sudah aktif.

## 9. Menambahkan akun VIP setelah pengguna membayar

Karena ini butuh verifikasi manual (mis. transfer/pembayaran di luar sistem), tambahkan VIP dengan curl setelah kamu konfirmasi pembayaran:

```bash
curl -X POST https://REGION-PROJECTID.cloudfunctions.net/addVip \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: buat-string-acak-rahasia-sendiri" \
  -d '{"emailOrUid":"emailpengguna@gmail.com"}'
```

User itu otomatis tanpa batas pada request berikutnya.

## Ringkasan realita penting

- **Emailmu (dev_emails)** = tanpa batas otomatis, tidak perlu setup tambahan.
- **VIP lain** = ditambahkan manual olehmu lewat `addVip` setelah verifikasi bayar (belum ada payment gateway otomatis — itu pengembangan lanjutan).
- **Non-VIP** = 4 pesan / 5 jam, dihitung oleh server (Firestore), bukan oleh browser — jadi tidak bisa dicurangi dengan clear cache.
- **Model lokal** tetap jalan tanpa semua langkah di atas — Firebase hanya dibutuhkan untuk jalur Cloud, login, dan VIP.
