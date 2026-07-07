// ============================================================
// AI HYPER — quota engine
// Non-VIP: 4 messages / rolling 5-hour window, tracked client-side.
// VIP / developer: unlimited, this module always returns "allowed".
// NOTE ON HONESTY: a client-side-only counter can be reset by clearing
// browser storage. That's fine for a soft, friendly limit; if you need
// a limit nobody can bypass, mirror this check in the Cloud Function
// (functions/index.js already includes a Firestore-based version of
// the same rule for that reason).
// ============================================================

import { FREE_QUOTA } from "./config.js";
import { localPrefs } from "./storage.js";

const KEY = "quota_log";

function windowMs() {
  return FREE_QUOTA.windowHours * 60 * 60 * 1000;
}

function prune(log) {
  const cutoff = Date.now() - windowMs();
  return log.filter((t) => t > cutoff);
}

export function getStatus(unlimited) {
  if (unlimited) {
    return { unlimited: true, used: 0, max: Infinity, resetInMs: 0 };
  }
  const log = prune(localPrefs.get(KEY, []));
  const used = log.length;
  const max = FREE_QUOTA.maxMessages;
  let resetInMs = 0;
  if (used > 0) {
    resetInMs = Math.max(0, log[0] + windowMs() - Date.now());
  }
  return { unlimited: false, used, max, remaining: Math.max(0, max - used), resetInMs };
}

export function canSend(unlimited) {
  if (unlimited) return true;
  const status = getStatus(false);
  return status.remaining > 0;
}

export function recordSend(unlimited) {
  if (unlimited) return;
  const log = prune(localPrefs.get(KEY, []));
  log.push(Date.now());
  localPrefs.set(KEY, log);
}

export function formatReset(ms) {
  if (ms <= 0) return "sekarang";
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  if (h > 0) return `${h} jam ${m} menit lagi`;
  return `${m} menit lagi`;
}
