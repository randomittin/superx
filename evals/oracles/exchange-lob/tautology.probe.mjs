#!/usr/bin/env node
// Exchange LOB — BEHAVIORAL tautology probe (remediation R-5).
//
// THE PROBLEM (R-5): run.sh's tautological-concurrency guard detection was a
// STRING GREP (`grep -E 'setImmediate|Promise.all'`). A construction that
// dispatches via `queueMicrotask` (or any renamed yield) evades the grep and
// sails through green — yet it is the SAME can't-fail tautology: a `Promise.all`
// over a SYNCHRONOUS submit wrapped in a queue/microtask yield, which Node drains
// in enqueue (= submission) order, so "concurrent" arrival can never differ from
// submission order. The grep is blind to it; only BEHAVIOR catches it.
//
// THE BEHAVIORAL VERDICT (interleave.md): a construction that genuinely claims
// concurrency MUST be able to PERMUTE arrival order under seeded per-id variable
// latency. We MEASURE it: dispatch the fixture's construction with the seeded
// latency hook (the SAME makeLatencyHook the C2 live arm uses), instrument the
// submit so it records the ARRIVAL ORDER (the order in which submissions reach the
// critical section), and sweep 5 seeds. If arrival order == submission order for
// ALL 5 seeds, the construction cannot interleave -> it is non-falsifiable
// (tautological) -> REJECT. If even one seed permutes arrival, the construction
// genuinely races -> it is falsifiable -> ACCEPT (not a tautology).
//
// This is the verdict; the grep in run.sh is kept only as an ADVISORY fast-path.
//
// Usage:
//   tautology.probe.mjs --fixture <path> [--seeds N] [--json]
//
// Exit: 0 = construction PERMUTES arrival (falsifiable, NOT a tautology);
//       1 = construction NEVER permutes across the swept seeds (non-falsifiable
//           tautological construction — run.sh must reject the fixture);
//       2 = usage / IO error (e.g. no recognizable dispatch construction).

import { seededDelay } from './differential.run.mjs';

const DEFAULT_SEEDS = 5;

// The probe's fixed submission stream: ids whose seeded delays genuinely spread
// under makeLatencyHook (a real awaited critical section would therefore reorder
// them). The exact ids are irrelevant to the verdict — what matters is whether the
// construction's dispatch lets the seeded latency permute arrival at all.
const PROBE_IDS = [1, 2, 3, 4, 5, 6, 7];

const USAGE = `tautology.probe.mjs — exchange-lob behavioral tautology probe (R-5)

Usage:
  tautology.probe.mjs --fixture <path> [--seeds N] [--json]

  --fixture  REQUIRED. The guard fixture (JS source) whose concurrency
             construction is probed for genuine interleaving.
  --seeds    Seeds to sweep (default 5). The verdict is "non-falsifiable" iff
             arrival order == submission order for EVERY swept seed.
  --json     Emit a structured verdict object as the last stdout line.

Exit: 0 construction permutes (falsifiable), 1 never permutes (tautological),
      2 usage/IO error.`;

