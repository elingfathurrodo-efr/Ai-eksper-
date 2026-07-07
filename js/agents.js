// ============================================================
// AI HYPER — prompt library = agent characters
// Core rule the user asked for explicitly:
//   0 or 1 active character  -> single-answer mode
//   2+ active characters     -> multi-agent discussion mode,
//                                using those exact characters
// No hardcoded roles, no fixed cap on how many characters exist.
// ============================================================

import { saveAgent, loadAllAgents, deleteAgent as dbDeleteAgent } from "./storage.js";

const DEFAULT_COLORS = ["#3FB6A8", "#9B8CF2", "#E8A33D", "#E2725B", "#4FBE84", "#5FB8D9"];

const SEED_AGENTS = [
  {
    id: "agent-generalist",
    name: "Umum",
    prompt: "Kamu asisten umum yang ringkas, jujur, dan langsung ke inti jawaban.",
    color: DEFAULT_COLORS[0],
    active: true,
  },
];

export function colorPalette() { return DEFAULT_COLORS; }

export async function ensureSeeded() {
  const existing = await loadAllAgents();
  if (existing.length === 0) {
    for (const a of SEED_AGENTS) await saveAgent(a);
    return SEED_AGENTS;
  }
  return existing;
}

export async function listAgents() {
  return loadAllAgents();
}

export async function upsertAgent(agent) {
  if (!agent.id) agent.id = "agent-" + Date.now().toString(36);
  await saveAgent(agent);
  return agent;
}

export async function removeAgent(id) {
  await dbDeleteAgent(id);
}

export async function toggleAgent(id, agentsCache) {
  const a = agentsCache.find((x) => x.id === id);
  if (!a) return agentsCache;
  a.active = !a.active;
  await saveAgent(a);
  return agentsCache;
}

/** The single rule that decides single vs multi-agent mode. */
export function resolveMode(agents) {
  const active = agents.filter((a) => a.active);
  if (active.length <= 1) {
    return { mode: "single", characters: active.length ? active : [SEED_AGENTS[0]] };
  }
  return { mode: "multi", characters: active };
}
