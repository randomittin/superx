# Next.js Stack Pack

Cold-start knowledge for role agents operating on a Next.js project. Repo-specific
refinements live in `.planning/skills/` and take precedence over anything here.

---

## Section 1 — Stack ID & Detection Signals

- **Stack id:** `nextjs`
- **Detected from:** `package.json` whose `dependencies` or `devDependencies`
  contains the key `next`.
- **Disambiguation:** all JS/TS projects share `package.json`. Precedence order
  (highest wins): `nextjs` (dep `next`) → `react-native` (dep `react-native` or
  `expo`) → `react` (dep `react`, no `next`/`react-native`) → `node` (none of
  the above). A project with both `next` and `react-native` is treated as `nextjs`.

---

## Section 2 — Directory Layout Conventions

App Router layout (Next.js 13+, default from Next 13.4 onward, standard in 14/15):

```
.
├── app/                        # App Router root — all routes live here
│   ├── layout.tsx              # Root layout (required, wraps all pages)
│   ├── page.tsx                # Route segment page (/ route)
│   ├── loading.tsx             # Streaming loading UI for this segment
│   ├── error.tsx               # Error boundary for this segment ("use client")
│   ├── not-found.tsx           # 404 UI
│   ├── globals.css             # Global styles imported by root layout
│   ├── (groups)/               # Route groups — no URL segment, shared layout
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       └── page.tsx        # /dashboard
│   ├── api/                    # Route handlers (server-side API endpoints)
│   │   └── [resource]/
│   │       └── route.ts        # GET/POST/PUT/DELETE exports
│   └── [slug]/                 # Dynamic segment
│       └── page.tsx
├── components/                 # Shared UI components
│   ├── ui/                     # Primitive/design-system components
│   └── <Feature>/              # Feature-scoped components
├── lib/                        # Shared utilities, helpers, SDK wrappers
│   ├── db.ts                   # Database client (e.g. Prisma, Drizzle)
│   └── auth.ts                 # Auth helpers
├── hooks/                      # Custom React hooks (all "use client" consumers)
├── types/                      # Shared TypeScript types / zod schemas
├── public/                     # Static assets served at /
├── middleware.ts               # Edge middleware (runs before every matched request)
├── next.config.ts              # Next.js configuration (ts preferred in v15)
├── tsconfig.json
├── eslint.config.mjs           # Flat ESLint config (Next 15 default)
└── package.json
```

### Server vs client components

- **Default:** every component inside `app/` is a **React Server Component (RSC)**.
  It renders on the server, has zero JS bundle cost, and can `await` directly.
- **`"use client"`** at the top of a file makes it a Client Component. Add it
  only when the component needs browser APIs, event handlers, `useState`,
  `useEffect`, or third-party client-only libraries.
- **Boundary rule:** a server component can import and render a client component,
  but a client component cannot import a server component. Pass server-computed
  data down as props instead.
- **`"use server"`** marks a function as a Server Action — callable from client
  components without a manual API route.

### Colocation conventions

- A route's private components can live alongside the route in `app/`:
  `app/dashboard/_components/` (underscore prefix opts out of routing).
- Shared components used in 2+ routes go in `components/`.
- Shared server-only logic (db access, auth, secrets) goes in `lib/` — never
  imported by a file that has `"use client"` at its top.
