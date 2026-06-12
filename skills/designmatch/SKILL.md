---
name: designmatch
description: Use when matching a React Native screen to a Claude Design HTML canonical at ≥95% visual parity on real Android/iOS hardware — closes the loop with a VQA stub mode, Playwright canonical renderer at 1080×2444, and a dual-metric pixelmatch + SSIM diff harness producing composite triptychs.
---

# designmatch

## Overview

Match RN screen → HTML canonical at ≥95% visual parity. Closed loop: VQA stub seeds redux → Playwright renders canonical PNG → adb/xcrun captures native PNG → pixelmatch + ssim.js scores diff → composite triptych for eyeball review → iterate.

Origin: a production React Native app. A single screen's SSIM climbed 35% → 55% over ~30 commits of eyeballed pixel-tweaking before this loop replaced it.

Pass gate: **SSIM ≥ 0.95 OR pixelDiffPct ≤ 5%**.

## When to Use

- RN screen drift from Claude Design HTML canonical
- Visual parity audit before ship
- Per-screen iteration loop on real device
- Closing the design ↔ code feedback gap

Do NOT use for: unit logic, redux state shape, navigation graph correctness — those are not visual.

## Quick Start — URL in, ready-to-translate out

From the RN project root:

```bash
designmatch init "<claude-design-url>" --app-dir . --port-all
```

This single command does the full bootstrap:

1. **App side**: copies `assets/visual-qa.ts` into the app (`src/lib/visual-qa.ts` by default; auto-detects `src/utils/`, `src/`, `app/`, or root), writes default `.designmatch/state.vqa.json`, updates `.gitignore`.
2. **Fetch**: Playwright headless downloads the entire canonical bundle (HTML + JSX + assets) to `.designmatch/canonical/` by intercepting every network response, then flips `config.json` kind from `url` → `local-dir` (original URL preserved for re-fetch).
3. **Port-all**: discovers every `screen-*.jsx|tsx` / `*Screen.jsx|tsx` in the bundle and writes each to `src/screens/<Name>.tsx` preceded by the TRANSLATION GUIDE (web → RN idiom map).
4. **Wire**: prints the `App.tsx` snippet (primeVisualQaFlag / applyVisualQaState / overrideFeatureFlags / VqaBadge / long-press handler).

Slash command equivalent (inside a Heimdall session): `/hmd:designmatch <url-or-path>`.

Auth: if the canonical URL is behind login, add `--headed` so Chromium launches visibly for interactive auth — the fetch picks up after sign-in.

Granular subcommands (when you want pieces, not the one-shot):

```bash
designmatch wire --app-dir .                       # app side only (no canonical)
designmatch fetch --app-dir . [--headed]           # download URL bundle
designmatch port <ScreenName> --out src/screens/<ScreenName>.tsx
designmatch port-all --out-dir src/screens         # port every screen found
designmatch action-types                           # print ACTION_TYPES starter
designmatch iterate Home --platform android --device emulator-5554
```

Peer deps the app must have: `@react-native-async-storage/async-storage`, `react-native-restart`. Dev deps for the harness: `playwright pixelmatch pngjs ssim.js sharp`.

## Build Path (port-first, mandatory)

**Methodology: port the canonical source, do NOT eyeball pixels.** The HTML/JSX in the canonical bundle is the spec; the PNG is the verification gate. Eyeballing pixels re-derives layout / spacing / colors that already exist in the source — drift, token bloat, the multi-commit grind documented in the anti-patterns reference.

Per-screen flow:

1. **Port** — `designmatch port <ScreenName> --out src/screens/<ScreenName>.tsx`
   Emits the canonical JSX preceded by a TRANSLATION GUIDE (web → RN idiom map). Optional `--guide-only` prints just the guide; `--no-guide` skips it.
