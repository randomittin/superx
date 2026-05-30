# designmatch — shared spec (read first)

This is the canonical contract for the `designmatch` skill. All agents producing files for `skills/designmatch/` must align with this spec.

## Purpose

Match a Claude Design HTML canonical to a React Native app at ≥95% visual parity on real Android/iOS hardware. Closes the loop with: VQA stub mode + Playwright renderer + pixelmatch+SSIM diff harness.

## Origin

appco case study, Waves 15.0–15.32. SSIM 35%→55% on Send screen + matching structural fidelity, state-aware Playwright baseline rendering, dual-metric scoring, orientation lock. ~30 commits.

## Inputs

- **Canonical**: `<App>.html` bundle loading `screen-*.jsx` via in-browser Babel, rendered at **1080×2444**.
- **Native**: PNG screenshots from real device at native resolution.
- **App**: existing RN codebase with redux, navigation, KYC/auth state, design tokens, primitives.

## Skill structure (target files)

```
skills/designmatch/
├── SKILL.md
├── scripts/
│   ├── render-canonical.js      # Playwright renderer
│   ├── visual-diff.js           # pixelmatch + ssim.js + composite
│   └── iterate-screen.sh        # per-screen loop
├── assets/
│   └── visual-qa.ts             # RN VQA stub helper (drop-in)
└── references/
    ├── anti-patterns.md         # 8-item checklist
    └── canonical-values.md      # typography + spacing cheat-sheet
```

## VQA stub mode (assets/visual-qa.ts)

- Trigger: **5× long-press AppLogo within 4s** → flips AsyncStorage `wn_visual_qa` + `RNRestart.restart()`.
- Boot: `primeVisualQaFlag()` async-reads AsyncStorage → `applyVisualQaState(dispatch)` seeds:
  - **user**: `{ kycStatus: 'verified', phone_verified: true, iso: 'GBR', name: 'Visual QA' }`
  - **recipient**: 1 saved `{ id: 'vqa-r1', name: 'Test Recipient', country: 'IND', phone: '+919999900000' }` + `setSelectedRecipient('vqa-r1')`
  - **bonus**: `{ balance: 1000, ledger: [], applyCapPct: 50 }`
  - **transfer**: `{ sendingCountry: 'GBR', receivingCountry: 'IND' }`
- `overrideFeatureFlags(isFeatureEnabled)` → force-enables flag-gated UI when VQA on.
- **Red "VQA" pill badge** top-right (safe-area inset) so the mode is visible.
- Required peer deps (consumer): `react`, `react-native`, `@react-native-async-storage/async-storage`.
- Optional injected dep: `react-native-restart` (passed to `toggleVqaAndRestart`).

## Renderer (scripts/render-canonical.js)

- Node + Playwright (chromium), viewport `{ width: 1080, height: 2444, deviceScaleFactor: 1 }`.
- Inject `window.__VQA_STATE__` via `page.addInitScript()` BEFORE bundle eval so redux seeds from it.
- Optional `window.__VQA_SCREEN__` for screen routing.
- Serve bundle dir via local HTTP (pure node `http` + `fs`) — avoid extra deps.
- Wait strategy: `--wait <ms>` → timeout; `--wait <selector>` → waitForSelector; default → `window.__APP_READY__` truthy.
- Full-page screenshot at 1080×2444 → `--out canonical.png`.
- CLI: `node render-canonical.js --html <App.html> --state <state.json> --out <canonical.png> [--screen <Name>] [--wait <ms|selector>]`.
- Exit 0 + `{"ok":true,...}` on stdout; nonzero + error JSON on failure.

## Diff harness (scripts/visual-diff.js)

- Dual metric: **pixelmatch** (perceptual pixel diff) + **ssim.js** (structural similarity). Reason: pixel diff catches color/position drift, SSIM catches structural matches even when minor pixel differences accumulate.
- Resize-to-match (sharp) if PNG sizes differ; document in top-of-file comment.
- Outputs:
  - `diff.png` — pixelmatch overlay
  - `composite.png` — 3-up horizontal: canonical | native | diff, 2px black separators
  - `metrics.json` — `{ ssim, pixelDiffCount, totalPixels, pixelDiffPct, width, height, canonical, native, timestamp }`
