// Browser-only authentication and storage adapter.
// All application data remains in this browser's localStorage; nothing is sent
// to a remote database or shared with other browsers/devices.

const DATA_KEY = "company-name.local-data.v1";
const SESSION_KEY = "company-name.local-admin-session";
const ADMIN_EMAIL = "abhishek@company.com";
const ADMIN_PASSWORD = "12345";
const ADMIN_UID = "local-admin";

const DEMO_STATE = {
  people: [
    { id: "demo-1", name: "Alex Morgan", region: "Sydney", active: true, sales: 0, target: 0 },
    { id: "demo-2", name: "Taylor Reed", region: "Melbourne", active: true, sales: 0, target: 0 },
    { id: "demo-3", name: "Jordan Lee", region: "Brisbane", active: true, sales: 0, target: 0 },
    { id: "demo-4", name: "Casey Patel", region: "Perth", active: true, sales: 0, target: 0 },
    { id: "demo-5", name: "Riley Kim", region: "Adelaide", active: true, sales: 0, target: 0 },
    { id: "demo-6", name: "Morgan Blake", region: "Canberra", active: true, sales: 0, target: 0 },
    { id: "demo-7", name: "Jamie Chen", region: "Hobart", active: true, sales: 0, target: 0 },
    { id: "demo-8", name: "Drew Wilson", region: "Darwin", active: true, sales: 0, target: 0 }
  ],
  entries: [],
  salesSnapshots: [
    { id: "2026-11_demo-1", month: "2026-11", salespersonId: "demo-1", salespersonName: "Alex Morgan", amount: 7000000 },
    { id: "2026-11_demo-2", month: "2026-11", salespersonId: "demo-2", salespersonName: "Taylor Reed", amount: 6000000 },
    { id: "2026-11_demo-3", month: "2026-11", salespersonId: "demo-3", salespersonName: "Jordan Lee", amount: 5500000 },
    { id: "2026-11_demo-4", month: "2026-11", salespersonId: "demo-4", salespersonName: "Casey Patel", amount: 5000000 },
    { id: "2026-11_demo-5", month: "2026-11", salespersonId: "demo-5", salespersonName: "Riley Kim", amount: 4800000 },
    { id: "2026-11_demo-6", month: "2026-11", salespersonId: "demo-6", amount: 4500000 },
    { id: "2026-11_demo-7", month: "2026-11", salespersonId: "demo-7", amount: 4000000 },
    { id: "2026-11_demo-8", month: "2026-11", salespersonId: "demo-8", amount: 3520000 }
  ],
  teamTarget: 245000000,
  teamTargets: { "2026-11": 245000000 },
  annualSalesData: {
    currency: "FCFA",
    years: [2025, 2026],
    months: [
      { month: "01", total: { "2025": 3500000, "2026": 4500000 } },
      { month: "02", total: { "2025": 8500000, "2026": 10000000 } },
      { month: "03", total: { "2025": 7500000, "2026": 9000000 } },
      { month: "04", total: { "2025": 10000000, "2026": 12000000 } },
      { month: "05", total: { "2025": 11000000, "2026": 14500000 } },
      { month: "06", total: { "2025": 15000000, "2026": 18500000 } },
      { month: "07", total: { "2025": 9000000, "2026": 15500000 } },
      { month: "08", total: { "2025": 10000000, "2026": 13500000 } },
      { month: "09", total: { "2025": 15000000, "2026": 22000000 } },
      { month: "10", total: { "2025": 18000000, "2026": 25000000 } },
      { month: "11", total: { "2025": 24000000, "2026": 40320000 } },
      { month: "12", total: { "2025": null, "2026": null } }
    ]
  }
};

function emptyState() { return JSON.parse(JSON.stringify(DEMO_STATE)); }
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
function showLocalAdminDashboard() {
  const login = document.getElementById("loginView");
  const app = document.getElementById("appView");
  if (!login || !app) return;
  login.classList.add("hidden");
  app.classList.remove("hidden", "employee-mode");
  document.getElementById("authLoading")?.classList.add("hidden");
  document.documentElement.classList.remove("auth-pending");
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.getElementById("overviewPage")?.classList.add("active");
  document.getElementById("adminNav")?.classList.remove("hidden");
  document.getElementById("employeeNav")?.classList.add("hidden");
  const name = document.getElementById("userName");
  if (name) name.textContent = "Abhishek";
  const role = document.getElementById("userRole");
  if (role) role.textContent = "Administrator";
}
let currentUser = null;
let adminProfile = { role: "admin", active: true, displayName: "Abhishek", photo: "" };
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
  showLocalAdminDashboard();
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

if (localStorage.getItem(SESSION_KEY) === "1") {
  currentUser = makeAdminUser();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showLocalAdminDashboard, { once: true });
  else showLocalAdminDashboard();
}
// app.js uses this adapter interface; all authentication and data are local-only.
window.tropicaFirebase = { auth, ready: Promise.resolve(null), signIn, signOut, onAuthStateChanged, loadProfile, subscribeState, saveState, saveAdminProfile };
