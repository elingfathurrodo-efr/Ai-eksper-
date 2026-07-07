// ============================================================
// AI HYPER — central config
// Everything a deployer needs to touch to make this "theirs"
// lives in this one file. See README.md for step-by-step setup.
// ============================================================

export const APP_NAME = "AI Hyper";

// ---- Firebase (client-side config is NOT secret, it's a project
// pointer — safe to commit. Create your own project at
// https://console.firebase.google.com and paste its config here.
export const FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// ---- Cloud gateway: a Firebase Cloud Function you deploy yourself
// (see /functions/index.js). It holds the REAL LLM API key server-side,
// so the app itself never asks the user for one. Point this at your
// deployed function URL after `firebase deploy --only functions`.
export const CLOUD_GATEWAY_URL =
  "https://REGION-REPLACE_ME.cloudfunctions.net/chatGateway";

// ---- Access policy -----------------------------------------------
// Developer email(s): always unlimited, always full access. Add your
// own Google account email here before deploying.
export const DEVELOPER_EMAILS = [
  "you@example.com",
];

// Non-VIP quota. VIP status itself is stored in Firestore
// (collection "vip_users", doc id = user email) so you can grant it
// to anyone who has paid, without redeploying the app.
export const FREE_QUOTA = {
  maxMessages: 4,
  windowHours: 5,
};

// ---- Local model registry -----------------------------------------
export const MODEL_REGISTRY_URL = "data/model-registry.json";

// ---- Misc
export const DEFAULT_THEME = "hyper-dark";
export const THEMES = ["hyper-dark", "paper-light", "midnight-violet", "terminal-green"];
