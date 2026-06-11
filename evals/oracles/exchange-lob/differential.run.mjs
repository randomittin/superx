#!/usr/bin/env node
// Exchange LOB — C2 LIVE differential arm (seeded variable-latency interleave).
//
// This is the runnable live arm the registry gate_command drives. It implements
// the harness specified by interleave.md + differential.md and proven necessary
// by SPIKE-FINDINGS.md (Arm 2): a seeded, per-id, variable-latency async hook
// awaited BEFORE the read-match-mutate critical section, swept over N seeds, with
// the WHOLE concurrent fill sequence diffed against a submission-order serial
// replay through the independent reference matcher (reference/matcher.mjs).
//
//   concurrent arm  — Promise.all(orders.map(o => engine.submit(o, hook(seed))))
//                     through the SUBJECT engine (--engine). Every await races.
//   reference arm   — reference/matcher.mjs run(orders) in submission order, no
//                     concurrency, no latency. THE canonical correct serialization.
//   diff            — element-by-element tuple compare (takerId,makerId,price,qty)
//                     PLUS sequence length. FIRST divergence wins (interleave.md).
//
// Exit: 0 = all seeds green (concurrent == serial replay for every seed);
//       1 = a divergence was found (prints seed + first-divergence index +
//           expected/actual + both sequences, then stops at that seed);
//       2 = usage / IO error.
//
// Usage:
//   differential.run.mjs --engine <path> [--seeds N] [--orders <stream.json>]
//                        [--submits M] [--start S] [--json]
//   differential.run.mjs --help
//
//   --engine   REQUIRED. Path to a subject engine module exporting
//              createEngine() -> { trades, submit(order, latencyHook) }.
//   --seeds    Number of seeds to sweep (default 200; the spike-hardened floor).
//   --orders   Order-stream JSON: a bare array, or {orders:[...]}. Default: the
//              shrunk 7-order C2 repro from SPIKE-FINDINGS.md (interleave-fixtures).
//   --submits  Cap the stream to the first M orders (default: all). interleave.md
//              floors the concurrent batch at >=50; the default repro is the
//              7-order shrink the spike pinned the race to.
//   --start    First seed (default 1). The spike's racy engine failed @ seed 1.
//   --json     On divergence, also emit a structured JSON divergence object on the
//              LAST line of stdout (for capture into corpus expected.json).

import { run as referenceRun } from './reference/matcher.mjs';

// ── The shrunk 7-order C2 repro (SPIKE-FINDINGS.md). The default order stream. ──
// Order 7 (last of three same-side buyers) jumped the queue under the race.
const DEFAULT_ORDERS = [
  { kind: 'limit', id: 1, account: 'A', side: 'sell', price: 105, qty: 10 },
  { kind: 'limit', id: 2, account: 'D', side: 'sell', price: 99, qty: 10 },
  { kind: 'limit', id: 3, account: 'C', side: 'buy', price: 99, qty: 3 },
  { kind: 'market', id: 4, account: 'C', side: 'buy', qty: 4 },
  { kind: 'limit', id: 5, account: 'B', side: 'buy', price: 95, qty: 5 },
  { kind: 'limit', id: 6, account: 'D', side: 'buy', price: 97, qty: 7 },
  { kind: 'limit', id: 7, account: 'D', side: 'buy', price: 102, qty: 5 },
];

const USAGE = `differential.run.mjs — exchange-lob C2 live differential arm

Usage:
  differential.run.mjs --engine <path> [--seeds N] [--orders <stream.json>]
                       [--submits M] [--start S] [--json]
  differential.run.mjs --help

  --engine   REQUIRED. Subject engine module exporting
             createEngine() -> { trades, submit(order, latencyHook) }.
  --seeds    Seeds to sweep (default 200).
  --orders   Order-stream JSON (array or {orders:[...]}). Default: shrunk 7-order
             C2 repro from SPIKE-FINDINGS.md.
  --submits  Cap stream to first M orders (default: all).
  --start    First seed (default 1).
  --json     Emit a structured divergence object as the last stdout line on diff.

Exit: 0 all seeds green, 1 divergence found, 2 usage/IO error.`;

