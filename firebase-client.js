// Local-only authentication and storage adapter.
// This project does not connect to Firebase. Data is saved in this browser's
// localStorage and is not shared across browsers or devices.

const DATA_KEY = "tropica.local-data.v1";
const SESSION_KEY = "tropica.local-admin-session";
const ADMIN_EMAIL = "admin@tropica";
const ADMIN_PASSWORD = "12345";
const ADMIN_UID = "local-admin";

function emptyState() {
  return { people: [], entries: [], salesSnapshots: [], teamTarget: 0, teamTargets: {}, annualSalesData: null };
}
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY) || "null");
    if (!saved || typeof saved !== "object") return emptyState();
    return {
      ...emptyState(), ...saved,
      people: Array.isArray(saved.people) ? saved.people : [],
      entries: Array.isArray(saved.entries) ? saved.entries : [],
      salesSnapshots: Array.isArray(saved.salesSnapshots) ? saved.salesSnapshots : [],
      teamTargets: saved.teamTargets && typeof saved.teamTargets === "object" ? saved.teamTargets : {}
    };
  } catch (error) {
    console.warn("Could not read local dashboard data.", error);
    return emptyState();
  }
}
function writeState(state) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); }
  catch (error) { throw new Error("Could not save data in this browser. Check available storage space and browser privacy settings.", { cause: error }); }
}
function makeAdminUser() {
  return { uid: ADMIN_UID, email: ADMIN_EMAIL, getIdTokenResult: async () => ({ authTime: new Date().toISOString() }) };
}
let currentUser = null;
let adminProfile = { role: "admin", active: true, displayName: "Jaykishan Tolani", photo: "" };
const authListeners = new Set();
const stateListeners = new Set();
function notifyAuth() { for (const listener of authListeners) queueMicrotask(() => listener(currentUser)); }
const auth = {};
Object.defineProperty(auth, "currentUser", { get: () => currentUser });
async function signIn(email, password) {
  if (String(email).trim().toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    throw Object.assign(new Error("The email or password is incorrect."), { code: "auth/invalid-credential" });
  }
  currentUser = makeAdminUser();
  try { localStorage.setItem(SESSION_KEY, "1"); } catch (error) { console.warn("Could not remember this sign-in.", error); }
  notifyAuth();
  return { user: currentUser };
}
async function signOut() {
  currentUser = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (error) { console.warn("Could not clear the local sign-in.", error); }
  notifyAuth();
}
function onAuthStateChanged(callback, onError = console.error) {
  authListeners.add(callback);
  queueMicrotask(() => { try { callback(currentUser); } catch (error) { onError(error); } });
  return () => authListeners.delete(callback);
}
async function loadProfile(uid) { return uid === ADMIN_UID ? { ...adminProfile } : null; }
function subscribeState(onUpdate, onError = console.error) {
  let active = true;
  const listener = () => { if (!active) return; try { onUpdate(readState()); } catch (error) { onError(error); } };
  stateListeners.add(listener);
  const state = readState();
  queueMicrotask(listener);
  return { ready: Promise.resolve(state), unsubscribe() { active = false; stateListeners.delete(listener); } };
}
async function saveState(state) {
  if (currentUser?.uid !== ADMIN_UID) throw new Error("Sign in as the administrator before saving data.");
  writeState(state);
  for (const listener of stateListeners) listener();
}
async function saveAdminProfile(profile) {
  if (currentUser?.uid !== ADMIN_UID) throw new Error("Sign in as the administrator before updating the profile.");
  adminProfile = { ...adminProfile, displayName: profile.name, photo: profile.photo || "" };
}

// Brand visible and dynamically generated page content consistently.
function rebrandText(value) {
  return value.replace(/Tropica\s+Industries/gi, "Apple Inc.")
    .replace(/Tropica/gi, "Apple Inc.")
    .replace(/FCFA/g, "AUD")
    .replace(/₣/g, "A$");
}
function rebrandPage() {
  if (!document.body) return;
  if (document.title) {
    const title = rebrandText(document.title);
    if (title !== document.title) document.title = title;
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const updated = rebrandText(node.nodeValue);
    if (updated !== node.nodeValue) node.nodeValue = updated;
  }
  document.querySelectorAll("[aria-label], [alt], [placeholder], [title]").forEach(element => {
    for (const attribute of ["aria-label", "alt", "placeholder", "title"]) {
      if (!element.hasAttribute(attribute)) continue;
      const original = element.getAttribute(attribute);
      const updated = rebrandText(original);
      if (updated !== original) element.setAttribute(attribute, updated);
    }
  });

  // The login hero has a separate embedded Tropica logo, not the .login-logo.
  const loginBrand = document.querySelector(".art-top > span");
  if (loginBrand && loginBrand.textContent !== "Apple Inc.") loginBrand.textContent = "Apple Inc.";
  const leaf = document.querySelector(".art-top img");
  if (leaf) leaf.remove();

  const greetingName = document.querySelector("#welcomeName");
  if (greetingName && greetingName.textContent !== "Abhishek") greetingName.textContent = "Abhishek";
  const greetingMark = document.querySelector("#overviewPage .wave");
  if (greetingMark) {
    if (greetingMark.textContent !== "!") greetingMark.textContent = "!";
    if (greetingMark.style.color !== "rgb(0, 0, 0)") greetingMark.style.color = "#000";
    if (greetingMark.style.fontStyle !== "normal") greetingMark.style.fontStyle = "normal";
  }

  document.querySelectorAll("img.login-logo, .brand img, .employee-brand img").forEach(image => {
    const wordmark = document.createElement("span");
    wordmark.className = `${image.className} apple-wordmark`;
    wordmark.textContent = "Apple Inc.";
    wordmark.setAttribute("role", "img");
    wordmark.setAttribute("aria-label", "Apple Inc.");
    wordmark.style.cssText = "display:inline-flex;align-items:center;justify-content:center;object-fit:contain;font-weight:800;font-size:1.15rem;letter-spacing:.02em;color:inherit;min-width:100px;min-height:36px";
    image.replaceWith(wordmark);
  });
}

if (localStorage.getItem(SESSION_KEY) === "1") currentUser = makeAdminUser();
window.tropicaFirebase = { auth, ready: Promise.resolve(null), signIn, signOut, onAuthStateChanged, loadProfile, subscribeState, saveState, saveAdminProfile };
function startBrandObserver() {
  rebrandPage();
  new MutationObserver(rebrandPage).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["aria-label", "alt", "placeholder", "title"]
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startBrandObserver, { once: true });
else startBrandObserver();
