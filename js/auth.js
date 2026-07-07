// ============================================================
// AI HYPER — auth & VIP lookup
// Google sign-in via Firebase Auth. VIP status lives in Firestore
// (collection "vip_users", doc id = lowercase email) so granting
// access to someone who paid is just adding a document — no redeploy,
// no code change. Developer emails in config.js are always unlimited.
// ============================================================

import { FIREBASE_CONFIG, DEVELOPER_EMAILS } from "./config.js";

let fbApp = null, fbAuth = null, fbDb = null;
let currentUser = null;
const listeners = [];

function isConfigured() {
  return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "REPLACE_ME";
}

async function ensureFirebase() {
  if (fbApp) return true;
  if (!isConfigured()) return false;
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
  ]);
  fbApp = initializeApp(FIREBASE_CONFIG);
  fbAuth = authMod.getAuth(fbApp);
  fbDb = fsMod.getFirestore(fbApp);
  authMod.onAuthStateChanged(fbAuth, (user) => {
    currentUser = user;
    listeners.forEach((cb) => cb(user));
  });
  window.__aihyperFirebase = { authMod, fsMod, fbAuth, fbDb }; // internal reuse
  return true;
}

export function onAuthChange(cb) {
  listeners.push(cb);
  if (currentUser !== undefined) cb(currentUser);
  return () => listeners.splice(listeners.indexOf(cb), 1);
}

export function getUser() {
  return currentUser;
}

export async function signInWithGoogle() {
  const ok = await ensureFirebase();
  if (!ok) {
    throw new Error(
      "Firebase belum dikonfigurasi. Isi FIREBASE_CONFIG di js/config.js dulu (lihat README)."
    );
  }
  const { authMod, fbAuth: auth } = window.__aihyperFirebase;
  const provider = new authMod.GoogleAuthProvider();
  const result = await authMod.signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser() {
  if (!fbAuth) return;
  const { authMod, fbAuth: auth } = window.__aihyperFirebase;
  await authMod.signOut(auth);
}

export function isDeveloper(user) {
  if (!user?.email) return false;
  return DEVELOPER_EMAILS.map((e) => e.toLowerCase()).includes(user.email.toLowerCase());
}

/** Reads vip_users/{email} from Firestore. Returns false if signed out,
 *  Firebase not configured, or no matching document. */
export async function checkVip(user) {
  if (!user?.email) return false;
  if (isDeveloper(user)) return true;
  const ok = await ensureFirebase();
  if (!ok) return false;
  try {
    const { fsMod, fbDb: db } = window.__aihyperFirebase;
    const ref = fsMod.doc(db, "vip_users", user.email.toLowerCase());
    const snap = await fsMod.getDoc(ref);
    return snap.exists() && snap.data()?.active !== false;
  } catch {
    return false;
  }
}

export { isConfigured as isFirebaseConfigured };
