// Minimal static file server for the Relic Press app, no dependencies required.
// Usage: node server.js [port]   (defaults to 4173)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const port = Number(process.argv[2]) || 4173;
const root = path.join(__dirname, 'items');
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon'
};

// Lets the browser app ask this local server to launch Ollama on demand, so the user never has to start it by hand.
const OLLAMA_EXE = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
let ollamaStarting = null;

// Saved-item library persisted to disk, so it survives both browser refreshes and server restarts.
const dataDir = path.join(__dirname, 'data');
const libraryFile = path.join(dataDir, 'library.json');
const imagesDir = path.join(dataDir, 'images');
const MAX_BODY_BYTES = 10 * 1024 * 1024;
// Only allow downloading from the local ComfyUI instance, never an arbitrary remote URL (avoids server-side request forgery).
const LOCAL_URL_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//i;

// Fetches a generated image's bytes from ComfyUI so it can be stored on disk instead of just linked to ComfyUI's own output folder.
function downloadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    http.get(sourceUrl, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Upstream HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_BODY_BYTES) { reject(new Error('Image too large')); res.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function saveImage(sourceUrl) {
  if (!LOCAL_URL_PATTERN.test(sourceUrl)) return Promise.reject(new Error('Only local ComfyUI URLs can be saved'));
  return downloadImage(sourceUrl).then(buffer => new Promise((resolve, reject) => {
    fs.mkdir(imagesDir, { recursive: true }, err => {
      if (err) return reject(err);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      fs.writeFile(path.join(imagesDir, name), buffer, err => err ? reject(err) : resolve(name));
    });
  }));
}

// Forwards a request to a local ComfyUI/SwarmUI backend so the browser never has to call it directly (that backend may not send CORS headers).
function proxyComfy(req, res, targetUrl, body) {
  if (!LOCAL_URL_PATTERN.test(targetUrl)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Only local ComfyUI URLs can be proxied' })); return; }
  let target;
  try { target = new URL(targetUrl); } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid url' })); return; }
  const proxyReq = http.request(target, { method: req.method, headers: { 'Content-Type': 'application/json' } }, proxyRes => {
    res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream' });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', err => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); });
  if (body) proxyReq.write(body);
  proxyReq.end();
}

function readLibrary() {
  return new Promise(resolve => {
    fs.readFile(libraryFile, 'utf8', (err, raw) => {
      if (err) return resolve([]);
      try {
        const items = JSON.parse(raw);
        resolve(Array.isArray(items) ? items : []);
      } catch {
        resolve([]);
      }
    });
  });
}

function writeLibrary(items) {
  return new Promise((resolve, reject) => {
    fs.mkdir(dataDir, { recursive: true }, err => {
      if (err) return reject(err);
      fs.writeFile(libraryFile, JSON.stringify(items), err => err ? reject(err) : resolve());
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => { if (!tooLarge) resolve(body); });
    req.on('error', reject);
  });
}

function pingOllama() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: 11434, path: '/api/tags', timeout: 1500 }, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureOllamaRunning() {
  if (await pingOllama()) return true;
  if (!ollamaStarting) {
    ollamaStarting = (async () => {
      try {
        // windowsHide stops Windows from popping up a console window for this detached console app
        const child = spawn(OLLAMA_EXE, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
      } catch (err) {
        console.error('Failed to launch Ollama:', err.message);
        return false;
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        if (await pingOllama()) return true;
        await new Promise(r => setTimeout(r, 500));
      }
      return false;
    })();
  }
  const result = await ollamaStarting;
  ollamaStarting = null;
  return result;
}

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (urlPath === '/api/ensure-ollama' && req.method === 'POST') {
    ensureOllamaRunning().then(running => {
      res.writeHead(running ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running }));
    });
    return;
  }
  if (urlPath === '/api/library' && req.method === 'GET') {
    readLibrary().then(items => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
    });
    return;
  }
  if (urlPath === '/api/library' && req.method === 'POST') {
    readBody(req).then(raw => {
      let items;
      try { items = JSON.parse(raw); } catch { throw new Error('Invalid JSON'); }
      if (!Array.isArray(items)) throw new Error('Expected a JSON array');
      return writeLibrary(items);
    }).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }
  if (urlPath === '/api/save-image' && req.method === 'POST') {
    readBody(req).then(raw => {
      let payload;
      try { payload = JSON.parse(raw); } catch { throw new Error('Invalid JSON'); }
      if (typeof payload.url !== 'string') throw new Error('Missing url');
      return saveImage(payload.url);
    }).then(name => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: `/generated-images/${name}` }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }
  if (urlPath.startsWith('/generated-images/')) {
    const fileName = path.basename(urlPath);
    fs.readFile(path.join(imagesDir, fileName), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    });
    return;
  }
  if (urlPath === '/api/comfy-proxy') {
    const targetUrl = new URL(req.url, 'http://internal').searchParams.get('url');
    if (!targetUrl) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing url' })); return; }
    readBody(req).then(body => proxyComfy(req, res, targetUrl, body)).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  const fullPath = path.normalize(path.join(root, urlPath));
  if (!fullPath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fullPath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`Relic Press served at http://localhost:${port}`));
