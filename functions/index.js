// ============================================================
// AI HYPER — cloud gateway (Firebase Cloud Function)
// This is the ONLY place a real LLM API key lives. The app itself
// never asks the user for one — it calls this function, this function
// calls the provider, using a key stored in Firebase's server-side
// config/secrets (never shipped to the browser).
//
// Deploy:
//   firebase functions:secrets:set LLM_API_KEY
//   firebase deploy --only functions
// Then copy the printed URL into js/config.js -> CLOUD_GATEWAY_URL.
// ============================================================

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const LLM_API_KEY = defineSecret("LLM_API_KEY");

const FREE_QUOTA = { maxMessages: 4, windowHours: 5 };
const DEVELOPER_EMAILS = ["you@example.com"]; // keep in sync with js/config.js

async function resolveAccess(idToken) {
  if (!idToken) return { uid: null, email: null, unlimited: false };
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    if (DEVELOPER_EMAILS.includes(email)) return { uid: decoded.uid, email, unlimited: true };
    const vipDoc = await db.collection("vip_users").doc(email).get();
    const vip = vipDoc.exists && vipDoc.data()?.active !== false;
    return { uid: decoded.uid, email, unlimited: vip };
  } catch {
    return { uid: null, email: null, unlimited: false };
  }
}

/** Server-side quota mirror keyed by uid (falls back to a shared
 * "anonymous" bucket if not signed in — tighten this in production by
 * requiring sign-in for cloud requests). */
async function checkAndRecordQuota(key, unlimited) {
  if (unlimited) return { allowed: true };
  const ref = db.collection("quota").doc(key);
  const now = Date.now();
  const windowMs = FREE_QUOTA.windowHours * 60 * 60 * 1000;

  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    let log = snap.exists ? snap.data().log || [] : [];
    log = log.filter((ts) => ts > now - windowMs);
    if (log.length >= FREE_QUOTA.maxMessages) {
      return { allowed: false, resetInMs: log[0] + windowMs - now };
    }
    log.push(now);
    t.set(ref, { log }, { merge: true });
    return { allowed: true };
  });
}

exports.chatGateway = onRequest({ secrets: [LLM_API_KEY], cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messages, idToken } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] wajib diisi" });
  }

  const access = await resolveAccess(idToken);
  const quotaKey = access.uid || req.ip || "anon";
  const quota = await checkAndRecordQuota(quotaKey, access.unlimited);
  if (!quota.allowed) {
    return res.status(429).json({
      error: `Batas pesan gratis tercapai. Coba lagi dalam ${Math.ceil(quota.resetInMs / 60000)} menit, atau minta akses VIP.`,
    });
  }

  try {
    // Example using Anthropic's Messages API — swap for whatever
    // provider you actually have a key for. This is the ONLY function
    // in the whole app that talks to a paid provider.
    const apiKey = LLM_API_KEY.value();
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        system: messages.find((m) => m.role === "system")?.content,
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error("Upstream error:", errBody);
      return res.status(502).json({ error: "Gagal menghubungi model cloud." });
    }

    const data = await upstream.json();
    const reply = data.content?.map((b) => b.text || "").join("") || "";
    return res.json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Kesalahan internal gateway." });
  }
});
