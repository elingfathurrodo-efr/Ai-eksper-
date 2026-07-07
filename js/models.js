// ============================================================
// AI HYPER — local model runtime
// Uses MLC WebLLM (https://github.com/mlc-ai/web-llm) to run a
// quantized LLM fully in-browser via WebGPU. Downloaded weights are
// cached by the browser's Cache Storage — "download once", reused by
// any account that logs into this app on this device.
// ============================================================

import { MODEL_REGISTRY_URL } from "./config.js";
import { localPrefs } from "./storage.js";

let webllm = null;
let engine = null;
let currentModelId = localPrefs.get("activeModelId", null);

export async function supportsWebGPU() {
  return !!navigator.gpu;
}

export async function fetchRegistry() {
  const res = await fetch(MODEL_REGISTRY_URL);
  if (!res.ok) throw new Error("Tidak bisa memuat model-registry.json");
  return res.json();
}

async function ensureLib() {
  if (webllm) return webllm;
  // Loaded from CDN so the core app bundle stays small; cached by the
  // browser like any other static asset after first load.
  webllm = await import("https://esm.run/@mlc-ai/web-llm");
  return webllm;
}

export function getActiveModelId() {
  return currentModelId;
}

export function isModelLoaded() {
  return !!engine;
}

/**
 * Downloads (if needed) and initializes a model. Safe to call again for
 * the same modelId — WebLLM/browser cache makes repeat loads fast.
 */
export async function loadModel(modelId, onProgress) {
  const lib = await ensureLib();
  const initProgressCallback = (report) => {
    onProgress?.({
      text: report.text || "",
      progress: report.progress ?? 0,
    });
  };
  engine = await lib.CreateMLCEngine(modelId, { initProgressCallback });
  currentModelId = modelId;
  localPrefs.set("activeModelId", modelId);
  return engine;
}

export async function unloadModel() {
  if (engine?.unload) { try { await engine.unload(); } catch {} }
  engine = null;
  currentModelId = null;
  localPrefs.set("activeModelId", null);
}

/**
 * Streams a completion from the local model.
 * messages: [{role:"system"|"user"|"assistant", content:string}]
 */
export async function* localChatStream(messages, opts = {}) {
  if (!engine) throw new Error("Model lokal belum dimuat.");
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** Non-streaming convenience wrapper (used for internal agent turns). */
export async function localChatOnce(messages, opts = {}) {
  let out = "";
  for await (const piece of localChatStream(messages, opts)) out += piece;
  return out;
}
