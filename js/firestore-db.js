// ---------------------------------------------------------------------------
// Real Firestore data layer — the exact same 6-function interface
// js/mock-db.js had (getDoc, setDoc, incrementField, listCollection,
// subPath, now), so js/store.js's public API (Store.*, what the rest of
// the app actually calls) needed no shape changes to swap over — only
// `await` added in front of calls that are now genuinely async network
// requests instead of synchronous localStorage reads.
//
// No `reset()` here. MockDB.reset() wiped the *entire* local mock database
// for quick testing — safe against a throwaway localStorage blob, but it
// would be a real, destructive, everyone's-data-wiping operation against
// this actual shared Firestore project. That capability (and the "Reset"
// button in the preview strip that called it) was deliberately dropped,
// not carried over — see js/app.js's renderPreviewStrip.
// ---------------------------------------------------------------------------
import { db } from './firebase-config.js';
import {
  doc, getDoc as fsGetDoc, setDoc as fsSetDoc, getDocs, collection as fsCollection, increment,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const FirestoreDB = (() => {
  // A plain client-generated timestamp — the same format MockDB always
  // used (an ISO string you can hand straight to `new Date(...)`), not a
  // Firestore serverTimestamp() sentinel. Every call site that sorts/
  // compares these (e.g. Store.getPhotoFinishEntries) already expects a
  // directly-parseable string; keeping this identical avoids introducing a
  // second timestamp shape half the codebase would need updating for.
  function now() {
    return new Date().toISOString();
  }

  async function getDoc(collectionPath, id) {
    const snap = await fsGetDoc(doc(db, collectionPath, id));
    return snap.exists() ? snap.data() : null;
  }

  // Return value is deliberately dropped (MockDB's callers never used it
  // either — every Store.* call site here is fire-and-forget on the
  // write itself) rather than spending an extra round-trip re-fetching
  // the doc just to hand back something nothing reads.
  async function setDoc(collectionPath, id, data, merge = false) {
    await fsSetDoc(doc(db, collectionPath, id), data, { merge });
  }

  // Adds `amount` to `field` on the doc (creating the doc/field at 0 first
  // if needed — Firestore's increment() sentinel does this on its own via
  // a merge-set, same as MockDB's from-scratch-if-missing behavior),
  // merged with any other fields passed in `rest`.
  async function incrementField(collectionPath, id, field, amount, rest = {}) {
    await fsSetDoc(doc(db, collectionPath, id), { ...rest, [field]: increment(amount) }, { merge: true });
  }

  async function listCollection(collectionPath) {
    const snap = await getDocs(fsCollection(db, collectionPath));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Subcollections are addressed as "parentCollection/parentId/subName" —
  // Firestore's own doc()/collection() parse a slash-delimited path string
  // directly (a 3-segment string here + one more `id` segment passed to
  // doc() = a valid 4-segment document path), so this stays a plain string
  // join, exactly like MockDB's version.
  function subPath(collectionPath, id, sub) {
    return `${collectionPath}/${id}/${sub}`;
  }

  return { getDoc, setDoc, incrementField, listCollection, subPath, now };
})();

window.FirestoreDB = FirestoreDB;