// ── Seeded per-id variable-latency hook (interleave.md). PURE fn of (seed,id). ──
// A small splitmix64-style integer hash of (seed, id) -> a delay in [0, span) ms.
// Deterministic (no Math.random, no Date.now), per-id variable (id is mixed in so
// different ids under the same seed get DIFFERENT delays -> arrival genuinely
// permutes), and seed-scrambled (different seeds reassign delays). A uniform delay
// would collapse to submission order (false-green) — this does not.
function seededDelay(seed, id, span = 12) {
  // Mix seed and id into one 64-bit-ish state, then avalanche it.
  let x = BigInt.asUintN(64, BigInt(seed) * 0x9e3779b97f4a7c15n + BigInt(id) * 0xff51afd7ed558ccdn + 1n);
  x ^= x >> 30n;
  x = BigInt.asUintN(64, x * 0xbf58476d1ce4e5b9n);
  x ^= x >> 27n;
  x = BigInt.asUintN(64, x * 0x94d049bb133111ebn);
  x ^= x >> 31n;
  return Number(x % BigInt(span));
}

function makeLatencyHook(seed) {
  return (order) =>
    new Promise((resolve) => {
      const ms = seededDelay(seed, order.id);
      if (ms === 0) {
        // Still yield a microtask so a 0-delay submission cannot bypass the await.
        setImmediate(resolve);
      } else {
        setTimeout(resolve, ms);
      }
    });
}

// ── Trade tuple canonicalization for the whole-output diff. ──
function tuple(t) {
  if (!t) return null;
  return `${t.takerId}/${t.makerId}@${t.price}x${t.qty}`;
}

// ── The concurrent arm: dispatch all submissions through the subject engine with
// the seeded latency hook, racing through Promise.all. Returns the engine's trade
// sequence in execution order. ──
async function concurrentArm(createEngine, orders, seed) {
  const engine = createEngine();
  const hook = makeLatencyHook(seed);
  await Promise.all(orders.map((o) => engine.submit(o, hook)));
  return engine.trades;
}

// ── Whole-output first-divergence diff (differential.md / interleave.md). ──
// Compares the concurrent fill sequence against the serial-replay reference
// element-by-element AND on length. Returns null when identical, else the FIRST
// divergence { index, expected, actual, kind }.
function firstDivergence(reference, actual) {
  const max = Math.max(reference.length, actual.length);
  for (let i = 0; i < max; i++) {
    const e = tuple(reference[i]);
    const a = tuple(actual[i]);
    if (e !== a) {
      return {
        index: i,
        expected: reference[i] ?? null,
        actual: actual[i] ?? null,
        expected_tuple: e,
        actual_tuple: a,
        kind: 'tuple',
        reference_len: reference.length,
        actual_len: actual.length,
      };
    }
  }
  if (reference.length !== actual.length) {
    return {
      index: max,
      expected: null,
      actual: null,
      expected_tuple: `length ${reference.length}`,
      actual_tuple: `length ${actual.length}`,
      kind: 'length',
      reference_len: reference.length,
      actual_len: actual.length,
    };
  }
  return null;
}

function fmtSeq(trades) {
  return '[' + trades.map(tuple).join(', ') + `]   (${trades.length} trades)`;
}

async function loadEngine(enginePath) {
  // Resolve relative paths against CWD to an absolute file URL so dynamic import
  // works regardless of where the runner is launched from (gate.sh cd's into the
  // oracle dir; callers may pass ./fixtures/... or an absolute path).
  const path = await import('node:path');
  const url = await import('node:url');
  const abs = path.isAbsolute(enginePath) ? enginePath : path.resolve(process.cwd(), enginePath);
  const mod = await import(url.pathToFileURL(abs).href);
  const factory = mod.createEngine || mod.default;
  if (typeof factory !== 'function') {
    throw new Error(
      `engine module ${enginePath} must export createEngine() (or default) returning { trades, submit(order, latencyHook) }`
    );
  }
  return factory;
}