- Stdout summary, terse: `SSIM 0.823 | diff 4.2% | composite: <path>`.
- Pass: **SSIM ≥ 0.95 OR pixelDiffPct ≤ 5** → exit 0; else exit 1.
- CLI: `node visual-diff.js --canonical <c.png> --native <n.png> --out-dir <dir> [--threshold 0.1]`.

## Iteration loop (scripts/iterate-screen.sh)

- Usage: `iterate-screen.sh <ScreenName> [--platform android|ios] [--device <id>] [--bundle <App.html>] [--state <state.json>] [--out <dir>]`.
- Defaults: `OUT_DIR=./.designmatch/<ScreenName>`, `BUNDLE_HTML`/`VQA_STATE` from env.
- Steps:
  1. `mkdir -p $OUT_DIR`
  2. render canonical → `$OUT_DIR/canonical.png`
  3. capture native:
     - android: `adb -s <id> exec-out screencap -p > $OUT_DIR/native.png` (exec-out avoids CRLF mangling)
     - ios sim: `xcrun simctl io <id> screenshot $OUT_DIR/native.png`
     - ios real device: fall back to `idevicescreenshot $OUT_DIR/native.png` if on PATH
  4. diff via `visual-diff.js`; capture exit code as PASS/FAIL
  5. `open` (mac) / `xdg-open` (linux) the composite
  6. print metrics + pass/fail + next-step hint
- `set -euo pipefail`. Validate `node`, `adb`/`xcrun` per platform. Clear error messages.

## Canonical values (references/canonical-values.md)

- **Bricolage display weights**: 600, 700, 800
- **GSF body weights**: 400, 500, 600
- **Common spacings (px)**: 4, 8, 12, 16, 22, 24
- **Canonical viewport**: 1080×2444 (lock orientation)
- **Naming convention**: prefer family-name bolds (e.g. `Bricolage-Bold`) over `fontWeight` strings on Android to avoid synthesized weight that drifts from canonical.

## Patterns to enforce (SKILL.md must list)

- **Typography Platform gate**: `Platform.OS === 'android' ? {} : { fontWeight: 'N' }` — keeps Android on the family-name bold (e.g. `Bricolage-Bold`) instead of synthesized weight.
- **`normalize()` always-on** wrapper for px values (width-relative RN scaler, base 414).
- Default Typography variant resolves to body family → **headings MUST specify display variant**.
- **Single safe-area**: Screen wrapper OR inner container, never both.
- **Header choice**: native stack header OR in-screen PushHeader, never both.
- **Custom `tabBarStyle`** when expand-to-label animation is needed.

## Anti-patterns (8 items — references/anti-patterns.md must reproduce verbatim with ❌/✅ examples and one-line reason for each)

1. literal px instead of `normalize()`
2. `fontWeight: '800'` without Platform gate when family is named-bold
3. default Typography variant on headings (resolves to body family)
4. double safe-area padding (Screen wrapper + inner container both apply insets)
5. native stack header + in-screen PushHeader
6. standard `tabBarStyle` when expand-to-label animation needed
7. literal pixel values inlined instead of design-token references
8. divergent agent outputs without shared contract (each picking own conventions)

## Agent dispatch guidance (mention in SKILL.md)

- One agent per file or per logical concern (avoid file-overlap conflicts).
- Each agent commits independently (`--no-verify` if hooks broken in worktree).
- Avoid worktree isolation when agents need full `node_modules` + live device.
- Explicitly send each agent the `Platform.OS` pattern — don't assume inference from canonical jsx.
- Explicitly tell each agent to use `normalize()` wrapping — they otherwise inline literal px and bloat the diff.

## Scoring & success criteria

- Report SSIM (0–1) and pixel-diff % per screen.
- Target: **SSIM ≥ 0.95 OR pixel-diff ≤ 5%**.
- appco baseline: Send screen SSIM 35% → 55% over Waves 15.0–15.32.

## Closed-loop architecture (ASCII)

```
canonical HTML ──Playwright──► canonical.png ─┐
                                              ├──diff──► metrics.json + composite.png ──► iterate
device (adb/xcrun) ──capture──► native.png ───┘
```
