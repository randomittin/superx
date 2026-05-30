#!/usr/bin/env node
/*
 * visual-diff.js
 *
 * Dual-metric visual diff between a canonical render and a native screenshot.
 *
 * Why two metrics?
 *  - pixelmatch gives per-pixel difference count (sensitive to anti-aliasing,
 *    text shifts, color noise). Great for "did anything move?" signal.
 *  - SSIM (structural similarity) is perception-aware: it tolerates uniform
 *    lighting / minor anti-aliasing changes and penalizes structural breaks.
 *    Great for "does this LOOK the same?" signal.
 *  Either metric clearing its bar (SSIM >= 0.95 OR pixelDiffPct <= 5) is
 *  treated as a pass: a screen with heavy anti-aliased text can fail pixel
 *  but pass SSIM, and a small but structurally-broken region can pass pixel
 *  but fail SSIM. Union of the two avoids false negatives.
 *
 * If canonical and native dimensions disagree, the smaller image is upscaled
 * with sharp (lanczos3) to the larger dimensions so pixelmatch + ssim have a
 * common grid. This is recorded in metrics.json under "resized".
 *
 * Required npm deps:
 *   npm i pixelmatch pngjs ssim.js sharp
 *
 * CLI:
 *   node visual-diff.js --canonical <canonical.png> --native <native.png> \
 *                       --out-dir <dir> [--threshold 0.1]
 *
 * Outputs in <out-dir>:
 *   diff.png      pixelmatch diff visualization
 *   composite.png 3-up: canonical | native | diff with 2px black separators
 *   metrics.json  ssim, pixelDiffCount, pixelDiffPct, dims, timestamps
 *
 * Exit:
 *   0 if SSIM >= 0.95 OR pixelDiffPct <= 5
 *   1 otherwise (or on error)
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
    'Usage: node visual-diff.js --canonical <canonical.png> --native <native.png> ' +
    '--out-dir <dir> [--threshold 0.1]'
  );
}

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

async function loadPngBuffer(filePath, sharp) {
  // Load via sharp -> raw RGBA -> wrap as PNG for pngjs interop later.
  const img = sharp(filePath).ensureAlpha();
  const meta = await img.metadata();
  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    data, // raw RGBA buffer (channels=4 because ensureAlpha)
    origWidth: meta.width,
    origHeight: meta.height,
  };
}

async function resizeRawTo(rawImg, targetW, targetH, sharp) {
  const resized = await sharp(rawImg.data, {
    raw: {
      width: rawImg.width,
      height: rawImg.height,
      channels: rawImg.channels,
    },
  })
    .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: resized.info.width,
    height: resized.info.height,
    channels: resized.info.channels,
    data: resized.data,
  };
}

function rawToPngBuffer(raw, PNG) {
  const png = new PNG({ width: raw.width, height: raw.height });
  raw.data.copy(png.data);
  return PNG.sync.write(png);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.canonical || !args.native || !args['out-dir']) {
    die(usage());
  }
  const canonicalPath = path.resolve(String(args.canonical));
  const nativePath = path.resolve(String(args.native));
  const outDir = path.resolve(String(args['out-dir']));
  const threshold = args.threshold ? Number(args.threshold) : 0.1;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    die(`--threshold must be 0..1 (got ${args.threshold})`);
  }

  if (!fs.existsSync(canonicalPath)) die(`canonical not found: ${canonicalPath}`);
  if (!fs.existsSync(nativePath)) die(`native not found: ${nativePath}`);
  fs.mkdirSync(outDir, { recursive: true });

  let pixelmatch, PNG, ssim, sharp;
  try {
    // pixelmatch v6 is ESM-only; require its CJS dist explicitly when needed.
    const pm = require('pixelmatch');
    pixelmatch = pm.default || pm;
  } catch (e) {
    die('pixelmatch not installed. Run: npm i pixelmatch');
  }
  try {
    PNG = require('pngjs').PNG;
  } catch (e) {
    die('pngjs not installed. Run: npm i pngjs');
  }
  try {
    const s = require('ssim.js');
    ssim = s.ssim || s.default || s;
  } catch (e) {
    die('ssim.js not installed. Run: npm i ssim.js');
  }
  try {
    sharp = require('sharp');
  } catch (e) {
    die('sharp not installed. Run: npm i sharp');
  }

  let canonical = await loadPngBuffer(canonicalPath, sharp);
  let nativeImg = await loadPngBuffer(nativePath, sharp);

  let resizedNote = null;
  if (
    canonical.width !== nativeImg.width ||
    canonical.height !== nativeImg.height
  ) {
    const targetW = Math.max(canonical.width, nativeImg.width);
    const targetH = Math.max(canonical.height, nativeImg.height);
    if (canonical.width < targetW || canonical.height < targetH) {
      canonical = await resizeRawTo(canonical, targetW, targetH, sharp);
      resizedNote = { canonical: { to: [targetW, targetH] } };
    }
    if (nativeImg.width < targetW || nativeImg.height < targetH) {
      nativeImg = await resizeRawTo(nativeImg, targetW, targetH, sharp);
      resizedNote = Object.assign(resizedNote || {}, {
        native: { to: [targetW, targetH] },
      });
    }
    // After upscaling, one of them might still mismatch if both were smaller
    // on different axes; resize both to common (rare edge case).
    if (canonical.width !== targetW || canonical.height !== targetH) {
      canonical = await resizeRawTo(canonical, targetW, targetH, sharp);
    }
    if (nativeImg.width !== targetW || nativeImg.height !== targetH) {
      nativeImg = await resizeRawTo(nativeImg, targetW, targetH, sharp);
    }
  }

  const W = canonical.width;
  const H = canonical.height;
  const totalPixels = W * H;

  // pixelmatch needs Uint8Array views of RGBA buffers.
  const diffRaw = Buffer.alloc(W * H * 4);
  const pixelDiffCount = pixelmatch(
    canonical.data,
    nativeImg.data,
    diffRaw,
    W,
    H,
    { threshold, includeAA: false }
  );
  const pixelDiffPct = (pixelDiffCount / totalPixels) * 100;

  // SSIM via ssim.js expects ImageData-like {data, width, height} with RGBA.
  const ssimResult = ssim(
    { data: canonical.data, width: W, height: H },
    { data: nativeImg.data, width: W, height: H }
  );
  const ssimMean = ssimResult && typeof ssimResult.mssim === 'number'
    ? ssimResult.mssim
    : (ssimResult && typeof ssimResult.ssim === 'number' ? ssimResult.ssim : NaN);
  if (!Number.isFinite(ssimMean)) {
    die('SSIM computation failed (no mssim/ssim in result)');
  }

  // Write diff.png
  const diffPngPath = path.join(outDir, 'diff.png');
  fs.writeFileSync(
    diffPngPath,
    rawToPngBuffer({ width: W, height: H, data: diffRaw }, PNG)
  );

  // Composite: canonical | native | diff with 2px black separators.
  const SEP = 2;
  const compW = W * 3 + SEP * 2;
  const compH = H;
  const composite = await sharp({
    create: {
      width: compW,
      height: compH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: canonical.data,
        raw: { width: W, height: H, channels: 4 },
        left: 0,
        top: 0,
      },
      {
        input: nativeImg.data,
        raw: { width: W, height: H, channels: 4 },
        left: W + SEP,
        top: 0,
      },
      {
        input: diffRaw,
        raw: { width: W, height: H, channels: 4 },
        left: W * 2 + SEP * 2,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const compositePath = path.join(outDir, 'composite.png');
  fs.writeFileSync(compositePath, composite);

  const metrics = {
    ssim: Number(ssimMean.toFixed(6)),
    pixelDiffCount,
    totalPixels,
    pixelDiffPct: Number(pixelDiffPct.toFixed(4)),
    width: W,
    height: H,
    threshold,
    canonical: path.basename(canonicalPath),
    native: path.basename(nativePath),
    timestamp: new Date().toISOString(),
    resized: resizedNote,
    pass: ssimMean >= 0.95 || pixelDiffPct <= 5,
  };
  const metricsPath = path.join(outDir, 'metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

  const summary = `SSIM ${ssimMean.toFixed(3)} | diff ${pixelDiffPct.toFixed(
    1
  )}% | composite: ${compositePath}`;
  process.stdout.write(summary + '\n');

  process.exit(metrics.pass ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`error: ${e && e.stack ? e.stack : e}\n`);
  process.exit(1);
});
