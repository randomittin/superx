#!/usr/bin/env node
/**
 * fetch-canonical.js — download a Claude Design (or arbitrary canonical
 * HTML) bundle to a local directory by intercepting every network
 * response while Playwright loads the page. Preserves the URL path
 * layout under the out-dir so relative refs in the bundle keep working
 * when served back via the static HTTP harness in render-canonical.js.
 *
 * Usage:
 *   node fetch-canonical.js --url <url> --out-dir <dir> [--timeout 60000] [--headed]
 *
 * Auth: pages that require login should be fetched with --headed.
 * Chromium launches visibly; the user logs in; once the page reaches
 * networkidle the response handler has captured the bundle and the
 * browser closes. Headless is the default.
 *
 * Output: stdout JSON {"ok":true,"out_dir":"…","files":N,"entry":"…"}
 * Failure: stderr error + non-zero exit.
 *
 * Deps: playwright
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function parseArgs(argv) {
  const out = { headed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headed') { out.headed = true; continue; }
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
      out[k] = v;
    }
  }
  return out;
}

function safeJoin(base, rel) {
  const joined = path.normalize(path.join(base, rel));
  const resolved = path.resolve(joined);
  const baseResolved = path.resolve(base);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error('path escape: ' + rel);
  }
  return resolved;
}

const KEEP_EXT = /\.(html|htm|js|jsx|tsx|ts|mjs|cjs|css|svg|png|jpe?g|gif|webp|woff2?|ttf|otf|wasm|json|map|ico)$/i;
const KEEP_CT = /(html|javascript|json|css|svg\+xml|image\/|font|wasm|octet-stream|jsx|typescript|plain|xml)/;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args['out-dir']) {
    process.stderr.write(
      'usage: fetch-canonical.js --url <url> --out-dir <dir> [--timeout 60000] [--headed]\n'
    );
    process.exit(1);
  }

  const url = args.url;
  const outDir = path.resolve(args['out-dir']);
  const timeout = parseInt(args.timeout || '60000', 10);

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !args.headed });
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 2444, deviceScaleFactor: 1 },
  });
  const page = await ctx.newPage();

  let savedCount = 0;
  page.on('response', async (response) => {
    try {
      const status = response.status();
      if (status < 200 || status >= 400) return;

      const respUrl = new URL(response.url());
      if (!['http:', 'https:'].includes(respUrl.protocol)) return;

      const ct = (response.headers()['content-type'] || '').toLowerCase();
      const keepByCt = KEEP_CT.test(ct);
      const keepByExt = KEEP_EXT.test(respUrl.pathname);
      if (!keepByCt && !keepByExt) return;

      let rel = decodeURIComponent(respUrl.pathname).replace(/^\/+/, '');
      if (!rel || rel.endsWith('/')) rel = (rel || '') + 'index.html';

      let target;
      try { target = safeJoin(outDir, rel); }
      catch { return; }

      fs.mkdirSync(path.dirname(target), { recursive: true });
      const body = await response.body();
      fs.writeFileSync(target, body);
      savedCount++;
    } catch (_) {
      // Best-effort: skip individual response failures (data URLs, opaque, etc).
    }
  });

  page.on('pageerror', (err) => {
    process.stderr.write('[pageerror] ' + (err && err.message ? err.message : String(err)) + '\n');
  });

  await page.goto(url, { timeout, waitUntil: 'networkidle' });

  // Save the final rendered DOM as the entry HTML at the bundle root.
  const baseUrl = new URL(url);
  let entryName = path.basename(baseUrl.pathname).replace(/[?#].*$/, '');
  if (!entryName || !/\.html?$/i.test(entryName)) entryName = 'index.html';
  const entryTarget = path.join(outDir, entryName);
  fs.mkdirSync(path.dirname(entryTarget), { recursive: true });
  const finalHtml = await page.content();
  fs.writeFileSync(entryTarget, finalHtml);
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    fs.copyFileSync(entryTarget, path.join(outDir, 'index.html'));
  }

  // Honor ?open_file=… by also placing a copy at that name.
  const openFile = baseUrl.searchParams.get('open_file');
  if (openFile) {
    const cleanOpen = openFile.replace(/^\/+/, '').replace(/[?#].*$/, '');
    if (cleanOpen && cleanOpen !== entryName) {
      try {
        const openTarget = safeJoin(outDir, cleanOpen);
        fs.mkdirSync(path.dirname(openTarget), { recursive: true });
        if (!fs.existsSync(openTarget)) fs.copyFileSync(entryTarget, openTarget);
      } catch (_) { /* ignore */ }
    }
  }

  await browser.close();

  process.stdout.write(JSON.stringify({
    ok: true,
    out_dir: outDir,
    files: savedCount + 1,
    entry: path.relative(outDir, entryTarget),
  }) + '\n');
}

main().catch((err) => {
  process.stderr.write((err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
