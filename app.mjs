
const APP_KEY = 'ai-hybrid-one-v1';
const CHAT_KEY = APP_KEY + ':chat';
const MEMORY_KEY = APP_KEY + ':memory';
const GH_TOKEN_KEY = APP_KEY + ':gh-token';
const GH_GIST_KEY = APP_KEY + ':gh-gist';
const INSTALL_KEY = APP_KEY + ':installed-pack';

const chatEl = document.getElementById('chat');
const promptEl = document.getElementById('prompt');
const sendBtn = document.getElementById('send-btn');
const installBtn = document.getElementById('install-btn');
const warmBtn = document.getElementById('warm-btn');
const cacheStatusEl = document.getElementById('cache-status');
const progressChip = document.getElementById('progress-chip');
const runtimePill = document.getElementById('runtime-pill');
const modelPackName = document.getElementById('model-pack-name');
const modelPackDesc = document.getElementById('model-pack-desc');
const netStatusEl = document.getElementById('net-status');
const fileInput = document.getElementById('file-input');
const attachmentBar = document.getElementById('attachment-bar');
const memoryBar = document.getElementById('memory-bar');
const memoryInput = document.getElementById('memory-input');
const installPwaBtn = document.getElementById('install-pwa-btn');

let deferredPrompt = null;
let generator = null;
let tfModule = null;
let isBusy = false;
let attachments = [];
let state = {
  memory: localStorage.getItem(MEMORY_KEY) || '',
  chat: JSON.parse(localStorage.getItem(CHAT_KEY) || '[]')
};

memoryInput.value = state.memory;

function chooseModelPack() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile && mem >= 8 && cores >= 8) {
    return {
      id: 'onnx-community/Qwen2.5-1.5B-Instruct',
      label: 'Qwen2.5 1.5B (otomatis)',
      size: '~900MB',
      reason: 'Perangkat cukup kuat, jadi paket lebih pintar dipilih otomatis.',
      onnxHint: 'q4f16'
    };
  }
  return {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    label: 'Qwen2.5 0.5B (otomatis)',
    size: '~400MB',
    reason: 'Agar lebih realistis dipakai di perangkat menengah dan mobile.',
    onnxHint: 'q4'
  };
}

const MODEL = chooseModelPack();
modelPackName.textContent = MODEL.label;
modelPackDesc.textContent = `${MODEL.size} • ${MODEL.reason} • Tetap satu AI di UI, tanpa pilihan LLM.`;
runtimePill.textContent = `⚡ Paket aktif: ${MODEL.label} • cache per-perangkat/per-browser`;

function saveState() {
  localStorage.setItem(CHAT_KEY, JSON.stringify(state.chat));
  localStorage.setItem(MEMORY_KEY, state.memory || '');
}

function setNetStatus() {
  netStatusEl.textContent = navigator.onLine ? 'Online' : 'Offline';
  netStatusEl.className = navigator.onLine ? 'v good' : 'v warn';
}
setNetStatus();
window.addEventListener('online', setNetStatus);
window.addEventListener('offline', setNetStatus);

function addMessage(role, text, cls='') {
  const div = document.createElement('div');
  div.className = `msg ${role} ${cls}`.trim();
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function renderChat() {
  chatEl.innerHTML = '';
  if (!state.chat.length) {
    addMessage('ai', 'Halo, saya Nian One. Saya fokus jadi satu AI yang tenang, rapi, dan siap dipakai offline setelah model lokal diunduh sekali.');
    addMessage('note', 'Tips: mulai dari tombol “Unduh otak lokal”, lalu kirim pesan biasa. Untuk pertanyaan yang butuh internet, saya akan memberi penanda di jawaban.');
  }
  for (const m of state.chat) addMessage(m.role, m.text, m.cls || '');
  syncMemoryChip();
}

function syncMemoryChip() {
  memoryBar.innerHTML = '';
  if (state.memory?.trim()) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = '🧠 Memori aktif: ' + state.memory.slice(0, 90) + (state.memory.length > 90 ? '…' : '');
    memoryBar.appendChild(chip);
  }
}

