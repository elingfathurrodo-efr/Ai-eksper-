// ============================================================
// AI HYPER — UI layer
// Owns all DOM. Talks to chat.js / agents.js / models.js / auth.js /
// quota.js through their exported functions only.
// ============================================================

import { THEMES, DEFAULT_THEME } from "./config.js";
import { localPrefs, saveChat, loadAllChats, deleteChat } from "./storage.js";
import * as Agents from "./agents.js";
import * as Models from "./models.js";
import * as Auth from "./auth.js";
import * as Quota from "./quota.js";
import { sendMessage } from "./chat.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  view: "chat",
  theme: localPrefs.get("theme", DEFAULT_THEME),
  route: localPrefs.get("forcedRoute", "auto"),
  agents: [],
  chats: [],
  activeChat: null,
  user: null,
  vip: false,
  online: navigator.onLine,
};

// ---------------- THEME ----------------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  state.theme = theme;
  localPrefs.set("theme", theme);
  $$(".theme-swatch").forEach((el) =>
    el.classList.toggle("active", el.dataset.themeId === theme)
  );
}

function renderThemeSwatches() {
  const wrap = $("#themeSwatches");
  wrap.innerHTML = "";
  for (const t of THEMES) {
    const el = document.createElement("button");
    el.className = "theme-swatch" + (t === state.theme ? " active" : "");
    el.dataset.themeId = t;
    el.title = t;
    el.addEventListener("click", () => applyTheme(t));
    wrap.appendChild(el);
  }
}

function cycleTheme() {
  const i = THEMES.indexOf(state.theme);
  applyTheme(THEMES[(i + 1) % THEMES.length]);
}

// ---------------- VIEWS ----------------
function switchView(view) {
  state.view = view;
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(`#view-${view}`)?.classList.add("active");
  $$(".rail-btn[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  const titles = { chat: state.activeChat?.title || "Obrolan baru", agents: "Pustaka Prompt & Agen", models: "Model lokal", settings: "Pengaturan" };
  $("#chatTitle").textContent = titles[view] || "AI Hyper";
  closeSidebarNarrow();
}

// ---------------- SIDEBAR (narrow screens) ----------------
function openSidebarNarrow() { $("#sidebar").classList.add("open"); }
function closeSidebarNarrow() { $("#sidebar").classList.remove("open"); }

// ---------------- HISTORY ----------------
async function refreshHistory() {
  state.chats = await loadAllChats();
  const wrap = $("#historyList");
  wrap.innerHTML = "";
  if (state.chats.length === 0) {
    wrap.innerHTML = `<div class="history-item" style="opacity:.5;cursor:default">Belum ada riwayat</div>`;
    return;
  }
  for (const c of state.chats) {
    const el = document.createElement("button");
    el.className = "history-item" + (state.activeChat?.id === c.id ? " active" : "");
    el.textContent = c.title || "Obrolan";
    el.addEventListener("click", () => openChat(c));
    wrap.appendChild(el);
  }
}

const EMPTY_STATE_HTML = `
  <div class="empty-state" id="emptyState">
    <div class="empty-mark">AI<span>Hyper</span></div>
    <p>Satu kolom chat, banyak mesin di belakangnya. Tanya apa saja — sistem yang memilih lokal, cloud, atau gabungan keduanya.</p>
    <div class="suggest-row">
      <button class="suggest-chip" data-fill="Ringkas ide bisnis saya jadi 3 poin utama">Ringkas ide bisnis</button>
      <button class="suggest-chip" data-fill="Cari berita AI terbaru hari ini">Cari berita terbaru</button>
      <button class="suggest-chip" data-fill="Bantu saya debug kode ini">Bantu debug kode</button>
    </div>
  </div>`;

function newChat() {
  state.activeChat = { id: "chat-" + Date.now().toString(36), title: "Obrolan baru", messages: [] };
  $("#messages").innerHTML = EMPTY_STATE_HTML;
  wireSuggestChips();
  switchView("chat");
  refreshHistory();
}

async function openChat(chat) {
  state.activeChat = chat;
  const wrap = $("#messages");
  wrap.innerHTML = "";
  for (const m of chat.messages) {
    appendMessage(m.role, m.text, m.meta);
  }
  switchView("chat");
  refreshHistory();
}

function wireSuggestChips() {
  $$(".suggest-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $("#composerInput").value = chip.dataset.fill;
      $("#composerInput").dispatchEvent(new Event("input"));
      $("#composerForm").requestSubmit();
    });
  });
}

