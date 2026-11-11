import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, onSnapshot, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const persistenceReady = setPersistence(auth, browserLocalPersistence).then(() => null, error => error);

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

function buildState(collections) {
  const { salespeople, salesEntries, salesSnapshots, monthlyTargets, annualReports } = collections;
  const byId = new Map(salespeople.map(person => [person.id, person]));
  const months = [...new Set(annualReports.map(row => String(row.month).slice(-2)))].sort();
  const annualSalesData = months.length ? {
    currency: "INR", months: months.map(month => {
      const row = annualReports.find(item => String(item.month).slice(-2) === month) || {};
      return { month, agro: row.agro || {}, chemical: row.chemical || {}, oil: row.oil || {}, total: row.total || {} };
    }),
    totals: { total: Object.fromEntries([2025, 2026].map(year => [String(year), annualReports.reduce((sum, row) => sum + (Number(row.total?.[year]) || 0), 0)])) }
  } : null;
  return {
    people: salespeople.map(person => ({ ...person, sales: 0, target: Number(person.target) || 0 })),
    entries: salesEntries.map(entry => ({ ...entry, person: entry.person || byId.get(entry.salespersonId)?.name || "", qty: entry.quantity ?? entry.qty, published: entry.published ?? entry.status === "published" })),
    salesSnapshots: salesSnapshots.map(row => ({ ...row, salespersonName: row.salespersonName || byId.get(row.salespersonId)?.name || row.salespersonId, amount: Number(row.amount) || 0 })),
    teamTargets: Object.fromEntries(monthlyTargets.map(row => [row.month || row.id, Number(row.teamTarget) || 0]).filter(([month]) => /^\d{4}-\d{2}$/.test(month))),
    teamTarget: Number(monthlyTargets.find(row => row.month === "2026-11")?.teamTarget) || 0,
    annualSalesData
  };
}

function subscribeState(onUpdate, onError) {
  const names = ["salespeople", "salesEntries", "salesSnapshots", "monthlyTargets", "annualReports"];
  const collections = {};
  const readyNames = new Set();
  let resolveReady, rejectReady, readySettled = false, cancelled = false;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const unsubscribe = names.map(name => onSnapshot(collection(db, name), snapshot => {
    if (cancelled) return;
    collections[name] = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    readyNames.add(name);
    if (readyNames.size !== names.length) return;
    const state = buildState(collections);
    if (!readySettled) {
      readySettled = true;
      resolveReady(state);
    }
    try {
      onUpdate(state);
    } catch (error) {
      onError(error);
    }
  }, error => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(error);
    }
    onError(error);
  }));
  return {
    ready,
    unsubscribe() {
      cancelled = true;
      unsubscribe.forEach(stop => stop());
    }
  };
}

function stateCollections(state) {
  const snapshots = state.salesSnapshots.map(row => ({ ...row, id: `${row.month}_${row.salespersonId}` }));
  const targetMap = state.teamTargets || { "2026-11": state.teamTarget };
  const targets = Object.entries(targetMap).map(([month, teamTarget]) => ({ id: month, month, teamTarget: Number(teamTarget) || 0 }));
  const annualReports = (state.annualSalesData?.months || []).map((row, index) => ({
    id: String(row.month || String(index + 1).padStart(2, "0")).slice(-2),
    month: String(row.month || String(index + 1).padStart(2, "0")).slice(-2),
    agro: row.agro || {},
    chemical: row.chemical || {},
    oil: row.oil || {},
    total: row.total || {}
  }));
  return {
    salespeople: state.people,
    salesEntries: state.entries,
    salesSnapshots: snapshots,
    monthlyTargets: targets,
    annualReports
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function saveState(state, previousState) {
  if (!auth.currentUser) throw new Error("Sign in before saving business records.");
  const profile = await loadProfile(auth.currentUser.uid);
  if (profile?.role !== "admin" || profile.active !== true) throw new Error("Only an active administrator can change business records.");

  const next = stateCollections(state);
  const previous = previousState ? stateCollections(previousState) : Object.fromEntries(Object.keys(next).map(name => [name, []]));
  const operations = [];
  for (const [name, records] of Object.entries(next)) {
    const before = new Map((previous[name] || []).map(record => [String(record.id), record]));
    const after = new Map(records.map(record => [String(record.id), record]));
    for (const [id, record] of after) {
      if (stableStringify(before.get(id)) !== stableStringify(record)) {
        operations.push({ type: "set", ref: doc(db, name, id), data: record });
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) operations.push({ type: "delete", ref: doc(db, name, id) });
    }
  }
  for (let i = 0; i < operations.length; i += 450) {
    const batch = writeBatch(db);
    operations.slice(i, i + 450).forEach(op => op.type === "delete" ? batch.delete(op.ref) : batch.set(op.ref, op.data));
    await batch.commit();
  }
}

async function saveAdminProfile(profile) {
  if (!auth.currentUser) throw new Error("Sign in before updating the administrator profile.");
  await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: profile.name, photo: profile.photo || "", updatedAt: new Date().toISOString() }, { merge: true });
}

window.tropicaFirebase = {
  auth, db, signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  ready: persistenceReady, signOut: () => signOut(auth), onAuthStateChanged: (callback, onError) => onAuthStateChanged(auth, callback, onError),
  loadProfile, subscribeState, saveState, saveAdminProfile
};
