---
name: designmatch
description: Bootstrap the designmatch skill in a React Native project from a Claude Design link. Auto-imports the Visual QA stub helper (visual-qa.ts), writes default state.vqa.json, registers the canonical source, updates .gitignore, and prints the wiring snippet. Use when starting visual-parity work on a new RN screen or when the user pastes a Claude Design URL.
---

# /superx:designmatch — bootstrap designmatch in an RN app

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
/superx:designmatch <claude-design-url-or-path>
```

Examples:

```
/superx:designmatch https://api.anthropic.com/v1/design/h/BwHAOZU59KCkBa9UQk015Q?open_file=Wallet+Web.html
/superx:designmatch ./design-bundle/
/superx:designmatch ./App.html
```

Optional flags after the source:

- `--app-dir <path>` — RN project root (default: cwd)
- `--target <rel>` — explicit destination for `visual-qa.ts` (default: auto-detect)
- `--force` — overwrite existing files

## What the orchestrator should do

1. Parse the canonical source (and any flags) from the slash command arguments.
2. Run the bootstrap:

   ```bash
   designmatch init "<source>" --app-dir "$PWD" [--target <rel>] [--force]
   ```

3. Stream the CLI output verbatim (it prints status + wiring snippet).
4. After success, prompt the user with the next step:

   ```
   ✓ designmatch wired. Edit src/lib/visual-qa.ts to map ACTION_TYPES to your reducers, then:
     designmatch iterate <ScreenName> --platform android --device <id>
   ```

5. If the user did NOT include a canonical source, fall back to `designmatch wire --app-dir "$PWD"` (app-side only setup) and explain that the canonical can be registered later with another `init` call.

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
