// Local-only authentication and storage adapter.
// This project does not connect to Firebase. Data is saved in this browser's
// localStorage and is not shared across browsers or devices.

const DATA_KEY = "tropica.local-data.v1";
const SESSION_KEY = "tropica.local-admin-session";
const ADMIN_EMAIL = "abhishek@apple";
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

function rebrandText(value) {
  return value.replace(/Tropica\s+Industries/gi, "Apple Inc.")
    .replace(/Tropica/gi, "Apple Inc.")
    .replace(/FCFA/g, "AUD")
    .replace(/₣/g, "A$");
}
function makeAppleLogo() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "apple-login-mark");
  svg.style.cssText = "width:38px;height:38px;flex:none;filter:drop-shadow(0 1px 2px #001c16)";
  const body = document.createElementNS(ns, "path");
  body.setAttribute("fill", "#f4f4f2");
  body.setAttribute("stroke", "#b8c2be");
  body.setAttribute("stroke-width", "1.5");
  body.setAttribute("d", "M32 22c-6-6-17-7-23 1-8 11 1 32 10 37 5 3 9-1 13-1s8 4 13 1c9-5 18-26 10-37-6-8-17-7-23-1z");
  const leaf = document.createElementNS(ns, "path");
  leaf.setAttribute("fill", "#f4f4f2");
  leaf.setAttribute("stroke", "#b8c2be");
  leaf.setAttribute("stroke-width", "1.5");
  leaf.setAttribute("d", "M33 16C33 7 40 3 49 4c-1 8-7 13-16 13z");
  svg.append(body, leaf);
  return svg;
}
function makeLoginBrand() {
  const brand = document.createElement("div");
  brand.className = "apple-login-brand";
  brand.setAttribute("role", "img");
  brand.setAttribute("aria-label", "Apple Inc. Industries");
  brand.style.cssText = "display:flex;align-items:center;gap:12px;color:#f4f4f2";
  brand.append(makeAppleLogo());
  const copy = document.createElement("span");
  copy.style.cssText = "display:flex;flex-direction:column;line-height:1.04;letter-spacing:.09em";
  const name = document.createElement("strong");
  name.textContent = "Apple Inc.";
  name.style.cssText = "font-size:17px;font-weight:800;letter-spacing:.01em;color:#fff";
  const industry = document.createElement("small");
  industry.textContent = "INDUSTRIES";
  industry.style.cssText = "font-size:10px;font-weight:700;letter-spacing:.28em;color:#d0d9d5";
  copy.append(name, industry);
  brand.append(copy);
  return brand;
}
function rebrandPage() {
  if (!document.body) return;
  const title = rebrandText(document.title);
  if (title !== document.title) document.title = title;
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
  const loginHeader = document.querySelector(".art-top");
  if (loginHeader && !loginHeader.querySelector(".apple-login-brand")) loginHeader.replaceChildren(makeLoginBrand());
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
