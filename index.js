/**
 * AI HYPER — Cloud Functions backend
 * ------------------------------------------------------------------
 * Tugas file ini:
 *   1. Menyimpan API key LLM dengan AMAN di server (tidak pernah ke browser).
 *   2. Memverifikasi login Firebase (idToken) jika ada.
 *   3. Mengecek status VIP / batas pemakaian (4 pesan / 5 jam untuk non-VIP).
 *   4. Meneruskan pesan ke provider LLM pilihanmu, lalu mengembalikan jawaban.
 *
 * Cara pakai: lihat FIREBASE_SETUP.md di root folder ini.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// ------------------------------------------------------------------
// KONFIGURASI — isi lewat: firebase functions:config:set
//   llm.provider="openai" (atau provider lain yang kamu pakai)
//   llm.key="sk-xxxxxxxx"
//   llm.model="gpt-4o-mini"        (contoh, ganti sesuai provider)
//   app.dev_emails="kamu@gmail.com,kedua@gmail.com"
// ------------------------------------------------------------------
const CFG = functions.config();
const LLM_PROVIDER = (CFG.llm && CFG.llm.provider) || 'openai';
const LLM_KEY = (CFG.llm && CFG.llm.key) || '';
const LLM_MODEL = (CFG.llm && CFG.llm.model) || 'gpt-4o-mini';
const DEV_EMAILS = ((CFG.app && CFG.app.dev_emails) || '').split(',').map(s => s.trim()).filter(Boolean);

const FREE_LIMIT = 4;
const WINDOW_MS = 5 * 60 * 60 * 1000; // 5 jam

// ------------------------------------------------------------------
// Helper: cek & update kuota pemakaian di Firestore
// Dokumen: usage/{uid}  { count, windowStart }
// ------------------------------------------------------------------
async function checkAndConsumeQuota(uid, isVip) {
  if (isVip) return { allowed: true, remaining: Infinity };

  const ref = db.collection('usage').doc(uid);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let data = snap.exists ? snap.data() : { count: 0, windowStart: now };

    if (now - data.windowStart > WINDOW_MS) {
      data = { count: 0, windowStart: now };
    }

    if (data.count >= FREE_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    data.count += 1;
    tx.set(ref, data);
    return { allowed: true, remaining: FREE_LIMIT - data.count };
  });
}

// ------------------------------------------------------------------
// Helper: cek apakah user VIP
// VIP ditentukan oleh salah satu dari:
//   a. email ada di DEV_EMAILS (developer/owner — selalu tanpa batas)
//   b. dokumen vipUsers/{uid atau email} ada di Firestore (kamu tambah manual
//      setelah user membayar, atau lewat script yang membaca daftar dari GitHub)
// ------------------------------------------------------------------
async function checkVip(uid, email) {
  if (email && DEV_EMAILS.includes(email)) return true;
  if (!uid && !email) return false;

  const byUid = uid ? await db.collection('vipUsers').doc(uid).get() : null;
  if (byUid && byUid.exists) return true;

  if (email) {
    const byEmail = await db.collection('vipUsers').doc(email).get();
    if (byEmail.exists) return true;
  }
  return false;
}

// ------------------------------------------------------------------
// Helper: panggil provider LLM sesungguhnya.
// Ganti/isi sesuai provider yang kamu pilih — contoh di bawah pakai
// format ala OpenAI-compatible chat completion. Sesuaikan endpoint &
// body jika kamu pakai provider lain (Groq, OpenRouter, Anthropic, dst).
// ------------------------------------------------------------------
async function callLlmProvider(message, systemPrompt) {
  if (!LLM_KEY) {
    throw new Error('LLM belum dikonfigurasi di server. Jalankan: firebase functions:config:set llm.key="..." llm.provider="..." lalu deploy ulang.');
  }

  const endpoints = {
    openai: 'https://api.openai.com/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  };
  const url = endpoints[LLM_PROVIDER] || endpoints.openai;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'Kamu adalah asisten AI yang jelas dan jujur.' },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Provider LLM merespons ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '[Provider tidak mengembalikan jawaban]';
}

// ------------------------------------------------------------------
// ENDPOINT UTAMA: chatProxy
// ------------------------------------------------------------------
exports.chatProxy = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan metode POST' });

  try {
    const { message, systemPrompt, uid, idToken } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Field "message" wajib diisi' });

    if (message === 'ping') return res.json({ reply: 'pong' });

    let email = null;
    let verifiedUid = uid || 'anonymous';

    if (idToken) {
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        verifiedUid = decoded.uid;
        email = decoded.email;
      } catch (e) {
        // token tidak valid — tetap lanjut sebagai anonymous, kena limit free
        verifiedUid = 'anon_' + (req.ip || 'unknown');
      }
    } else {
      verifiedUid = 'anon_' + (req.ip || 'unknown');
    }

    const vip = await checkVip(verifiedUid, email);
    const quota = await checkAndConsumeQuota(verifiedUid, vip);

    if (!quota.allowed) {
      return res.status(429).json({
        error: 'Batas 4 pesan / 5 jam tercapai. Masuk dengan akun VIP untuk pemakaian tanpa batas.',
      });
    }

    const reply = await callLlmProvider(message, systemPrompt);
    return res.json({ reply, remaining: quota.remaining, vip });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan di server' });
  }
});

// ------------------------------------------------------------------
// ENDPOINT BANTU: tambah VIP secara manual (panggil sekali dari Postman/curl
// dengan header rahasia, JANGAN taruh tombol ini di frontend publik)
// ------------------------------------------------------------------
exports.addVip = functions.https.onRequest(async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (CFG.app && CFG.app.admin_secret)) {
    return res.status(403).json({ error: 'Tidak diizinkan' });
  }
  const { emailOrUid } = req.body || {};
  if (!emailOrUid) return res.status(400).json({ error: 'emailOrUid wajib diisi' });
  await db.collection('vipUsers').doc(emailOrUid).set({ addedAt: Date.now() });
  return res.json({ ok: true });
});
