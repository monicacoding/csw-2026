// ---------------------------------------------------------------------------
// Local mock data layer — a drop-in stand-in for Firestore while we're
// iterating on the look and feel. Same shape of operations Store.js needs
// (get/set/merge a doc, list a collection, increment a field), just backed
// by localStorage instead of a real backend.
//
// TO SWAP BACK TO FIRESTORE LATER: reintroduce the Firebase SDK script tags
// + firebase-config.js, and rewrite the bodies of the functions in store.js
// to call `db.collection(...)` again. Store.js's public API (the only thing
// the rest of the app talks to) does not need to change.
// ---------------------------------------------------------------------------

const MockDB = (() => {
  const KEY = 'csw2026_mockdb_v2';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }
  function save(all) {
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }
  function deepMerge(existing, incoming) {
    if (!isPlainObject(existing)) return incoming;
    if (!isPlainObject(incoming)) return incoming;
    const out = { ...existing };
    Object.keys(incoming).forEach((k) => {
      out[k] = isPlainObject(existing[k]) && isPlainObject(incoming[k])
        ? deepMerge(existing[k], incoming[k])
        : incoming[k];
    });
    return out;
  }

  function now() {
    return new Date().toISOString();
  }

  function getDoc(collection, id) {
    const all = load();
    const data = all[collection] && all[collection][id];
    return data ? { ...data } : null;
  }

  function setDoc(collection, id, data, merge = false) {
    const all = load();
    all[collection] = all[collection] || {};
    const existing = all[collection][id];
    all[collection][id] = merge ? deepMerge(existing || {}, data) : { ...data };
    save(all);
    return { ...all[collection][id] };
  }

  // Adds `amount` to `field` on the doc (creating the doc/field at 0 first
  // if needed), merged with any other fields passed in `rest`.
  function incrementField(collection, id, field, amount, rest = {}) {
    const all = load();
    all[collection] = all[collection] || {};
    const existing = all[collection][id] || {};
    const base = typeof existing[field] === 'number' ? existing[field] : 0;
    all[collection][id] = { ...existing, ...rest, [field]: base + amount };
    save(all);
    return { ...all[collection][id] };
  }

  function listCollection(collection) {
    const all = load();
    return Object.entries(all[collection] || {}).map(([id, data]) => ({ id, ...data }));
  }

  // Subcollections are addressed as "parentCollection/parentId/subName".
  function subPath(collection, id, sub) {
    return `${collection}/${id}/${sub}`;
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  return { getDoc, setDoc, incrementField, listCollection, subPath, now, reset };
})();

window.MockDB = MockDB;
