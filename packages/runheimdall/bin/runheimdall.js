#!/usr/bin/env node
'use strict';

/*
 * runheimdall — thin npx wrapper for the Heimdall installer.
 *
 * Fetches the install.sh pinned to this package's release tag, asserts its
 * sha256 against the checksum baked in at publish time, then execs it with
 * bash. The fetched bytes are guaranteed byte-identical to what
 * `curl -fsSL https://runheimdall.dev/install | bash` runs — same pinned tag,
 * same checksum, no surprises.
 *
 * Trust model: we never run a single byte we did not first verify. The script
 * is buffered fully, hashed, compared, and only then handed to bash. A
 * mismatch (tampered CDN, wrong tag, truncated download) aborts before exec.
 *
 * Offline-testable: set RUNHEIMDALL_INSTALL_SCRIPT to a local file path to use
 * its bytes instead of fetching over the network. The sha256 assertion runs
 * identically against the local bytes — point it at a file + a matching
 * checksum to prove the exec path, or a mismatching one to prove the abort.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const pkg = require(path.join(__dirname, '..', 'package.json'));
const meta = pkg.heimdall || {};

const TAG = process.env.RUNHEIMDALL_TAG || meta.tag;
const URL = process.env.RUNHEIMDALL_INSTALL_URL || meta.installScriptUrl;
const EXPECTED_SHA = (process.env.RUNHEIMDALL_SHA256 || meta.sha256 || '').toLowerCase();
const LOCAL_OVERRIDE = process.env.RUNHEIMDALL_INSTALL_SCRIPT;

function die(msg) {
  process.stderr.write('runheimdall: ' + msg + '\n');
  process.exit(1);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Read the install script bytes, either from a local override (offline tests)
// or by fetching the pinned-tag URL over HTTPS. Returns a Buffer.
function loadScript() {
  if (LOCAL_OVERRIDE) {
    if (!fs.existsSync(LOCAL_OVERRIDE)) {
      die('RUNHEIMDALL_INSTALL_SCRIPT points at a missing file: ' + LOCAL_OVERRIDE);
    }
    return Promise.resolve(fs.readFileSync(LOCAL_OVERRIDE));
  }
  if (!URL) {
    die('no install script URL configured (package.json heimdall.installScriptUrl is empty)');
  }
  return fetchHttps(URL);
}

function fetchHttps(url, redirects) {
  redirects = redirects || 0;
  if (redirects > 5) {
    return Promise.reject(new Error('too many redirects fetching ' + url));
  }
  const https = require('https');
  return new Promise(function (resolve, reject) {
    const req = https.get(url, { headers: { 'User-Agent': 'runheimdall/' + pkg.version } }, function (res) {
      const status = res.statusCode || 0;
      // Follow the 302 (runheimdall.dev/install) and any GitHub raw redirects.
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        resolve(fetchHttps(next, redirects + 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error('HTTP ' + status + ' fetching ' + url));
        return;
      }
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, function () {
      req.destroy(new Error('timed out fetching ' + url));
    });
  });
}

// Hand the verified script to bash. Buffer goes to a temp file (bash needs a
// path for $0 to be meaningful and for argv to pass through cleanly), then we
// exec and propagate the exit code. The temp file is removed afterward.
function runScript(buf) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'runheimdall-'));
  const scriptPath = path.join(tmpDir, 'install.sh');
  fs.writeFileSync(scriptPath, buf, { mode: 0o700 });
  try {
    const forwarded = process.argv.slice(2);
    const result = spawnSync('bash', [scriptPath].concat(forwarded), {
      stdio: 'inherit',
      env: process.env,
    });
    if (result.error) {
      die('failed to run installer: ' + result.error.message);
    }
    if (typeof result.status === 'number') {
      process.exitCode = result.status;
    } else if (result.signal) {
      die('installer terminated by signal ' + result.signal);
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* best effort cleanup */ }
  }
}

function main() {
  if (!EXPECTED_SHA || EXPECTED_SHA === 'replace_at_publish') {
    die('no published checksum baked in — this wrapper was not built by release/sync-release.sh. Refusing to run an unverified script.');
  }
  if (!/^[0-9a-f]{64}$/.test(EXPECTED_SHA)) {
    die('configured sha256 is not a 64-char hex digest: ' + EXPECTED_SHA);
  }

  loadScript()
    .then(function (buf) {
      const actual = sha256(buf);
      if (actual !== EXPECTED_SHA) {
        die(
          'checksum mismatch — refusing to run.\n' +
          '  tag:      ' + (TAG || '(unknown)') + '\n' +
          '  source:   ' + (LOCAL_OVERRIDE || URL) + '\n' +
          '  expected: ' + EXPECTED_SHA + '\n' +
          '  actual:   ' + actual
        );
      }
      process.stderr.write('runheimdall: verified install.sh (' + (TAG || 'pinned') + ', sha256 ' + actual.slice(0, 12) + '…) — running.\n');
      runScript(buf);
    })
    .catch(function (err) {
      die(err && err.message ? err.message : String(err));
    });
}

main();