// ---------------- MESSAGE RENDERING ----------------
function scrollToBottom() {
  const m = $("#messages");
  m.scrollTop = m.scrollHeight;
}

function routeTagHTML(route) {
  const labels = { local: "Lokal", cloud: "Cloud · butuh internet", hybrid: "Hybrid · lokal + cloud" };
  return `<span class="route-tag ${route}"><span class="dot dot-${route}"></span>${labels[route] || route}</span>`;
}

function appendMessage(role, text, meta = {}) {
  $("#emptyState")?.remove();
  const wrap = $("#messages");
  const el = document.createElement("div");
  el.className = "msg " + role;
  const avatarLabel = role === "user" ? (state.user?.displayName?.[0] || "K") : "AI";
  el.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div class="msg-body">
      <div class="msg-name">${role === "user" ? "Kamu" : "AI Hyper"}</div>
      ${meta.discussionHTML || ""}
      ${meta.route ? routeTagHTML(meta.route) : ""}
      <div class="msg-text">${escapeHTML(text)}</div>
    </div>`;
  wrap.appendChild(el);
  scrollToBottom();
  return el;
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function discussionBlockHTML(turns) {
  const rows = turns
    .map(
      (t) => `
      <div class="turn">
        <div class="turn-avatar" style="background:${t.color}"></div>
        <div>
          <div class="turn-name" style="color:${t.color}">${escapeHTML(t.name)}</div>
          <div class="turn-text">${escapeHTML(t.text)}</div>
        </div>
      </div>`
    )
    .join("");
  return `<div class="discussion">
    <div class="discussion-head">💬 Diskusi ${turns.length} agen</div>
    <div class="discussion-turns">${rows}</div>
    <div class="discussion-summary">Kesimpulan diskusi jadi jawaban di bawah ini.</div>
  </div>`;
}

// ---------------- QUOTA / ROUTE UI ----------------
function unlimitedAccess() {
  return state.vip || Auth.isDeveloper(state.user);
}

function updateQuotaUI() {
  const status = Quota.getStatus(unlimitedAccess());
  const info = $("#quotaInfo");
  if (status.unlimited) {
    info.innerHTML = `status: <b style="color:var(--local)">unlimited</b> (${state.vip ? "VIP" : "developer"})`;
  } else {
    info.innerHTML = `terpakai: ${status.used}/${status.max} pesan &middot; reset: ${Quota.formatReset(status.resetInMs)}`;
  }
  const banner = $("#quotaBanner");
  if (!status.unlimited && status.remaining === 0) {
    banner.hidden = false;
    banner.innerHTML = `<span>Batas 4 pesan/5 jam tercapai. Reset ${Quota.formatReset(status.resetInMs)}.</span>`;
    $("#btnSend").disabled = true;
  } else {
    banner.hidden = true;
    $("#btnSend").disabled = false;
  }
}

function updateNetBadge() {
  const badge = $("#netBadge");
  state.online = navigator.onLine;
  badge.textContent = state.online ? "Online" : "Offline";
  badge.classList.toggle("offline", !state.online);
}

function updateRoutePill(route) {
  const pill = $("#routePill");
  const labels = { local: "Lokal siap", cloud: "Cloud aktif", hybrid: "Hybrid aktif" };
  pill.innerHTML = `<span class="dot dot-${route}"></span> ${labels[route] || "Auto"}`;
}

// ---------------- COMPOSER / SEND ----------------
function updateAgentModeChip() {
  const activeCount = state.agents.filter((a) => a.active).length || 1;
  const chip = $("#agentModeChip");
  chip.textContent = activeCount <= 1 ? "1 agen" : `${activeCount} agen · diskusi`;
  chip.classList.toggle("multi", activeCount > 1);
}

async function handleSend(e) {
  e.preventDefault();
  const input = $("#composerInput");
  const text = input.value.trim();
  if (!text) return;
  if (!unlimitedAccess() && !Quota.canSend(false)) {
    updateQuotaUI();
    return;
  }
  if (!state.activeChat) newChat();

  input.value = "";
  autosizeTextarea(input);
  appendMessage("user", text);
  state.activeChat.messages.push({ role: "user", text });
  if (state.activeChat.messages.length === 1) {
    state.activeChat.title = text.slice(0, 42);
  }

  Quota.recordSend(unlimitedAccess());
  updateQuotaUI();

  const history = state.activeChat.messages
    .slice(0, -1)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

  const routeCtx = { forced: state.route, online: navigator.onLine, hasAttachment: false };

  let assistantEl = null;
  let discussionHTML = "";
  let routeDecided = "local";

  await sendMessage(text, history, state.agents, routeCtx, {
    onRoute(decision) {
      routeDecided = decision.route;
      updateRoutePill(decision.route);
    },
    onDiscussionTurn() {
      // accumulate turns and re-render live once done for simplicity
    },
    onSynthesisStart() {
      assistantEl = appendMessage("assistant", "", { route: routeDecided });
    },
    onToken(_piece, full) {
      if (!assistantEl) assistantEl = appendMessage("assistant", "", { route: routeDecided });
      assistantEl.querySelector(".msg-text").textContent = full;
      scrollToBottom();
    },
    onDone(full, info) {
      if (info.turns?.length) {
        discussionHTML = discussionBlockHTML(info.turns);
        assistantEl.querySelector(".msg-name").insertAdjacentHTML("afterend", discussionHTML);
      }
      state.activeChat.messages.push({ role: "assistant", text: full, meta: { route: info.decision.route, discussionHTML } });
      saveChat(state.activeChat);
      refreshHistory();
    },
    onError(err) {
      if (!assistantEl) assistantEl = appendMessage("assistant", "", { route: routeDecided });
      assistantEl.querySelector(".msg-text").innerHTML =
        `<span style="color:var(--danger)">Gagal: ${escapeHTML(err.message)}</span>`;
    },
  });
}

function autosizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

// ---------------- AGENTS VIEW ----------------
let editingAgentId = null;

async function refreshAgentsUI() {
  state.agents = await Agents.ensureSeeded();
  renderAgentGrid();
  updateAgentModeChip();
}

function renderAgentGrid() {
  const grid = $("#agentGrid");
  grid.innerHTML = "";
  for (const a of state.agents) {
    const card = document.createElement("div");
    card.className = "agent-card";
    card.innerHTML = `
      <div class="agent-card-name"><span class="swatch" style="background:${a.color}"></span>${escapeHTML(a.name)}</div>
      <div class="agent-card-prompt">${escapeHTML(a.prompt)}</div>
      <div class="agent-card-foot">
        <div class="card-actions">
          <button data-act="edit">Ubah</button>
          <button data-act="del">Hapus</button>
        </div>
        <div class="switch ${a.active ? "on" : ""}" data-act="toggle"></div>
      </div>`;
    card.querySelector('[data-act="toggle"]').addEventListener("click", async () => {
      state.agents = await Agents.toggleAgent(a.id, state.agents);
      renderAgentGrid();
      updateAgentModeChip();
    });
    card.querySelector('[data-act="edit"]').addEventListener("click", () => openAgentModal(a));
    card.querySelector('[data-act="del"]').addEventListener("click", async () => {
      await Agents.removeAgent(a.id);
      state.agents = state.agents.filter((x) => x.id !== a.id);
      renderAgentGrid();
      updateAgentModeChip();
    });
    grid.appendChild(card);
  }
}

function openAgentModal(agent) {
  editingAgentId = agent?.id || null;
  $("#agentModalTitle").textContent = agent ? "Ubah karakter" : "Karakter baru";
  $("#agentNameInput").value = agent?.name || "";
  $("#agentPromptInput").value = agent?.prompt || "";
  renderColorRow(agent?.color || Agents.colorPalette()[0]);
  $("#agentModal").hidden = false;
}

function renderColorRow(selected) {
  const row = $("#agentColorRow");
  row.innerHTML = "";
  for (const c of Agents.colorPalette()) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "color-dot" + (c === selected ? " active" : "");
    dot.style.background = c;
    dot.dataset.color = c;
    dot.addEventListener("click", () => {
      $$(".color-dot").forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");
    });
    row.appendChild(dot);
  }
}

async function saveAgentFromModal() {
  const name = $("#agentNameInput").value.trim();
  const prompt = $("#agentPromptInput").value.trim();
  if (!name || !prompt) return;
  const color = $(".color-dot.active")?.dataset.color || Agents.colorPalette()[0];
  const existing = state.agents.find((a) => a.id === editingAgentId);
  const agent = existing
    ? { ...existing, name, prompt, color }
    : { name, prompt, color, active: true };
  await Agents.upsertAgent(agent);
  $("#agentModal").hidden = true;
  await refreshAgentsUI();
}

// ---------------- MODELS VIEW ----------------
async function refreshModelsUI() {
  const list = $("#modelList");
  list.innerHTML = `<div style="color:var(--text-mute);font-size:13px">Memuat daftar model…</div>`;
  try {
    const registry = await Models.fetchRegistry();
    const gpuOk = await Models.supportsWebGPU();
    list.innerHTML = "";
    if (!gpuOk) {
      list.innerHTML = `<div class="quota-info" style="color:var(--danger)">Browser ini tidak mendukung WebGPU. Model lokal tidak bisa dijalankan di sini — gunakan Chrome/Edge terbaru, atau pakai mode Cloud.</div>`;
    }
    for (const m of registry.models) {
      const row = document.createElement("div");
      row.className = "model-row";
      const isActive = Models.getActiveModelId() === m.id;
      row.innerHTML = `
        <div class="model-icon">${m.family.slice(0, 3).toUpperCase()}</div>
        <div class="model-info">
          <div class="model-name">${escapeHTML(m.name)} ${isActive ? '<span class="model-badge active">aktif</span>' : ""}</div>
          <div class="model-meta">~${m.sizeGB} GB &middot; RAM min ${m.ramMinGB} GB</div>
          <div class="model-progress" hidden><div class="model-progress-bar"></div></div>
        </div>
        <div class="model-actions">
          <button class="model-btn" data-act="load">${isActive ? "Muat ulang" : "Unduh & pakai"}</button>
          <button class="model-btn danger" data-act="forget">Lupakan</button>
        </div>`;
      row.querySelector('[data-act="load"]').addEventListener("click", () => downloadAndLoad(m, row));
      row.querySelector('[data-act="forget"]').addEventListener("click", async () => {
        await Models.unloadModel();
        refreshModelsUI();
      });
      list.appendChild(row);
    }
  } catch (err) {
    list.innerHTML = `<div style="color:var(--danger)">${escapeHTML(err.message)}</div>`;
  }
}

async function downloadAndLoad(model, row) {
  const bar = row.querySelector(".model-progress");
  const fill = row.querySelector(".model-progress-bar");
  const btn = row.querySelector('[data-act="load"]');
  bar.hidden = false;
  btn.disabled = true;
  btn.textContent = "Mengunduh…";
  try {
    await Models.loadModel(model.id, ({ progress }) => {
      fill.style.width = Math.round(progress * 100) + "%";
    });
    btn.textContent = "Aktif";
    refreshModelsUI();
  } catch (err) {
    btn.textContent = "Gagal, coba lagi";
    btn.disabled = false;
    console.error(err);
  }
}

// ---------------- SETTINGS VIEW ----------------
function renderRouteSegmented() {
  $$("#routeSegmented button").forEach((b) => {
    b.classList.toggle("active", b.dataset.route === state.route);
    b.addEventListener("click", () => {
      state.route = b.dataset.route;
      localPrefs.set("forcedRoute", state.route);
      renderRouteSegmented();
    });
  });
}

function renderAccountRow() {
  const row = $("#accountRow");
  if (state.user) {
    row.innerHTML = `
      <span class="avatar">${(state.user.displayName || state.user.email || "?")[0]}</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13.5px">${escapeHTML(state.user.displayName || "Pengguna")}</div>
        <div style="font-size:12px;color:var(--text-mute)">${escapeHTML(state.user.email || "")}</div>
      </div>
      <button class="link-btn" id="btnSignOut">Keluar</button>`;
    $("#btnSignOut")?.addEventListener("click", () => Auth.signOutUser());
  } else {
    row.innerHTML = `
      <div style="flex:1;font-size:13px;color:var(--text-dim)">Belum masuk. Masuk untuk sinkron riwayat & status VIP.</div>
      <button class="btn-primary" id="btnSignIn">Masuk dengan Google</button>`;
    $("#btnSignIn")?.addEventListener("click", async () => {
      try { await Auth.signInWithGoogle(); }
      catch (err) { alert(err.message); }
    });
  }
}

// ---------------- PROFILE MODAL ----------------
function renderProfileModal() {
  const body = $("#profileBody");
  const dev = Auth.isDeveloper(state.user);
  if (!state.user) {
    body.innerHTML = `
      <p style="color:var(--text-dim);font-size:13.5px">Belum masuk.</p>
      <button class="btn-primary full" id="profileSignIn">Masuk dengan Google</button>`;
    $("#profileSignIn")?.addEventListener("click", async () => {
      try { await Auth.signInWithGoogle(); $("#profileModal").hidden = true; }
      catch (err) { alert(err.message); }
    });
    return;
  }
  body.innerHTML = `
    <div class="profile-name">${escapeHTML(state.user.displayName || "Pengguna")}</div>
    <div class="profile-email">${escapeHTML(state.user.email || "")}</div>
    ${dev ? '<span class="profile-badge">Developer · unlimited</span>' : state.vip ? '<span class="profile-badge">VIP · unlimited</span>' : ""}
    <div class="profile-actions">
      <button data-view="settings" id="profileToSettings">Buka pengaturan</button>
      <button data-view="models" id="profileToModels">Kelola model lokal</button>
      <button id="profileSignOut">Keluar akun</button>
    </div>`;
  $("#profileToSettings").addEventListener("click", () => { switchView("settings"); $("#profileModal").hidden = true; });
  $("#profileToModels").addEventListener("click", () => { switchView("models"); $("#profileModal").hidden = true; });
  $("#profileSignOut").addEventListener("click", () => { Auth.signOutUser(); $("#profileModal").hidden = true; });
}

// ---------------- INIT ----------------
export async function initUI() {
  applyTheme(state.theme);
  renderThemeSwatches();
  renderRouteSegmented();
  renderAccountRow();
  wireSuggestChips();
  updateNetBadge();
  await refreshAgentsUI();
  await refreshHistory();
  updateQuotaUI();

  window.addEventListener("online", () => { updateNetBadge(); updateQuotaUI(); });
  window.addEventListener("offline", () => { updateNetBadge(); updateQuotaUI(); });

  Auth.onAuthChange(async (user) => {
    state.user = user;
    state.vip = user ? await Auth.checkVip(user) : false;
    renderAccountRow();
    $("#railAvatar").textContent = user ? (user.displayName || user.email || "?")[0].toUpperCase() : "?";
    updateQuotaUI();
  });

  // nav
  $$("[data-view]").forEach((el) => el.addEventListener("click", () => switchView(el.dataset.view)));
  $("#btnNewChat").addEventListener("click", newChat);
  $("#btnNewChat2").addEventListener("click", newChat);
  $("#btnOpenSidebar").addEventListener("click", openSidebarNarrow);
  $("#btnCloseSidebar").addEventListener("click", closeSidebarNarrow);
  $("#btnTheme").addEventListener("click", cycleTheme);
  $("#btnProfile").addEventListener("click", () => { renderProfileModal(); $("#profileModal").hidden = false; });
  $("#closeProfile").addEventListener("click", () => { $("#profileModal").hidden = true; });

  // composer
  $("#composerForm").addEventListener("submit", handleSend);
  $("#composerInput").addEventListener("input", (e) => autosizeTextarea(e.target));
  $("#composerInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#composerForm").requestSubmit(); }
  });

  // agents
  $("#btnAddAgent").addEventListener("click", () => openAgentModal(null));
  $("#closeAgentModal").addEventListener("click", () => { $("#agentModal").hidden = true; });
  $("#saveAgentBtn").addEventListener("click", saveAgentFromModal);

  // models view loads lazily when opened
  document.querySelector('[data-view="models"]').addEventListener("click", refreshModelsUI, { once: false });

  refreshModelsUI();

  setInterval(updateQuotaUI, 30000);
}
