---
name: designmatch
description: Bootstrap the designmatch skill in a React Native project from a Claude Design link. Auto-imports the Visual QA stub helper (visual-qa.ts), writes default state.vqa.json, registers the canonical source, updates .gitignore, and prints the wiring snippet. Use when starting visual-parity work on a new RN screen or when the user pastes a Claude Design URL.
---

# /heimdall:designmatch — bootstrap designmatch in an RN app

## What this command does

Auto-runs `designmatch init <canonical-source> --app-dir <pwd>`:

1. Validates the current directory looks like a React Native app (`package.json` with `react-native` dep).
2. Copies `skills/designmatch/assets/visual-qa.ts` into the app at a sensible path (`src/lib/visual-qa.ts`, falling back to `src/utils/`, `src/`, `app/`, or root).
3. Writes default `.designmatch/state.vqa.json` (seeds user/recipient/bonus/transfer per the skill spec).
4. Registers the canonical source in `.designmatch/config.json`:
   - HTTPS URL → stored for lazy Playwright fetch
   - Local dir → copied wholesale to `.designmatch/canonical/`
   - Local HTML file → copied as the canonical entry (with sibling jsx/css/png/svg)
5. Updates `.gitignore` (idempotent) to exclude regenerated artifacts (`.designmatch/canonical/`, `.designmatch/screens/`).
6. Prints the wiring snippet for `App.tsx` and the next-step command.

## How to invoke

The user types:

```
/heimdall:designmatch <claude-design-url-or-path>
```

Examples:

```
/heimdall:designmatch https://api.anthropic.com/v1/design/h/BwHAOZU59KCkBa9UQk015Q?open_file=Wallet+Web.html
/heimdall:designmatch ./design-bundle/
/heimdall:designmatch ./App.html
```

Optional flags after the source:

- `--app-dir <path>` — RN project root (default: cwd)
- `--target <rel>` — explicit destination for `visual-qa.ts` (default: auto-detect)
- `--force` — overwrite existing files
- `--no-fetch` — skip auto-fetching URL canonicals (default: auto-fetch on)
- `--no-port-all` — skip the bulk port step (default: port-all on)
- `--headed` — launch Chromium visibly for interactive auth when fetching

## What the orchestrator should do

URL in, ready-to-translate out. The default one-shot is:

```bash
designmatch init "<source>" --app-dir "$PWD" --port-all
```

This runs the full pipeline:

1. App-side: copies `visual-qa.ts` (→ `src/lib/visual-qa.ts` by default), writes `.designmatch/state.vqa.json`, updates `.gitignore`.
2. Fetch (if URL): Playwright downloads the bundle to `.designmatch/canonical/` and flips config from `url` → `local-dir`.
3. Port-all: discovers `screen-*.jsx|tsx` / `*Screen.jsx|tsx` in the bundle, emits each to `src/screens/<Name>.tsx` preceded by the TRANSLATION GUIDE.
4. Wiring snippet: printed for `App.tsx`.

Step-by-step the orchestrator does:

1. Parse the canonical source (and any flags) from the slash command arguments. Add `--port-all` to the `init` invocation unless the user passed `--no-port-all`.
2. If the user did NOT include a canonical source, fall back to `designmatch wire --app-dir "$PWD"` (app-side only setup).
3. Run the assembled command, streaming output verbatim.
4. After success, point the user at the per-screen next step:

   ```
   ✓ designmatch fully wired. N screens ported to src/screens/.
   Edit src/lib/visual-qa.ts → set ACTION_TYPES to your reducers.
   Translate each src/screens/<Name>.tsx top-down per the TRANSLATION GUIDE.
   Verify: designmatch iterate <ScreenName> --platform android --device <id>
   ```

5. If `designmatch fetch` fails (auth required), retry once with `--headed` and tell the user to sign in in the browser window that appears.

## Build path (port-first, mandatory)

Once bootstrapped, every screen follows port-first:

1. `designmatch port <ScreenName> --out src/screens/<ScreenName>.tsx` — emits canonical JSX preceded by a TRANSLATION GUIDE (web → RN idiom map).
2. Translate top-down per the guide (`<div>`→`<View>`, `className`→`StyleSheet` with `normalize()`, `fontWeight` on bold-family → Platform.OS gate, etc.).
3. `designmatch iterate <ScreenName>` — diff verifies. Refine only deltas the diff surfaces.

The orchestrator MUST steer the user toward `designmatch port` for any "build/recreate/match this screen" prompt. Rebuilding by eyeballing PNGs is anti-pattern #9 — do not start an agent on a screen without porting the canonical source first.

## When NOT to use

- The RN project already has `src/lib/visual-qa.ts` AND `.designmatch/config.json` AND the user is iterating, not bootstrapping → use `designmatch port <Screen>` then `designmatch iterate <Screen>` directly instead.
- The user wants the diff harness on screenshots they already have → use `designmatch diff <canonical.png> <native.png> --out-dir <dir>`.

## Related

- Skill body: `Skill(designmatch)`
- Anti-patterns: `skills/designmatch/references/anti-patterns.md`
- Canonical values: `skills/designmatch/references/canonical-values.md`
