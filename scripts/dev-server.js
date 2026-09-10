// Minimal static file server for local preview (see .claude/launch.json).
// Deliberately never calls process.cwd() anywhere — `path.join(__dirname, '..')`
// resolves the project root from this module's own file location instead,
// which Node can do without touching cwd at all. That's a real constraint,
// not just tidiness: `python3 -m http.server` crashes on exactly this in
// some sandboxed shells (its argument parser calls os.getcwd() as an eager
// default before even looking at --directory), which is why this file
// exists instead of just using that or `npx serve`.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8935;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Serving ${ROOT} on :${PORT}`));