function syncAttachments() {
  attachmentBar.innerHTML = '';
  for (const file of attachments) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`;
    chip.textContent = `📎 ${file.name} • ${size}`;
    attachmentBar.appendChild(chip);
  }
}

fileInput.addEventListener('change', e => {
  attachments = Array.from(e.target.files || []).slice(0, 4);
  syncAttachments();
});

function updateInstallState() {
  const installed = JSON.parse(localStorage.getItem(INSTALL_KEY) || 'null');
  if (installed?.id === MODEL.id) {
    cacheStatusEl.textContent = 'Siap';
    progressChip.textContent = `Sudah diunduh • ${installed.id.split('/').pop()}`;
  } else {
    cacheStatusEl.textContent = 'Belum dipasang';
    progressChip.textContent = 'Belum diunduh';
  }
}
updateInstallState();

async function loadTransformers() {
  if (tfModule) return tfModule;
  progressChip.textContent = 'Memuat mesin inferensi…';
  tfModule = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6');
  const { env } = tfModule;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  return tfModule;
}

async function installOrWarmModel(forceInstall = false) {
  const installed = JSON.parse(localStorage.getItem(INSTALL_KEY) || 'null');
  if (generator && !forceInstall) return generator;
  const { pipeline } = await loadTransformers();
  progressChip.textContent = forceInstall || !installed ? 'Menyiapkan unduhan model…' : 'Memuat model dari cache lokal…';
  generator = await pipeline('text-generation', MODEL.id, {
    progress_callback: data => {
      const status = data?.status || 'memproses';
      const pct = data?.progress != null ? Math.round(data.progress) + '%' : '';
      const file = data?.file ? ` • ${String(data.file).split('/').pop()}` : '';
      progressChip.textContent = `${status}${pct ? ' • ' + pct : ''}${file}`;
    }
  });
  localStorage.setItem(INSTALL_KEY, JSON.stringify({ id: MODEL.id, at: new Date().toISOString() }));
  updateInstallState();
  progressChip.textContent = 'Model siap dipakai';
  return generator;
}

function needInternet(query, files = []) {
  const q = (query || '').toLowerCase();
  if (files.some(f => f.type.startsWith('video/'))) return true;
  return /(hari ini|terbaru|update|berita|harga|siapa juara|cuaca|cari di web|search web|cari web|browsing|website|link|sumber)/i.test(q);
}

async function fetchLightWebContext(query) {
  if (!navigator.onLine) return '';
  try {
    const searchUrl = `https://id.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=2&namespace=0&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) return '';
    const data = await res.json();
    const titles = Array.isArray(data?.[1]) ? data[1] : [];
    const descs = Array.isArray(data?.[2]) ? data[2] : [];
    const links = Array.isArray(data?.[3]) ? data[3] : [];
    if (!titles.length) return '';
    return titles.map((t, i) => `- ${t}: ${descs[i] || ''} (${links[i] || ''})`).join('\n');
  } catch {
    return '';
  }
}

function attachmentSummary(files) {
  if (!files.length) return '';
  return files.map(f => `${f.name} [${f.type || 'file'}, ${(f.size / 1024).toFixed(0)} KB]`).join('; ');
}

