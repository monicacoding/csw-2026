#!/usr/bin/env node
// ---------------------------------------------------------------------------
// This is a static site — plain HTML/CSS/JS, no framework, no bundler, no
// compilation step. There is nothing to transform, so "build" here means
// verify, not bundle: confirm every local asset index.html references
// actually exists on disk, and that every JS file parses cleanly, before
// any of that reaches a deploy. If this script exits 0, the repo root
// *is* the production output — that's also what gets served (see the
// "Deploy to Vercel" section in README.md for why no vercel.json is
// needed: Vercel's zero-config default Output Directory for a project
// with no recognized framework is the repo root, which is exactly where
// these files already live).
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

let failed = false;

// 1. Every <script src="..."> / <link href="..."> pointing at a local file
//    (i.e. not http(s):// and not a data: URI) must actually exist.
const refRe = /(?:src|href)="([^"]+)"/g;
const checked = new Set();
let match;
while ((match = refRe.exec(html))) {
  const ref = match[1];
  if (/^https?:\/\//.test(ref) || ref.startsWith('data:')) continue;
  if (checked.has(ref)) continue;
  checked.add(ref);
  if (!fs.existsSync(path.join(root, ref))) {
    console.error(`✗ index.html references a local asset that doesn't exist: ${ref}`);
    failed = true;
  }
}

// 2. Every .js file under js/ and data/ must parse without a syntax error.
function jsFilesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFilesUnder(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}
for (const dir of ['js', 'data']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of jsFilesUnder(abs)) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      console.error(`✗ Syntax error in ${path.relative(root, file)}:\n${err.stderr}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nBuild check failed — see errors above.');
  process.exit(1);
}

console.log(`✓ All ${checked.size} local asset references in index.html resolve.`);
console.log('✓ Every .js file under js/ and data/ parses cleanly.');
console.log('✓ Nothing to bundle — this is a static site; the repo root is the production output.');
