// ---------------------------------------------------------------------------
// Real Firestore data layer — the same interface js/mock-db.js had
// (getDoc, setDoc, incrementField, listCollection, subPath, now, plus
// deleteDoc — see below), so js/store.js's public API (Store.*, what the
// rest of the app actually calls) needed no shape changes to swap over —
// only `await` added in front of calls that are now genuinely async
// network requests instead of synchronous localStorage reads.
//
// No whole-database `reset()` here, still. MockDB.reset() wiped the
// *entire* local mock database — safe against a throwaway localStorage
// blob, but it would be a real, destructive, everyone's-data-wiping
// operation against this actual shared Firestore project, so that
// capability was never carried over wholesale. What *did* come back is
// Store.resetUserProgress — a per-user reset (this account's own docs
// only, never another user's), reachable only through the Developer Mode
// panel behind js/app.js's DEV_MODE flag. deleteDoc below exists
// specifically to support that.
// ---------------------------------------------------------------------------
import { db } from './firebase-config.js';
import {
  doc, getDoc as fsGetDoc, setDoc as fsSetDoc, deleteDoc as fsDeleteDoc,
  getDocs, collection as fsCollection, increment,
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

  // Used only by Store.resetUserProgress (the Developer Mode panel's Reset
  // button — see js/app.js's DEV_MODE) — no other flow in this app ever
  // deletes a document. Deleting something that doesn't exist is a no-op in
  // Firestore, not an error, so callers don't need to check existence first.
  async function deleteDoc(collectionPath, id) {
    await fsDeleteDoc(doc(db, collectionPath, id));
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

  return { getDoc, setDoc, deleteDoc, incrementField, listCollection, subPath, now };
})();

window.FirestoreDB = FirestoreDB;