2. **Translate** — apply the guide top-down:
   - `<div>` → `<View>`; `<span>` / `<p>` / `<h*>` → `<Text>`; `<img>` → `<Image>`; `<button>` → `<Pressable>`
   - `className` / Tailwind → `StyleSheet.create()`
   - All px literals → `normalize(n)`
   - `fontWeight` on bold-family text → `Platform.OS` gate (anti-pattern #2)
   - `<svg>` → `react-native-svg` primitives
   - Keep variable names + structure identical to canonical.
3. **Verify** — `designmatch iterate <ScreenName> --platform android --device <id>`
   Renders canonical, captures device, diffs, opens composite. Pass when **SSIM ≥ 0.95 OR pixel-diff ≤ 5%**.
4. **Refine** — only adjust translation deltas the diff surfaces. **Do NOT freelance pixel adjustments.**

If the canonical is registered as a URL (not yet downloaded), `designmatch port` and `designmatch port-all` auto-run `designmatch fetch` first — transparent. Add `--headed` if the URL is behind login. To skip auto-fetch on init, pass `--no-fetch`.

**Why mandatory:** rebuilding by eyeballing PNGs is anti-pattern #9. PNGs are the gate, not the build input.

## Architecture

```
canonical HTML ──Playwright──► canonical.png ─┐
                                              ├──diff──► metrics.json + composite.png ──► iterate
device (adb/xcrun) ──capture──► native.png ───┘
```

Canonical viewport locked to **1080×2444**. Orientation locked. State seeded via `window.__VQA_STATE__` before bundle eval.

## Layout

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
    ├── anti-patterns.md         # 9-item checklist (incl. port-first rule)
    └── canonical-values.md      # typography + spacing cheat-sheet
```

## VQA Stub Mode (assets/visual-qa.ts)

Trigger: **5× long-press AppLogo within 4s** → flip AsyncStorage `dm_visual_qa` → `RNRestart.restart()`.

Boot path: `primeVisualQaFlag()` reads AsyncStorage → `applyVisualQaState(dispatch)` seeds:

- **user**: `{ onboarded: true, verified: true, locale: 'en-US', name: 'Visual QA' }`
- **items**: 1 saved `{ id: 'vqa-1', title: 'Test Item', category: 'sample', detail: 'vqa-detail' }` + `setSelectedItem('vqa-1')`
- **wallet**: `{ balance: 1000, ledger: [], applyCapPct: 50 }`
- **session**: `{ region: 'primary', channel: 'default' }`

`overrideFeatureFlags(isFeatureEnabled)` → force-enables flag-gated UI when VQA on.

Visible indicator: **red "VQA" pill badge top-right** (safe-area inset).

Peer deps (consumer): `react`, `react-native`, `@react-native-async-storage/async-storage`.
Optional injected dep: `react-native-restart` (passed to `toggleVqaAndRestart`).

## Renderer (scripts/render-canonical.js)

Node + Playwright (chromium). Viewport `{ width: 1080, height: 2444, deviceScaleFactor: 1 }`.

Inject `window.__VQA_STATE__` via `page.addInitScript()` **BEFORE** bundle eval → redux seeds from it. Optional `window.__VQA_SCREEN__` for routing.

Serve bundle dir via local HTTP (pure node `http` + `fs`) → no extra deps.

Wait strategy:
- `--wait <ms>` → timeout
- `--wait <selector>` → `waitForSelector`
- default → poll `window.__APP_READY__` truthy

Full-page screenshot 1080×2444 → `--out canonical.png`.

```
node render-canonical.js --html <App.html> --state <state.json> --out <canonical.png> [--screen <Name>] [--wait <ms|selector>]
```

Exit 0 + `{"ok":true,...}` stdout on success. Nonzero + error JSON on failure.

## Diff Harness (scripts/visual-diff.js)

Dual metric:
- **pixelmatch** → perceptual pixel diff (catches color/position drift)
- **ssim.js** → structural similarity (catches structural matches under accumulated minor pixel diffs)

Resize-to-match via `sharp` if PNG sizes differ (document in top-of-file comment).

Outputs:
- `diff.png` — pixelmatch overlay
- `composite.png` — 3-up horizontal: canonical | native | diff, 2px black separators
- `metrics.json` — `{ ssim, pixelDiffCount, totalPixels, pixelDiffPct, width, height, canonical, native, timestamp }`

Stdout (terse): `SSIM 0.823 | diff 4.2% | composite: <path>`.

Pass: **SSIM ≥ 0.95 OR pixelDiffPct ≤ 5** → exit 0. Else exit 1.

```
node visual-diff.js --canonical <c.png> --native <n.png> --out-dir <dir> [--threshold 0.1]
```

## Iteration Loop (scripts/iterate-screen.sh)

```
iterate-screen.sh <ScreenName> [--platform android|ios] [--device <id>] [--bundle <App.html>] [--state <state.json>] [--out <dir>]
```

Defaults: `OUT_DIR=./.designmatch/<ScreenName>`. `BUNDLE_HTML` / `VQA_STATE` from env.

Steps:
1. `mkdir -p $OUT_DIR`
2. render canonical → `$OUT_DIR/canonical.png`
3. capture native:
   - android → `adb -s <id> exec-out screencap -p > $OUT_DIR/native.png` (`exec-out` avoids CRLF mangling)
   - ios sim → `xcrun simctl io <id> screenshot $OUT_DIR/native.png`
   - ios real → fall back to `idevicescreenshot $OUT_DIR/native.png` if on PATH
4. diff via `visual-diff.js` → capture exit code as PASS/FAIL
5. `open` (mac) / `xdg-open` (linux) the composite
6. print metrics + pass/fail + next-step hint

`set -euo pipefail`. Validate `node`, `adb`/`xcrun` per platform. Clear error messages.

## Patterns to Enforce

- **Typography Platform gate**: `Platform.OS === 'android' ? {} : { fontWeight: 'N' }` — keeps Android on family-name bold (e.g. `Bricolage-Bold`) instead of synthesized weight that drifts from canonical.
- **`normalize()` always-on** wrapper for px values (width-relative RN scaler, base 414).
- Default Typography variant resolves to body family → **headings MUST specify display variant**.
- **Single safe-area**: Screen wrapper OR inner container, never both.
- **Header choice**: native stack header OR in-screen PushHeader, never both.
- **Custom `tabBarStyle`** when expand-to-label animation is needed.

See `references/anti-patterns.md` for the 8-item ❌/✅ checklist.
See `references/canonical-values.md` for fonts + spacing cheat-sheet.

## Agent Dispatch Guidance

- One agent per file or per logical concern → avoid file-overlap conflicts.
- Each agent commits independently (`--no-verify` if hooks broken in worktree).
- Avoid worktree isolation when agents need full `node_modules` + live device.
- Explicitly send each agent the `Platform.OS` pattern — don't assume inference from canonical jsx.
- Explicitly tell each agent to use `normalize()` wrapping — they otherwise inline literal px and bloat the diff.

## Scoring & Success

- Report SSIM (0–1) + pixel-diff % per screen.
- Target: **SSIM ≥ 0.95 OR pixel-diff ≤ 5%**.
- Baseline (a real screen, pre-loop): 35% → 55% over ~30 eyeballed commits.

## Quick Reference

| Concern | Answer |
|---|---|
| Canonical viewport | 1080×2444, deviceScaleFactor 1 |
| Pass gate | SSIM ≥ 0.95 OR pixelDiff ≤ 5% |
| State injection | `window.__VQA_STATE__` via `addInitScript` |
| Android capture | `adb -s <id> exec-out screencap -p` |
| iOS sim capture | `xcrun simctl io <id> screenshot` |
| iOS real capture | `idevicescreenshot` |
| VQA toggle | 5× long-press AppLogo in 4s |
| Storage key | `dm_visual_qa` |
| Composite layout | canonical \| native \| diff (2px black sep) |

## Common Mistakes

- Skipping `Platform.OS` gate on fontWeight → Android synthesizes bold → diff bloats.
- Inlining literal px instead of `normalize()` → fails on non-base-414 devices.
- Double safe-area (Screen + inner) → top padding doubles → header position drifts.
- Native stack header + in-screen PushHeader → two headers stack.
- Forgetting `exec-out` on adb → CRLF mangles PNG → unreadable native.png.
- Injecting `__VQA_STATE__` after bundle eval → redux already booted → seed ignored.