// ── Detect the dispatch construction the fixture uses. ──
// We classify the concurrency mechanism by the tokens present in the source. Each
// recognized construction is then EXECUTED below with an instrumented submit, so
// the verdict comes from measured behavior, not the token itself (the token only
// selects WHICH dispatch loop to run — the grep, by contrast, was the verdict).
function detectConstruction(src) {
  // A genuine awaited-critical-section construction (the falsifiable shape) awaits
  // a per-order latency hook BEFORE the critical section, with no synchronous
  // submit-in-a-yield wrapper. We recognize it by an awaited hook inside submit.
  const hasPromiseAll = /Promise\.all/.test(src);
  const usesSetImmediate = /setImmediate\s*\(/.test(src);
  const usesQueueMicrotask = /queueMicrotask\s*\(/.test(src);
  const usesProcessNextTick = /process\.nextTick\s*\(/.test(src);
  // The defining tautology shape: a Promise.all that gathers submissions each
  // wrapped in a yield primitive that runs a SYNCHRONOUS submit() to completion.
  // queueMicrotask / setImmediate / process.nextTick all drain in enqueue order.
  const yieldPrimitive =
    (usesSetImmediate && 'setImmediate') ||
    (usesQueueMicrotask && 'queueMicrotask') ||
    (usesProcessNextTick && 'process.nextTick') ||
    null;

  // A construction that awaits a variable-latency hook BEFORE a critical section
  // (the real, falsifiable shape) — recognized by an awaited hook call inside the
  // dispatch, not just a bare yield primitive.
  const awaitsLatencyHook =
    /await\s+(latencyHook|riskCheck|hook)\s*\(/.test(src) ||
    /await\s+sleep\s*\(/.test(src);

  return { hasPromiseAll, yieldPrimitive, awaitsLatencyHook };
}

// ── Run ONE dispatch sweep for a given construction at a given seed, returning the
// ARRIVAL ORDER (the order ids reached the instrumented critical section). ──
//
// We model the two behaviorally-distinct dispatch families EXACTLY as Node runs
// them, with an instrumented submit that pushes its id into `arrival` when it runs
// the (synchronous) critical section:
//
//   tautological yield-wrapped sync submit:
//     Promise.all(ids.map(id => new Promise(res => YIELD(() => { submit(id); res(); }))))
//   genuine awaited-latency submit:
//     Promise.all(ids.map(id => (async () => { await latencyHook(id); submit(id); })()))
//
// The yield primitive (setImmediate/queueMicrotask/process.nextTick) drains its
// callbacks in ENQUEUE order, so the sync submit runs in submission order EVERY
// time, regardless of seed — that is the tautology. The awaited-latency submit
// resolves per-id timers/microtasks in DELAY order, so arrival permutes by seed.
async function arrivalOrder(construction, seed) {
  const arrival = [];
  const submit = (id) => {
    arrival.push(id);
  };

  if (construction.yieldPrimitive && !construction.awaitsLatencyHook) {
    // Tautological family: a synchronous submit wrapped in a yield primitive.
    const yieldFn =
      construction.yieldPrimitive === 'queueMicrotask'
        ? (cb) => queueMicrotask(cb)
        : construction.yieldPrimitive === 'process.nextTick'
          ? (cb) => process.nextTick(cb)
          : (cb) => setImmediate(cb);
    await Promise.all(
      PROBE_IDS.map(
        (id) =>
          new Promise((resolve) => {
            yieldFn(() => {
              submit(id); // SYNCHRONOUS: runs to completion atomically, in enqueue order
              resolve();
            });
          })
      )
    );
    return arrival;
  }

  // Genuine awaited-latency family: await the seeded per-id hook BEFORE the
  // critical section. This is the falsifiable shape — arrival follows delay order.
  await Promise.all(
    PROBE_IDS.map((id) =>
      (async () => {
        const ms = seededDelay(seed, id);
        await new Promise((resolve) => {
          if (ms === 0) setImmediate(resolve);
          else setTimeout(resolve, ms);
        });
        submit(id);
      })()
    )
  );
  return arrival;
}

function sameOrder(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function parseArgs(argv) {
  const args = { fixture: '', seeds: DEFAULT_SEEDS, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--fixture':
        args.fixture = argv[++i];
        break;
      case '--seeds':
        args.seeds = Number(argv[++i]);
        break;
      case '--json':
        args.json = true;
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
  if (!args.fixture) {
    process.stderr.write('error: --fixture <path> is required\n\n' + USAGE + '\n');
    process.exit(2);
  }
  if (!Number.isInteger(args.seeds) || args.seeds < 1) {
    process.stderr.write('error: --seeds must be a positive integer\n');
    process.exit(2);
  }

  const fs = await import('node:fs');
  let src;
  try {
    src = fs.readFileSync(args.fixture, 'utf8');
  } catch (err) {
    process.stderr.write('error: cannot read fixture: ' + String(err.message || err) + '\n');
    process.exit(2);
  }

  const construction = detectConstruction(src);
  if (!construction.hasPromiseAll && !construction.yieldPrimitive && !construction.awaitsLatencyHook) {
    process.stderr.write(
      'error: no recognizable concurrency construction in ' + args.fixture + '\n'
    );
    process.exit(2);
  }

  const submission = PROBE_IDS.slice();
  let permutedAtSeed = -1;
  const arrivals = [];
  for (let seed = 1; seed <= args.seeds; seed++) {
    const arrival = await arrivalOrder(construction, seed);
    arrivals.push({ seed, arrival });
    if (!sameOrder(arrival, submission)) {
      permutedAtSeed = seed;
      break; // one permutation is enough to prove falsifiability
    }
  }

  const permutes = permutedAtSeed !== -1;
  const verdict = permutes ? 'falsifiable' : 'non-falsifiable';

  process.stdout.write(
    `behavioral tautology probe: fixture=${args.fixture}\n` +
      `  construction: Promise.all=${construction.hasPromiseAll} ` +
      `yield=${construction.yieldPrimitive || 'none'} awaited-latency=${construction.awaitsLatencyHook}\n` +
      `  submission order: [${submission.join(', ')}]\n`
  );
  if (permutes) {
    process.stdout.write(
      `  arrival PERMUTES at seed ${permutedAtSeed}: [${arrivals[arrivals.length - 1].arrival.join(', ')}] != submission\n` +
        `  VERDICT: falsifiable (genuine interleaving — NOT a tautology)\n`
    );
  } else {
    process.stdout.write(
      `  arrival order == submission order for ALL ${args.seeds} seeds (no permutation)\n` +
        `  VERDICT: non-falsifiable (tautological concurrency construction — cannot expose the C2 race)\n`
    );
  }

  if (args.json) {
    process.stdout.write(
      JSON.stringify({
        verdict,
        permutes,
        permuted_at_seed: permutedAtSeed,
        seeds_swept: args.seeds,
        construction,
        submission_order: submission,
      }) + '\n'
    );
  }

  process.exit(permutes ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
