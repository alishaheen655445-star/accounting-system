// -----------------------------------------------------------------------------
//  serve-client.js — a tiny, dependency-free static file server for the frontend.
//  Serves the ../client folder on http://localhost:5500 (same port as VS Code
//  Live Server). Use this OR "Open with Live Server" — they are interchangeable.
//  The backend API must be running separately on http://localhost:3000.
// -----------------------------------------------------------------------------
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = path.join(__dirname, '..', 'client');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  // Security: never serve files outside the client folder (path traversal).
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // Dev server: always serve fresh files so design/code edits show on reload
      // (avoids stale-cached HTML/JS/CSS masking changes).
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✔ Frontend served at http://localhost:${PORT}`);
  console.log(`  (make sure the API is running on http://localhost:3000)`);
});
