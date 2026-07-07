// ============================================================
// AI HYPER — chat engine
// One entry point: sendMessage(). Internally it:
//   1) resolves single vs multi-agent mode from the prompt library
//   2) resolves local/cloud/hybrid route
//   3) if multi-agent: runs a short discussion between characters,
//      then asks one of them (or a neutral synthesizer) to conclude
//   4) streams the final answer back through callbacks (no DOM code
//      in this file — ui.js owns rendering)
// ============================================================

import { resolveMode } from "./agents.js";
import { resolveRoute } from "./router.js";
import { localChatStream, localChatOnce, isModelLoaded } from "./models.js";
import { CLOUD_GATEWAY_URL } from "./config.js";
import { getUser } from "./auth.js";

const MAX_DISCUSSION_TURNS_PER_AGENT = 1; // one pass each, then synthesis — keeps latency sane

async function cloudChatOnce(messages) {
  const user = getUser();
  const idToken = user ? await user.getIdToken() : null;
  const res = await fetch(CLOUD_GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, idToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Cloud gateway error (${res.status})`);
  }
  const data = await res.json();
  return data.reply || "";
}

async function runOnce(messages, route) {
  if (route === "local") return localChatOnce(messages);
  if (route === "cloud") return cloudChatOnce(messages);
  // hybrid: local drafts, cloud is asked to only fill in real-time/web facts
  const draft = isModelLoaded() ? await localChatOnce(messages) : "";
  const cloudMsgs = [
    ...messages,
    draft
      ? { role: "assistant", content: draft }
      : null,
    {
      role: "user",
      content:
        "Lengkapi atau perbaiki jawaban di atas HANYA jika ada fakta terkini/hasil pencarian web yang relevan. Jika draf sudah cukup, kembalikan draf itu apa adanya.",
    },
  ].filter(Boolean);
  return cloudChatOnce(cloudMsgs);
}

async function* streamOnce(messages, route) {
  if (route === "local") {
    yield* localChatStream(messages);
    return;
  }
  // Cloud/hybrid gateway in this reference build is non-streaming
  // (simplest possible Cloud Function). Yield the whole reply at once.
  const text = await runOnce(messages, route);
  yield text;
}

/**
 * @param {string} userText
 * @param {object[]} history  prior {role, content} messages for context
 * @param {object[]} agents   full agent list from the prompt library
 * @param {object} routeCtx   {forced, online, hasAttachment}
 * @param {object} callbacks  {onRoute, onDiscussionTurn, onSynthesisStart, onToken, onDone, onError}
 */
export async function sendMessage(userText, history, agents, routeCtx, callbacks) {
  const { onRoute, onDiscussionTurn, onSynthesisStart, onToken, onDone, onError } = callbacks;

  try {
    const { mode, characters } = resolveMode(agents);
    const decision = resolveRoute(userText, routeCtx);
    onRoute?.(decision);

    if (mode === "single") {
      const persona = characters[0];
      const messages = [
        { role: "system", content: persona.prompt || "Kamu asisten yang membantu." },
        ...history,
        { role: "user", content: userText },
      ];
      let full = "";
      for await (const piece of streamOnce(messages, decision.route)) {
        full += piece;
        onToken?.(piece, full);
      }
      onDone?.(full, { mode, decision, characters });
      return;
    }

    // ---- multi-agent discussion ----
    const turns = [];
    for (const persona of characters) {
      const context = turns
        .map((t) => `${t.name}: ${t.text}`)
        .join("\n");
      const messages = [
        {
          role: "system",
          content:
            `${persona.prompt || "Kamu peserta diskusi."}\n\n` +
            `Kamu sedang berdiskusi singkat dengan agen lain untuk menjawab pertanyaan pengguna. ` +
            `Beri pendapat SINGKAT (2-4 kalimat) dari sudut pandang karaktermu. ` +
            (context ? `Ini yang sudah dibahas sebelumnya:\n${context}` : "Kamu bicara duluan."),
        },
        { role: "user", content: userText },
      ];
      const text = await runOnce(messages, decision.route === "local" && isModelLoaded() ? "local" : decision.route);
      const turn = { name: persona.name, color: persona.color, text: text.trim() };
      turns.push(turn);
      onDiscussionTurn?.(turn);
    }

    onSynthesisStart?.();
    const synthesisMessages = [
      {
        role: "system",
        content:
          "Kamu adalah penyintesis netral. Berdasarkan diskusi antar-agen berikut, tulis SATU jawaban final yang jelas, terstruktur, dan langsung menjawab pertanyaan pengguna. Jangan sebut ulang bahwa ini hasil diskusi.",
      },
      {
        role: "user",
        content:
          `Pertanyaan: ${userText}\n\nDiskusi:\n` +
          turns.map((t) => `${t.name}: ${t.text}`).join("\n"),
      },
    ];
    let full = "";
    for await (const piece of streamOnce(synthesisMessages, decision.route)) {
      full += piece;
      onToken?.(piece, full);
    }
    onDone?.(full, { mode, decision, characters, turns });
  } catch (err) {
    onError?.(err);
  }
}