function buildPrompt(userText, webContext, files) {
  const memory = state.memory?.trim() ? `Memori pengguna: ${state.memory.trim()}\n` : '';
  const internetNotice = needInternet(userText, files)
    ? (navigator.onLine
      ? 'Tambahkan pemberitahuan singkat di awal jawaban bahwa internet/web context dipakai.\n'
      : 'Tambahkan pemberitahuan singkat di awal jawaban bahwa pengguna sedang offline sehingga data terbaru mungkin tidak tersedia.\n')
    : '';
  const fileBlock = files.length ? `Lampiran pengguna: ${attachmentSummary(files)}\nJika lampiran berupa video/gambar, jujur bahwa versi lokal ini baru menerima lampiran dan metadata, belum menganalisis isi video secara penuh tanpa pipeline vision tambahan.\n` : '';
  const webBlock = webContext ? `Web context ringkas:\n${webContext}\n` : '';
  const history = state.chat.slice(-8).map(m => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.text}`).join('\n');
  return `Kamu adalah Nian One, satu AI yang rapi, jujur, tidak bertele-tele, kuat di coding, brainstorming, perencanaan produk, game ideas, dan penjelasan praktis.\n${memory}${internetNotice}${fileBlock}${webBlock}Aturan:\n- Jawab dalam Bahasa Indonesia alami.\n- Jika butuh internet namun offline, jelaskan keterbatasannya secara elegan.\n- Jangan mengaku bisa melihat isi video/gambar jika memang belum dianalisis.\n- Untuk coding, beri langkah dan kode yang bisa dipakai.\n- Jika ditanya trading, beri analisis hati-hati dan ingatkan risiko.\n\nRiwayat singkat:\n${history || 'Belum ada'}\n\nPengguna: ${userText}\nAsisten:`;
}

async function askLocalModel(userText, files) {
  await installOrWarmModel(false);
  const webContext = needInternet(userText, files) ? await fetchLightWebContext(userText) : '';
  const prompt = buildPrompt(userText, webContext, files);
  const result = await generator(prompt, {
    max_new_tokens: 260,
    temperature: 0.55,
    top_p: 0.92,
    repetition_penalty: 1.08,
    do_sample: true
  });
  let raw = Array.isArray(result) ? (result[0]?.generated_text || '') : String(result || '');
  if (raw.includes('Asisten:')) raw = raw.split('Asisten:').pop();
  return raw.trim();
}

async function sendMessage() {
  if (isBusy) return;
  const text = promptEl.value.trim();
  if (!text) return;
  isBusy = true;
  sendBtn.disabled = true;
  const files = attachments.slice();
  attachments = [];
  syncAttachments();
  fileInput.value = '';

  state.chat.push({ role: 'user', text });
  saveState();
  addMessage('user', text);
  promptEl.value = '';

  if (needInternet(text, files)) {
    const netMsg = navigator.onLine
      ? 'ℹ️ Permintaan ini kemungkinan memerlukan internet. Saya akan mencoba menambah konteks online ringan bila tersedia.'
      : 'ℹ️ Permintaan ini biasanya memerlukan internet, tetapi perangkat sedang offline. Saya akan jawab dengan kemampuan lokal yang tersedia.';
    state.chat.push({ role: 'note', text: netMsg, cls: 'note' });
    saveState();
    addMessage('note', netMsg, 'note');
  }

  if (files.length) {
    const fileMsg = 'Lampiran diterima: ' + attachmentSummary(files);
    state.chat.push({ role: 'note', text: fileMsg, cls: 'note' });
    saveState();
    addMessage('note', fileMsg, 'note');
  }

  try {
    const answer = await askLocalModel(text, files);
    state.chat.push({ role: 'ai', text: answer });
    saveState();
    addMessage('ai', answer);
  } catch (err) {
    const msg = 'Gagal memproses lokal: ' + (err?.message || err);
    state.chat.push({ role: 'note', text: msg, cls: 'err' });
    saveState();
    addMessage('note', msg, 'err');
  } finally {
    isBusy = false;
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', sendMessage);
promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
installBtn.addEventListener('click', () => installOrWarmModel(true).catch(err => addMessage('note', 'Gagal mengunduh model: ' + err.message, 'err')));
warmBtn.addEventListener('click', () => installOrWarmModel(false).catch(err => addMessage('note', 'Gagal memuat model: ' + err.message, 'err')));

document.getElementById('memory-save').addEventListener('click', () => {
  state.memory = memoryInput.value.trim();
  saveState();
  syncMemoryChip();
  addMessage('note', '🧠 Memori pengguna diperbarui.', 'note');
});

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!confirm('Hapus semua percakapan lokal?')) return;
  state.chat = [];
  saveState();
  renderChat();
});

document.getElementById('smart-code-btn').addEventListener('click', () => {
  promptEl.value = 'Bantu saya membuat fitur ini langkah demi langkah. Beri struktur folder, kode inti, dan urutan implementasi yang realistis.';
  promptEl.focus();
});
document.getElementById('smart-research-btn').addEventListener('click', () => {
  promptEl.value = 'Tolong riset topik ini. Jika butuh internet, beri penanda di awal jawaban. Lalu ringkas poin penting, risiko, dan langkah lanjut.';
  promptEl.focus();
});
document.getElementById('smart-game-btn').addEventListener('click', () => {
  promptEl.value = 'Bantu saya membuat game sederhana. Beri ide gameplay, loop utama, struktur file, lalu kode HTML/CSS/JS awal yang langsung jalan.';
  promptEl.focus();
});

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('export-btn').addEventListener('click', () => {
  downloadJSON('ai-hybrid-one-backup.json', {
    memory: state.memory,
    chat: state.chat,
    exportedAt: new Date().toISOString(),
    model: MODEL.id
  });
});

document.getElementById('import-file').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
    state.memory = data.memory || '';
    state.chat = Array.isArray(data.chat) ? data.chat : [];
    memoryInput.value = state.memory;
    saveState();
    renderChat();
    addMessage('note', 'Backup berhasil diimpor.', 'note');
  } catch (err) {
    addMessage('note', 'Impor gagal: ' + err.message, 'err');
  }
});

const ghTokenInp = document.getElementById('gh-token');
const ghGistInp = document.getElementById('gh-gist');
ghTokenInp.value = localStorage.getItem(GH_TOKEN_KEY) || '';
ghGistInp.value = localStorage.getItem(GH_GIST_KEY) || '';

function persistGitHubFields() {
  localStorage.setItem(GH_TOKEN_KEY, ghTokenInp.value.trim());
  localStorage.setItem(GH_GIST_KEY, ghGistInp.value.trim());
}
ghTokenInp.addEventListener('change', persistGitHubFields);
ghGistInp.addEventListener('change', persistGitHubFields);

async function githubSave() {
  persistGitHubFields();
  const token = ghTokenInp.value.trim();
  let gistId = ghGistInp.value.trim();
  if (!token) throw new Error('GitHub token kosong');
  const payload = {
    description: 'AI Hybrid One backup',
    public: false,
    files: {
      'ai-hybrid-one-backup.json': {
        content: JSON.stringify({ memory: state.memory, chat: state.chat, savedAt: new Date().toISOString(), model: MODEL.id }, null, 2)
      }
    }
  };
  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Gagal menyimpan gist');
  if (!gistId && data.id) {
    gistId = data.id;
    ghGistInp.value = gistId;
    persistGitHubFields();
  }
  addMessage('note', 'Backup berhasil disimpan ke GitHub Gist privat.', 'note');
}

async function githubLoad() {
  persistGitHubFields();
  const token = ghTokenInp.value.trim();
  const gistId = ghGistInp.value.trim();
  if (!token || !gistId) throw new Error('GitHub token atau gist ID belum diisi');
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Gagal mengambil gist');
  const file = data.files?.['ai-hybrid-one-backup.json'];
  if (!file?.content) throw new Error('File backup tidak ditemukan di gist');
  const backup = JSON.parse(file.content);
  state.memory = backup.memory || '';
  state.chat = Array.isArray(backup.chat) ? backup.chat : [];
  memoryInput.value = state.memory;
  saveState();
  renderChat();
  addMessage('note', 'Backup berhasil diambil dari GitHub.', 'note');
}

document.getElementById('gh-save').addEventListener('click', () => githubSave().catch(err => addMessage('note', err.message, 'err')));
document.getElementById('gh-load').addEventListener('click', () => githubLoad().catch(err => addMessage('note', err.message, 'err')));

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installPwaBtn.disabled = false;
});
installPwaBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    addMessage('note', 'Instalasi PWA belum tersedia di browser ini. Gunakan menu browser > Add to Home Screen.', 'note');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderChat();