async function readOrders(ordersPath) {
  const fs = await import('node:fs');
  const raw = fs.readFileSync(ordersPath, 'utf8');
  const parsed = JSON.parse(raw);
  const orders = Array.isArray(parsed) ? parsed : parsed.orders;
  if (!Array.isArray(orders)) {
    throw new Error(`--orders ${ordersPath} must be a JSON array, or {orders:[...]}`);
  }
  return orders;
}

function parseArgs(argv) {
  const args = { engine: '', seeds: 200, orders: '', submits: 0, start: 1, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--engine':
        args.engine = argv[++i];
        break;
      case '--seeds':
        args.seeds = Number(argv[++i]);
        break;
      case '--orders':
        args.orders = argv[++i];
        break;
      case '--submits':
        args.submits = Number(argv[++i]);
        break;
      case '--start':
        args.start = Number(argv[++i]);
        break;
      case '--json':
        args.json = true;
        break;
      // gate.sh historically passed --seed/--submits per-seed; accept --seed as an
      // alias for a single-seed sweep so older drivers don't exit 2.
      case '--seed':
        args.start = Number(argv[++i]);
        args.seeds = 1;
        break;
      default:
        throw new Error(`unknown flag: ${a}`);
    }
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(String(err.message || err) + '\n\n' + USAGE + '\n');
    process.exit(2);
  }

  if (args.help) {
    process.stdout.write(USAGE + '\n');
    process.exit(0);
  }

  if (!args.engine) {
    process.stderr.write('error: --engine <path> is required\n\n' + USAGE + '\n');
    process.exit(2);
  }
  if (!Number.isInteger(args.seeds) || args.seeds < 1) {
    process.stderr.write('error: --seeds must be a positive integer\n');
    process.exit(2);
  }

  let createEngine;
  let orders;
  try {
    createEngine = await loadEngine(args.engine);
    orders = args.orders ? await readOrders(args.orders) : DEFAULT_ORDERS;
  } catch (err) {
    process.stderr.write('error: ' + String(err.message || err) + '\n');
    process.exit(2);
  }

  if (args.submits && args.submits > 0) orders = orders.slice(0, args.submits);
  if (orders.length < 1) {
    process.stderr.write('error: order stream is empty — ungradable\n');
    process.exit(2);
  }

  // Reference arm is seed-independent (serial replay of submission order). Compute
  // once, reuse across the sweep. C2 fixes the canonical serial order = submission.
  const reference = referenceRun(orders).trades;

  const seedEnd = args.start + args.seeds - 1;
  process.stdout.write(
    `exchange-lob C2 live differential: engine=${args.engine} seeds ${args.start}..${seedEnd} (${args.seeds}) x ${orders.length} concurrent submits\n`
  );

  for (let seed = args.start; seed <= seedEnd; seed++) {
    const actual = await concurrentArm(createEngine, orders, seed);
    const div = firstDivergence(reference, actual);
    if (div) {
      process.stdout.write('\n');
      process.stdout.write(`C2 DIVERGENCE @ seed ${seed}\n`);
      if (div.kind === 'length') {
        process.stdout.write(
          `  first-divergence: trade sequence length (reference ${div.reference_len} vs actual ${div.actual_len})\n`
        );
      } else {
        process.stdout.write(`  first-divergence index: ${div.index}\n`);
      }
      process.stdout.write(`  expected (serial replay, CORRECT): ${div.expected_tuple}\n`);
      process.stdout.write(`  actual   (concurrent engine):      ${div.actual_tuple}\n`);
      process.stdout.write(`  concurrent: ${fmtSeq(actual)}\n`);
      process.stdout.write(`  reference:  ${fmtSeq(reference)}\n`);
      if (args.json) {
        process.stdout.write(
          JSON.stringify({
            seed,
            index: div.index,
            kind: div.kind,
            expected: div.expected,
            actual: div.actual,
            expected_tuple: div.expected_tuple,
            actual_tuple: div.actual_tuple,
            reference_len: div.reference_len,
            actual_len: div.actual_len,
          }) + '\n'
        );
      }
      process.exit(1);
    }
  }

  process.stdout.write(
    `\nC2 PASS: ${args.seeds}/${args.seeds} seeds — concurrent whole-output == submission-order serial replay for every seed\n`
  );
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
