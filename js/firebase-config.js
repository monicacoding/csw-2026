// ---------------------------------------------------------------------------
// Firebase project config + initialization. This is now a real, deployed
// Firestore backend — see js/firestore-db.js for the adapter that replaces
// js/mock-db.js (kept in the repo, unused, for reference/rollback to a
// local-only mock mode later if that's ever useful again).
//
// The values below are NOT secret. A Firebase *web app* config is meant to
// ship inside the client bundle — access control is enforced server-side by
// firestore.rules (deploy with `firebase deploy --only firestore:rules`),
// not by hiding this object. See README.md's "Firebase backend" section.
//
// Loaded as an ES module (`type="module"` in index.html) because the
// Firebase CDN SDK is only distributed as ES modules — this file and
// js/firestore-db.js are the *only* two scripts in the app that need to be
// modules. Every other script here stays a classic <script>, unchanged:
// per the HTML spec, module scripts are always deferred and are guaranteed
// to finish executing before DOMContentLoaded fires — which is what
// actually kicks off App.init() (see the very end of index.html) — so
// window.FirestoreDB (built from `db` below) is always ready in time
// regardless of where these two <script type="module"> tags sit relative
// to the classic ones.
// ---------------------------------------------------------------------------
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBi_GhjZiC-D6EYphhm0icYBs0pmgMYHrs',
  authDomain: 'csw-2026.firebaseapp.com',
  projectId: 'csw-2026',
  storageBucket: 'csw-2026.firebasestorage.app',
  messagingSenderId: '967196453687',
  appId: '1:967196453687:web:7b80ed0c539824c8ec48b2',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export { firebaseApp, db };
