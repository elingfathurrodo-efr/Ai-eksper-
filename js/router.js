// ============================================================
// AI HYPER — routing orchestrator (rule-based v1)
// Deliberately simple and inspectable: a scoring function, not a
// black box. Swap in something smarter later without touching
// chat.js — resolveRoute() is the only contract it depends on.
// ============================================================

import { isModelLoaded } from "./models.js";

const REALTIME_HINTS = [
  "hari ini", "terbaru", "sekarang", "berita", "harga", "cuaca",
  "skor", "jadwal", "update", "kurs", "live", "viral",
];
const WEB_HINTS = ["cari", "carikan", "search", "browsing", "sumber", "link", "website", "referensi terbaru"];

function textScore(text, hints) {
  const t = text.toLowerCase();
  return hints.reduce((s, h) => s + (t.includes(h) ? 1 : 0), 0);
}

/**
 * @param {string} message
 * @param {{forced:string, online:boolean, hasAttachment:boolean}} ctx
 * @returns {{route:"local"|"cloud"|"hybrid", reasons:string[]}}
 */
export function resolveRoute(message, ctx) {
  const reasons = [];

  if (ctx.forced === "private" || ctx.forced === "local") {
    reasons.push("Mode dipaksa ke lokal oleh pengaturan.");
    return { route: "local", reasons };
  }
  if (ctx.forced === "cloud") {
    if (!ctx.online) {
      reasons.push("Cloud diminta tapi sedang offline — fallback ke lokal.");
      return { route: "local", reasons };
    }
    reasons.push("Mode dipaksa ke cloud oleh pengaturan.");
    return { route: "cloud", reasons };
  }

  if (!ctx.online) {
    reasons.push("Perangkat sedang offline.");
    return { route: "local", reasons };
  }

  const realtime = textScore(message, REALTIME_HINTS);
  const web = textScore(message, WEB_HINTS);
  const heavy = message.length > 600 || ctx.hasAttachment;

  if (realtime > 0 || web > 0) {
    reasons.push("Pertanyaan tampak butuh info terkini / pencarian web.");
    if (isModelLoaded() && !heavy) {
      reasons.push("Sebagian bisa diproses lokal, pencarian lewat cloud gateway.");
      return { route: "hybrid", reasons };
    }
    return { route: "cloud", reasons };
  }

  if (!isModelLoaded()) {
    reasons.push("Model lokal belum dimuat — pakai cloud gateway.");
    return { route: "cloud", reasons };
  }

  reasons.push("Pertanyaan ringan/sedang, model lokal sudah cukup.");
  return { route: "local", reasons };
}
