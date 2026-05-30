#!/usr/bin/env node
/*
 * render-canonical.js
 *
 * Renders a Claude Design HTML canonical bundle (which loads screen-*.jsx via
 * in-browser Babel) to a PNG at the locked viewport 1080x2444, deviceScaleFactor=1.
 *
 * Strategy: spin up a tiny local static HTTP server rooted at the HTML file's
 * directory so relative <script src="..."> tags resolve, then drive Playwright
 * chromium at the bundle. Injects VQA state via addInitScript so it lands on
 * window BEFORE any bundle script (including Babel-transpiled code) runs.
 *
 * Required npm deps (install in the consumer project):
 *   npm i playwright
 *
 * No other runtime deps; uses node built-ins http, fs, path, url, crypto, net.
 *
 * CLI:
 *   node render-canonical.js \
 *     --html <path-to-App.html> \
 *     --state <state.json> \
 *     --out <canonical.png> \
 *     [--screen <ScreenName>] \
 *     [--wait <ms|selector>]
 *
 * Exit:
 *   0 on success, prints {"ok":true,...} to stdout
 *   1 on failure, prints {"ok":false,"error":"..."} to stdout
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const url = require('url');

const VIEWPORT_WIDTH = 1080;
const VIEWPORT_HEIGHT = 2444;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8',
  '.ts': 'application/typescript; charset=utf-8',
  '.tsx': 'text/babel; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function usage() {
  return (
    'Usage: node render-canonical.js --html <App.html> --state <state.json> ' +
    '--out <canonical.png> [--screen <ScreenName>] [--wait <ms|selector>]'
  );
}

function fail(msg, err) {
  const payload = { ok: false, error: String(msg) };
  if (err && err.stack) payload.stack = err.stack;
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(1);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function safeJoin(root, reqPath) {
  // Strip query/hash, decode, then resolve under root, blocking traversal.
  let p = reqPath.split('?')[0].split('#')[0];
  try {
    p = decodeURIComponent(p);
  } catch (_) {
    return null;
  }
  const resolved = path.normalize(path.join(root, p));
  if (!resolved.startsWith(path.normalize(root))) return null;
  return resolved;
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url || '/';
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
      const filePath = safeJoin(rootDir, urlPath);
      if (!filePath) {
        res.writeHead(400);
        res.end('bad path');
        return;
      }
      fs.stat(filePath, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const ctype = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': ctype,
          'Content-Length': st.size,
          'Cache-Control': 'no-store',
        });
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
          try {
            res.destroy();
          } catch (_) {}
        });
        stream.pipe(res);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.html || !args.state || !args.out) {
    fail(usage());
  }

  const htmlPath = path.resolve(String(args.html));
  const statePath = path.resolve(String(args.state));
  const outPath = path.resolve(String(args.out));

  if (!fs.existsSync(htmlPath)) fail(`html not found: ${htmlPath}`);
  if (!fs.existsSync(statePath)) fail(`state not found: ${statePath}`);

  let state;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (e) {
    fail(`invalid state JSON: ${e.message}`);
  }

  // Lazy require so usage errors don't require playwright to be installed.
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    fail('playwright not installed. Run: npm i playwright', e);
  }

  const rootDir = path.dirname(htmlPath);
  const htmlBase = path.basename(htmlPath);

  // Ensure out dir exists.
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const port = await findFreePort();
  const server = await startStaticServer(rootDir, port);

  let browser = null;
  const cleanup = async () => {
    try {
      if (browser) await browser.close();
    } catch (_) {}
    try {
      server.close();
    } catch (_) {}
  };

  const onSigint = () => {
    cleanup().finally(() => process.exit(130));
  };
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigint);

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: 1,
      screen: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    });

    const initScript = `
      (function(){
        try {
          window.__VQA_STATE__ = ${JSON.stringify(state)};
        } catch(e) {}
        ${
          args.screen && args.screen !== true
            ? `try { window.__VQA_SCREEN__ = ${JSON.stringify(String(args.screen))}; } catch(e) {}`
            : ''
        }
      })();
    `;
    await context.addInitScript({ content: initScript });

    const page = await context.newPage();

    // Surface page errors to stderr so failures aren't silent.
    page.on('pageerror', (e) => {
      process.stderr.write(`[pageerror] ${e.message}\n`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        process.stderr.write(`[console.error] ${msg.text()}\n`);
      }
    });

    const targetUrl = `http://127.0.0.1:${port}/${encodeURIComponent(htmlBase)}`;
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 60_000 });

    // Wait strategy.
    if (args.wait !== undefined && args.wait !== true) {
      const w = String(args.wait);
      const asNum = Number(w);
      if (Number.isFinite(asNum) && asNum >= 0 && /^\d+$/.test(w.trim())) {
        await page.waitForTimeout(asNum);
      } else {
        await page.waitForSelector(w, { timeout: 60_000 });
      }
    } else {
      await page.waitForFunction(() => window.__APP_READY__ === true, null, {
        timeout: 60_000,
      });
    }

    await page.screenshot({
      path: outPath,
      fullPage: false,
      clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      type: 'png',
    });

    process.stdout.write(
      JSON.stringify({
        ok: true,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        out: outPath,
      }) + '\n'
    );
  } catch (e) {
    await cleanup();
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigint);
    fail(`render failed: ${e.message}`, e);
    return;
  }

  await cleanup();
  process.off('SIGINT', onSigint);
  process.off('SIGTERM', onSigint);
  process.exit(0);
}

main().catch((e) => fail(e.message || String(e), e));