- Route handlers (`route.ts`) export named HTTP method functions: `GET`, `POST`,
  `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

---

## Section 3 — Lint / Format / Test / Build Commands

Assumes `npm`. Swap `npm run` for `yarn` or `pnpm run` if the project uses those.

- **Format:** `npx prettier --write .`
  (or `npm run format` if defined in package.json)
- **Lint:** `npm run lint`
  — internally runs `next lint` (ESLint with Next.js config). Build fails on
  errors; warnings surface in output but do not exit non-zero by default. Run
  `next lint --max-warnings 0` to treat warnings as errors.
- **Typecheck:** `npx tsc --noEmit`
  — must exit 0 before any merge. Does not emit JS; only validates types.
- **Test (unit/integration — vitest):** `npm test` or `npx vitest run`
  — single file: `npx vitest run src/lib/utils.test.ts`
  — single test: `npx vitest run -t "formats currency"`
- **Test (unit/integration — jest):** `npm test` or `npx jest --passWithNoTests`
  — single file: `npx jest app/api/orders/route.test.ts`
  — single test: `npx jest -t "returns 400 when body is missing"`
- **Test (e2e — Playwright):** `npx playwright test`
  — single spec: `npx playwright test e2e/checkout.spec.ts`
  — headed: `npx playwright test --headed`
- **Build (production):** `npm run build`
  — runs `next build`; exits non-zero on any type error, lint error, or broken
  import. Must pass before deploy.
- **Start (production server):** `npm start`
  — runs `next start`; requires a prior `npm run build`.
- **Dev server:** `npm run dev`
  — starts Next.js dev server with Fast Refresh, usually on port 3000.

---

## Section 4 — Acceptance-Criteria Templates

Drop these into a plan's acceptance-criteria section. Each is a command a
reviewer runs and reads the exit code of.

- `npm run build` exits 0 — production build compiles without errors or broken
  imports.
- `npx tsc --noEmit` exits 0 — no TypeScript errors across the codebase.
- `npm run lint` exits 0 (or `next lint --max-warnings 0` exits 0) — no lint
  errors or warnings.
- `npm test` exits 0 (or `npx vitest run` exits 0) — full unit/integration suite
  is green.
- `npx playwright test` exits 0 — all e2e specs pass against the running app.
- New route `app/<path>/page.tsx` has a co-located or `__tests__/` test file:
  `find . -path "*/app/<path>/*.test.*" -o -path "*/__tests__/*<name>*" | grep -q .`
  returns 0.
- New route handler `app/api/<resource>/route.ts` has a test covering each
  exported HTTP method:
  `grep -r "GET\|POST\|PUT\|DELETE" **/__tests__/*<resource>* || grep -r "GET\|POST\|PUT\|DELETE" app/api/<resource>/route.test.ts`
  returns a match.
- No server component imports a client-only API:
  `grep -rn "localStorage\|sessionStorage\|window\.\|document\." app/ | grep -v '"use client"' | grep -v node_modules`
  returns empty.
- No `"use client"` on a component that uses no browser API, event handler, or
  React hook:
  code review grep — `grep -rn '"use client"' components/ app/` and verify each
  occurrence has at least one of: `useState`, `useEffect`, `useRef`, `use*` hook,
  `onClick`/`onChange`/event handler, or browser global.
- `NEXT_PUBLIC_` prefix on every env var that is read client-side:
  `grep -rn "process\.env\." app/ components/ | grep -v "NEXT_PUBLIC_" | grep -v '"use server"' | grep -v route.ts`
  returns empty (no bare `process.env.SECRET` in client-side files).
- Server-only modules not imported from client components:
  `grep -rn '"use client"' app/ components/ | cut -d: -f1 | xargs grep -l "import.*from.*['\"]lib/db\|lib/auth['\"]"` 
  returns empty.

---

## Section 5 — Common Failure Patterns + Fixes

- **Symptom:** `Error: useState can only be used in a Client Component.`
  **Cause:** a file inside `app/` uses a React hook or browser API but lacks
  `"use client"` at the very top (above all imports).
  **Fix:** add `"use client";` as the first line of that file. Do not add it to
  every file — only the ones that need it.

- **Symptom:** Hydration error: `Text content does not match server-rendered HTML`
  or `Hydration failed because the initial UI does not match`.
  **Cause:** component renders differently on server vs client — common with
  `new Date()`, `Math.random()`, `Date.now()`, `typeof window`, or locale-aware
  formatters that differ between server timezone and browser timezone.
  **Fix:** wrap the volatile output in `useEffect` + `useState` so it only renders
  client-side, or normalize the value before rendering (e.g. always format dates
  as UTC strings in RSC, let the client reformat if needed). For `typeof window`
  guards, use a `mounted` state pattern: initialize to `false`, set to `true` in
  `useEffect`, render the window-dependent branch only when `mounted === true`.

- **Symptom:** `Module not found: Can't resolve 'server-only'` or a secret key
  leaks into the browser bundle.
  **Cause:** a `lib/` file that imports server-only packages (Prisma, secret env
  vars, `crypto` node built-in) was imported — directly or transitively — by a
  file with `"use client"`.
  **Fix:** add `import 'server-only';` at the top of every `lib/` module that must
  never run in the browser. Next.js will throw a build-time error if a client
  component imports it.

- **Symptom:** `NEXT_PUBLIC_` env var is `undefined` at runtime in the browser.
  **Cause:** the variable was referenced as `process.env.MY_VAR` (no prefix) in a
  client component, or the variable was added to `.env.local` after the dev
  server started.
  **Fix:** rename to `NEXT_PUBLIC_MY_VAR` everywhere (both `.env` file and source).
  Restart the dev server after any `.env` change — Next.js bakes public env vars
  at build/start time.

- **Symptom:** `process.env.SECRET` is defined in a route handler but `undefined`
  in a client component, causing a runtime crash.
  **Cause:** expected server-only env var was read in a `"use client"` file.
  **Fix:** move the logic that needs the secret to a Server Action (`"use server"`
  function) or a route handler (`app/api/.../route.ts`). Never read non-`NEXT_PUBLIC_`
  env vars in client components.

- **Symptom:** API route returns 405 Method Not Allowed.
  **Cause:** the HTTP method function is not exported from `route.ts`, or the file
  is named `api.ts` instead of `route.ts`.
  **Fix:** ensure the file is `route.ts` (not `handler.ts`, not `index.ts`) and
  that it exports the exact uppercase method name: `export async function GET(...)`.

- **Symptom:** `fetch` in an RSC returns stale data; changes in the database are
  not reflected after deploy.
  **Cause:** Next.js App Router caches `fetch` responses indefinitely by default
  (`force-cache`). A `revalidate` was not set.
  **Fix:** set `export const revalidate = <seconds>` at the route segment level, or
  pass `{ next: { revalidate: <seconds> } }` to each `fetch` call, or use
  `{ cache: 'no-store' }` for fully dynamic data. Call `revalidatePath()` /
  `revalidateTag()` from a Server Action after mutations.

- **Symptom:** dynamic import is needed but causes SSR crash: `window is not defined`.
  **Cause:** a client-only library (e.g. a charting lib, rich text editor) accesses
  browser globals at module-init time, so SSR blows up on import.
  **Fix:** use `const Component = dynamic(() => import('../components/Editor'), { ssr: false })`.
  This defers the import to the browser. Do not use `ssr: false` as a blanket fix
  for all components — only those that are genuinely unrenderable on the server.

- **Symptom:** `"use client"` spread throughout the codebase; large JS bundle.
  **Cause:** `"use client"` was added reflexively to every component that accepts
  an `onClick` prop or uses any interactivity, instead of pushing the boundary as
  deep as possible.
  **Fix:** keep RSCs for data-fetching wrappers and static layout; push `"use client"`
  down to the smallest leaf component that needs browser interaction. A parent
  component can remain a server component and pass server-fetched data as props
  to a client child.

- **Symptom:** middleware runs on every request including static assets, causing
  slow response or auth redirects on `/_next/static/` files.
  **Cause:** `middleware.ts` has no `matcher` config, so it runs on every route.
  **Fix:** add a `matcher` export that excludes static and image routes:
  ```ts
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  };
  ```

---

## Layering Note

This pack is the **cold-start scaffold** — generic Next.js truths valid across
projects. When superx detects repo-specific patterns (custom test runner flags,
non-standard directory structure, proprietary UI library conventions), it writes
those to `.planning/skills/*.md`. Those files are loaded after this pack and
override any conflicting guidance here.
