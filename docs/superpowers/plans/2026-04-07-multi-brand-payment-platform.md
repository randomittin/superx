# Multi-Brand Payment Services Platform -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite monorepo producing 5 service SPAs x 5 brands = 22 deployable web apps with shared auth, components, and brand-driven theming.

**Architecture:** pnpm workspace monorepo. Shared packages (`@pay/ui`, `@pay/auth`, `@pay/api`, `@pay/brand-config`) imported by 5 Vite app entry points. Each app reads `VITE_BRAND` env var at build time to produce a standalone SPA with brand-specific CSS variables, backgrounds, and border-radius. Vaul-based bottom sheets are the primary UI pattern.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, vaul 1.1.2, pnpm workspaces, FontAwesome, UberMove font, react-router-dom 7, vitest, MSW.

---

## Research Findings Summary

Analysis documents saved at `docs/analysis/`:
- `supercheckout-wallet.md` -- **Already Vite+React** (not Next.js). Has checkout/payment-modes flow with vaul sheets, CSS variable theming. Missing: KYC, dashboard, add money, P2P, beneficiaries, history.
- `receiver-onboarding.md` -- **Next.js 16**, needs full Vite port. RSA-AES encrypted link decryption (server-side), NextAuth, consent flow. API: `api.spaid.in/backend/v2`.
- `spaid-repo.md` -- **React Native app** (not web). Has education BBPS flow (state->city->school->verification), 100+ API endpoints. UI must be rebuilt for web; flow logic and endpoints reusable.
- `spaid-education.md` -- GitHub repos `mewt-app/spaid-education` and `mewt-app/spaid-landing` are private/404. Education flow extracted from local spaid React Native app.
- `ultrafastapi-reference.md` -- Dark theme wallet behind auth wall. Phone +91 auth. Blue #266ef1 accent. Dashboard not visible publicly.

---

## 1. ASSUMPTIONS

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | Project lives in a NEW directory `/Users/rj/Downloads/pay-platform/` | Restructure if wrong |
| A2 | supercheckout is already Vite+React -- we reuse its CSS variable system, vaul patterns, PhoneInput, OtpVerify, and API client directly | Confirmed by research |
| A3 | supercheckout is checkout-only (no wallet dashboard/KYC/transfers) -- wallet dashboard features must be built from spec + ultrafastapi reference | Confirmed by research |
| A4 | spaid React Native app's education BBPS flow logic + API endpoints are canonical -- we rebuild UI in web React following same state->city->school->verification pattern | If web API differs, endpoints need updating |
| A5 | receiver-onboarding must be fully ported from Next.js 16 to Vite (server actions->client calls, NextAuth->custom JWT, next/link->react-router) | Confirmed by research |
| A6 | Encrypted link decryption (RSA-AES) stays server-side via API call, not client-side | Private key must never be in client bundle |
| A7 | OTP API at localhost:8000 is dev-only; prod uses /authentication/app-authenticate/ at api.spaid.in/backend/v2 | Need user confirmation |
| A8 | Backend API base https://api.spaid.in/backend/v2 serves all services; VITE_API_BASE_URL overrides per environment | Per-brand override may be needed |
| A9 | UberMove font files at supercheckout/public/fonts/ can be copied (Regular, Medium, Bold TTF) | Confirmed available |
| A10 | Remaining brand themes use sensible defaults until user provides them | Visual fidelity may differ |
| A11 | PG flow is shared redirect/iframe -- placeholder until details arrive | PG screens will be stubs |
| A12 | Rent agreement AI verification is a backend endpoint (POST document, receive result) | If client-side ML, need different architecture |
| A13 | All apps are client-side SPAs, no SSR needed | If SEO needed, different approach |
| A14 | API key from receiver-onboarding is shared across services | May need per-service keys |

---

## 2. ARCHITECTURE

### Monorepo Structure

```
pay-platform/
|-- packages/
|   |-- brand-config/              # Brand theme definitions + service availability
|   |   |-- src/
|   |   |   |-- brands/superpe.ts, spaid.ts, kuxdistro.ts, mewt.ts, slongo.ts
|   |   |   |-- index.ts           # getBrandConfig(brandId), getActiveBrands(serviceId)
|   |   |   |-- types.ts           # BrandConfig, BrandId, ServiceId
|   |   |-- package.json, tsconfig.json
|   |
|   |-- ui/                        # Shared React components (vaul sheets, inputs, buttons)
|   |   |-- src/
|   |   |   |-- BrandProvider.tsx   # Context + CSS var injection on :root
|   |   |   |-- Sheet.tsx          # vaul Drawer with brand borderRadius
|   |   |   |-- PhoneInput.tsx     # +91 phone entry (ported from supercheckout)
|   |   |   |-- OTPInput.tsx       # N-digit with auto-advance, paste
|   |   |   |-- Button.tsx         # CTA using brand tokens, variants, loading state
|   |   |   |-- BrandBackground.tsx # Full-screen brand background image
|   |   |   |-- StatusScreen.tsx   # Success/failure result
|   |   |   |-- ResendOTP.tsx      # Resend countdown timer
|   |   |   |-- LoadingSpinner.tsx
|   |   |   |-- PolicyLinks.tsx    # Terms/privacy/refund links per brand
|   |   |-- package.json, tsconfig.json
|   |
|   |-- auth/                      # Shared phone OTP auth
|   |   |-- src/
|   |   |   |-- AuthProvider.tsx   # Context: token, phone, isAuthenticated
|   |   |   |-- useAuth.ts        # Hook for auth state
|   |   |   |-- AuthFlow.tsx      # Sheet-wrapped phone->OTP flow
|   |   |   |-- api.ts            # sendOtp(), verifyOtp()
|   |   |   |-- storage.ts        # localStorage token persistence
|   |   |   |-- types.ts
|   |   |-- package.json, tsconfig.json
|   |
|   |-- api/                       # Shared API client
|   |   |-- src/
|   |   |   |-- client.ts         # fetch wrapper with Bearer auth + 401 handling
|   |   |   |-- endpoints.ts      # Endpoint map for all services
|   |   |   |-- types.ts          # ApiResponse<T>
|   |   |-- package.json, tsconfig.json
|   |
|   |-- registration/              # Shared CRED-style multi-step registration
|   |   |-- src/
|   |   |   |-- RegistrationFlow.tsx  # Stacked sheets: name->phone->PAN->bank->confirm
|   |   |   |-- steps/NameStep.tsx, PhoneStep.tsx, PANStep.tsx, BankStep.tsx, ConfirmStep.tsx
|   |   |   |-- types.ts          # RecipientType = 'tutor' | 'landlord'
|   |   |-- package.json, tsconfig.json
|
|-- apps/
|   |-- wallet/                    # SuperPE + Slongo only
|   |-- education/                 # All 5 brands
|   |-- rent/                      # All 5 brands
|   |-- utility/                   # All 5 brands
|   |-- seller-verification/       # All 5 brands
|
|-- public/
|   |-- fonts/UberMove-Regular.ttf, UberMove-Medium.ttf, UberMove-Bold.ttf
|   |-- backgrounds/superpe-bg.svg, spaid-bg.svg, kuxdistro-bg.jpg, mewt-bg.svg, slongo-bg.svg
|
|-- scripts/build-all.mjs
|-- pnpm-workspace.yaml
|-- package.json
|-- tsconfig.base.json
|-- tailwind.preset.js
|-- vitest.workspace.ts
```

### Data Flow

```
User visits wallet.superpe.in
  -> Vite SPA loads (built with VITE_BRAND=superpe)
  -> BrandProvider reads brand config, injects CSS variables onto :root
  -> AuthFlow shows brand-backgrounded sheet with phone input
  -> OTP sent via POST /authentication/app-authenticate/
  -> OTP verified via POST /authentication/app-validate/ -> JWT stored
  -> Service-specific pages rendered with brand-themed sheets
  -> Payment flow -> PG redirect/iframe -> status page
```

### Brand Config Schema

```typescript
type BrandId = 'superpe' | 'spaid' | 'kuxdistro' | 'mewt' | 'slongo'
type ServiceId = 'wallet' | 'education' | 'rent' | 'utility' | 'seller-verification'

interface BrandConfig {
  id: BrandId
  name: string                    // 'SuperPE'
  entityName: string              // 'SuperPE Marketplace Pvt Ltd'
  domain: string                  // 'superpe.in'
  services: ServiceId[]
  theme: {
    accentColor: string           // '#266EF1'
    primaryColor: string          // '#ffffff'
    borderRadius: string          // '0px'
    sheetRadius: string           // '0px'
    backgroundImage: string       // '/backgrounds/superpe-bg.svg'
    backgroundStyle: 'illustration' | 'photo' | 'pattern' | 'solid'
    ctaBg: string
    ctaText: string
  }
  api: {
    baseUrl: string               // 'https://api.spaid.in/backend/v2'
    otpUrl: string
    appOrigin: string             // 'superpe' | 'spaid' etc.
    apiKey: string                // x-api-key header value
    company: string               // OTP company name for Twilio
  }
  policies: {
    termsUrl: string
    privacyUrl: string
    refundUrl: string
  }
}
```

---

## 3. INFRASTRUCTURE

| Concern | Approach |
|---|---|
| **Build** | `VITE_BRAND=X pnpm --filter <app> build` -> `dist/` static SPA per combo |
| **Hosting** | Static hosting (Cloudflare Pages / Vercel / Nginx -- user to confirm) |
| **Subdomains** | CNAME per `<service>.<brand-domain>` |
| **SSL** | Wildcard certs (`*.superpe.in`, `*.spaid.in`, etc.) |
| **CDN** | Hosting provider CDN for static assets |
| **Dev** | Vite dev server with proxy for `/api` -> backend |

### CI/CD Build Matrix (22 combos)

```yaml
build-matrix:
  - { service: wallet, brand: superpe }
  - { service: wallet, brand: slongo }
  - { service: education, brand: superpe }
  - { service: education, brand: spaid }
  - { service: education, brand: kuxdistro }
  - { service: education, brand: mewt }
  - { service: education, brand: slongo }
  # rent: 5 combos, utility: 5 combos, seller-verification: 5 combos

steps:
  - pnpm install --frozen-lockfile
  - pnpm typecheck
  - pnpm test
  - VITE_BRAND=$brand pnpm --filter ./apps/$service build
  - deploy dist/ to $service.$domain
```

### Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `VITE_BRAND` | Build-time brand selection | `superpe` |
| `VITE_API_BASE_URL` | Backend API base | `https://api.spaid.in/backend/v2` |
| `VITE_OTP_API_URL` | OTP service URL (dev override) | `http://localhost:8000` |

---

## 4. SECURITY

| Concern | Approach |
|---|---|
| **Auth** | Phone OTP -> JWT in localStorage; 401/403 auto-logout |
| **CORS** | Backend allows all 22 subdomain origins; Vite proxy for dev |
| **CSP** | `default-src 'self'; connect-src <api>; img-src 'self' data:; font-src 'self'` |
| **Secrets** | No private keys in client. RSA decryption (seller-verification) stays server-side via API |
| **API Key** | `x-api-key` header sent with requests (not secret, identifies client app) |
| **XSS** | React default escaping; no raw HTML insertion |
| **File upload** | Client-side type/size validation; processing server-side |
| **Rate limiting** | OTP resend cooldown in UI (30s); backend handles actual limiting |

---

## 5. SUB-PROJECTS & DEPENDENCY GRAPH

```
SP1: Monorepo Setup + Brand Config
  |
  +-> SP2: Shared UI Components (@pay/ui)
  |     |
  +-> SP3: Shared API Client (@pay/api)  [parallel with SP2]
  |     |
  +-----+-> SP4: Shared Auth Flow (@pay/auth)
  |           |
  |           +-> SP5: Wallet App ----------+
  |           +-> SP6: Education App -------+-> [all parallel]
  |           +-> SP8: Utility App ---------+
  |           +-> SP9: Seller Verification -+
  |                 |
  +-> SP10: Shared Registration (@pay/registration) [parallel with SP4]
              |
              +-> SP6 uses registration (tutor)
              +-> SP7: Rent App (uses registration as landlord, after SP6)
```

---

### SP1: Monorepo Setup + Brand Config

**Scope:** Initialize pnpm workspace, @pay/brand-config with all 5 brands, shared tsconfig/tailwind preset, fonts, Vitest.
**Agent:** superx:coder
**Depends on:** None

**Files:**
- Create: pnpm-workspace.yaml, package.json, tsconfig.base.json, tailwind.preset.js, vitest.workspace.ts
- Create: packages/brand-config/src/types.ts, brands/*.ts, index.ts, __tests__/brand-config.test.ts
- Copy: supercheckout/public/fonts/UberMove-*.ttf to public/fonts/

#### Task 1.1: Initialize monorepo root

- [ ] Create pnpm-workspace.yaml with packages/* and apps/*
- [ ] Create root package.json with scripts: typecheck, test, build:all
- [ ] Create tsconfig.base.json (ES2022, bundler module resolution, strict, react-jsx)
- [ ] Create tailwind.preset.js with CSS var tokens: accent, surface, ink, cta, border, success/error/warning
- [ ] Create vitest.workspace.ts referencing packages/*/vitest.config.ts
- [ ] Copy UberMove fonts from /Users/rj/Downloads/code/supercheckout/public/fonts/
- [ ] git init, pnpm install, commit

#### Task 1.2: Brand config package

- [ ] Write failing test: getBrandConfig, getActiveBrands, service availability
- [ ] Create types.ts: BrandId, ServiceId, BrandConfig, BrandTheme, BrandApiConfig, BrandPolicies
- [ ] Create 5 brand files (superpe, spaid, kuxdistro, mewt, slongo) with full config each:
  - superpe: accent #266EF1, radius 0px, services include wallet
  - spaid: accent #0e8345, radius 12px, no wallet
  - kuxdistro: accent #1a1a1a, radius 8px, photo background, no wallet
  - mewt: accent #6C5CE7, radius 12px, no wallet
  - slongo: accent #FF6B35, radius 8px, services include wallet
- [ ] Create index.ts: getBrandConfig(), getActiveBrands(), BRAND_IDS, SERVICE_IDS
- [ ] Run tests (expect PASS), typecheck, commit

**Acceptance Criteria:**
- pnpm install works
- getBrandConfig('superpe') returns accent #266EF1, radius 0px
- getActiveBrands('wallet') returns only superpe, slongo
- All 5 brands have education, rent, utility, seller-verification
- tsc --noEmit passes

---

### SP2: Shared UI Components (@pay/ui)

**Scope:** BrandProvider, Sheet, PhoneInput, OTPInput, Button, BrandBackground, StatusScreen, ResendOTP, LoadingSpinner, PolicyLinks.
**Agent:** superx:coder
**Depends on:** SP1

**Port sources:**
- PhoneInput from supercheckout src/pages/PhoneInput.tsx (already Vite/React)
- OTPInput from receiver-onboarding src/components/OTPInput.tsx (port from Next.js)
- ResendOTP from receiver-onboarding src/components/ResendOTP.tsx
- Button from receiver-onboarding src/components/Button.tsx
- CSS variable system from supercheckout src/index.css

#### Task 2.1: BrandProvider

- [ ] Write test: provides config via context, injects CSS vars on :root, updates on brandId change
- [ ] Implement: createContext, useEffect to set CSS vars (--accent, --bg, --cta-bg, --radius, etc.)
- [ ] Test pass, commit

#### Task 2.2: Sheet (vaul wrapper)

- [ ] Implement: Drawer.Root/Portal/Overlay/Content with brand sheetRadius
- [ ] Drag handle bar, overflow-y-auto content area, max-h-[96vh]
- [ ] Test renders children when open, commit

#### Task 2.3: PhoneInput

- [ ] Write test: renders +91 prefix, strips non-digits, max 10 digits
- [ ] Implement: +91 prefix span, tel input with digit filter, clear button, accent border on valid
- [ ] Test pass, commit

#### Task 2.4: OTPInput

- [ ] Write test: renders N inputs, auto-advance, paste fills all, onComplete fires when full
- [ ] Implement: ref array, auto-advance on digit, backspace nav, paste detection, auto-submit
- [ ] Test pass, commit

#### Task 2.5: Button, ResendOTP, BrandBackground, StatusScreen, LoadingSpinner, PolicyLinks

- [ ] Button: variants (primary/secondary/outline/ghost), sizes, loading spinner, disabled
- [ ] ResendOTP: cooldown timer, onResend callback
- [ ] BrandBackground: full-screen brand image or solid color
- [ ] StatusScreen: success/failure/pending icons, title, message, children
- [ ] LoadingSpinner: size variants
- [ ] PolicyLinks: terms/privacy/refund links from brand config
- [ ] Barrel export index.ts
- [ ] All tests pass, typecheck, commit

**Acceptance Criteria:**
- BrandProvider sets CSS vars on :root
- Sheet uses vaul with brand radius
- PhoneInput validates 10-digit Indian number
- OTPInput: auto-advance, paste, auto-submit
- Zero Next.js imports

---

### SP3: Shared API Client (@pay/api)

**Scope:** Typed fetch wrapper, auth headers, 401 handling, endpoint map.
**Agent:** superx:coder (parallel with SP2)
**Depends on:** SP1

**Port from:** supercheckout src/api/client.ts (already Vite-compatible)

#### Task 3.1: API client + endpoints

- [ ] Write test: sends GET with Bearer + x-api-key, calls onUnauthorized on 401
- [ ] Implement createApiClient(config) returning { get, post, put, delete }
- [ ] Create endpoints.ts mapping all confirmed endpoints from research:
  - Auth: /authentication/app-authenticate/, /authentication/app-validate/
  - Merchant: /merchant/get_merchant_details/:merchantId, etc.
  - Beneficiary: /merchant/beneficiary-onboarding/complete, etc.
  - BBPS: /bbps/cities, /bbps/categories-v2
  - Payment: /payoutcc/initiate-pg-transaction/v3, etc.
  - Cards: /pg/juspay/cards/list/:merchantId, etc.
- [ ] Create resolveEndpoint() for path param substitution
- [ ] Test pass, typecheck, commit

**Acceptance Criteria:**
- Auto-attaches Authorization + x-api-key headers
- 401/403 triggers onUnauthorized
- All endpoints from research mapped

---

### SP4: Shared Auth Flow (@pay/auth)

**Scope:** AuthProvider context, useAuth hook, AuthFlow component.
**Agent:** superx:coder
**Depends on:** SP2, SP3

#### Task 4.1: Auth storage + types

- [ ] Implement storage.ts: getToken/setToken/getPhone/setPhone/clear via localStorage
- [ ] Create types.ts: AuthState, AuthContextValue

#### Task 4.2: AuthProvider + useAuth

- [ ] Implement AuthProvider: manages token/phone state with localStorage init
- [ ] Implement useAuth: throws if outside provider, returns { isAuthenticated, token, phone, login, logout }
- [ ] Write test, verify, commit

#### Task 4.3: Auth API + AuthFlow

- [ ] Implement api.ts: sendOtp() POST /authentication/app-authenticate/ with { phone, appOrigin }
- [ ] Implement verifyOtp() POST /authentication/app-validate/ with { phone, otp, appOrigin }
- [ ] Implement AuthFlow: BrandBackground + Sheet containing phone step -> OTP step
  - Phone step: PhoneInput + "Send OTP" Button + PolicyLinks
  - OTP step: OTPInput (4-digit, auto-submit) + ResendOTP + "Change phone" link
  - On verify: login(token, phone), render children
- [ ] Test, commit

**Acceptance Criteria:**
- AuthProvider manages localStorage JWT
- AuthFlow renders as sheet over brand background
- Phone validates 10 digits, sends OTP
- OTP: 4-digit, auto-submit, 30s resend
- useAuth() returns full auth state

---

### SP5: Wallet App (SuperPE + Slongo)

**Scope:** Auth -> KYC (placeholder) -> Dashboard (balance, add money presets, P2P, beneficiaries, history).
**Agent:** superx:coder (parallel with SP6, SP8, SP9)
**Depends on:** SP4

**Key finding:** supercheckout has checkout/payment but NOT wallet dashboard. Dashboard built from spec.

#### Task 5.1: Wallet app scaffold

- [ ] Create vite.config.ts with API proxy, react plugin
- [ ] Create main.tsx: VITE_BRAND injection, reject non-wallet brands, BrandProvider > AuthProvider > AuthFlow > App
- [ ] Create index.css: @font-face UberMove + tailwind directives
- [ ] Create index.html, tailwind.config.js (extends shared preset)
- [ ] Verify dev server boots

#### Task 5.2: Dashboard page

- [ ] Balance card (placeholder zero balance)
- [ ] Quick action grid: Add Money, Transfer, Beneficiaries, History
- [ ] Recent transactions list (empty state)

#### Task 5.3: Add Money page

- [ ] Preset amounts in Sheet (100, 200, 500, 1000, 2000, 5000)
- [ ] Custom amount input
- [ ] PG redirect placeholder on confirm

#### Task 5.4: Transfer page

- [ ] Beneficiary selection from list
- [ ] Amount entry in Sheet
- [ ] Confirm transfer placeholder

#### Task 5.5: Beneficiaries + History pages

- [ ] Beneficiary list with add/remove via API
- [ ] Transaction history with date/status/amount
- [ ] Commit all

**Acceptance Criteria:**
- Boots with VITE_BRAND, rejects non-wallet brands
- Auth uses shared AuthFlow
- Dashboard, add money, transfer, beneficiaries, history functional
- Brand-specific styling throughout

---

### SP6: Education App (All 5 brands)

**Scope:** Post-auth landing with 2 options. Institute path (BBPS). Tutor path (registration).
**Agent:** superx:coder (parallel with SP5, SP8, SP9)
**Depends on:** SP4, SP10

**Port from:** spaid RN EducationBBPS1/2 (flow + API only, web UI rebuilt)

#### Task 6.1: Education scaffold + Home page

- [ ] Standard Vite app scaffold (same as wallet pattern)
- [ ] Home: two cards -- "Pay to School/Institute" and "Pay to Tutor"

#### Task 6.2: Institute path

- [ ] State selection (35 Indian states hardcoded)
- [ ] City selection via GET /bbps/cities?state=X
- [ ] School search with fuzzy matching (fuse.js, threshold 0.5)
- [ ] School selection -> Student verification
- [ ] Student ID input (14-digit) -> API verification
- [ ] If verified: Parent mobile (10 digits) + DOB (DD/MM/YYYY)
- [ ] Payment flow placeholder

#### Task 6.3: Tutor path

- [ ] Info sheet explaining tutor registration is required
- [ ] Trigger RegistrationFlow with recipientType='tutor'
- [ ] On complete: submission to backend, payment flow

**Acceptance Criteria:**
- Two-card landing page
- Institute path: state->city->school->verification->payment
- Tutor path: info->registration->payment
- Works with all 5 brands

---

### SP7: Rent App (All 5 brands)

**Scope:** "Pay to Landlord" only. Reuses registration with landlord labels. Rent agreement upload.
**Agent:** superx:coder
**Depends on:** SP4, SP10

#### Task 7.1: Rent scaffold + Home

- [ ] Single card: "Pay to Landlord"

#### Task 7.2: Landlord registration

- [ ] RegistrationFlow with recipientType='landlord' (all labels switch)

#### Task 7.3: Rent agreement upload

- [ ] File picker (PDF/image), size limit validation
- [ ] Upload to backend API
- [ ] AI verification result: landlord name + tenant name match
- [ ] On pass -> payment; on fail -> error with retry

**Acceptance Criteria:**
- Single "Pay to Landlord" card
- Registration uses landlord labels
- Agreement upload + AI verification
- Works with all 5 brands

---

### SP8: Utility App (All 5 brands)

**Scope:** Bill categories -> biller search -> consumer number + amount -> payment.
**Agent:** superx:coder (parallel with SP5, SP6, SP9)
**Depends on:** SP4

**Port from:** spaid RN BBPS flow (API endpoints, web UI rebuilt)

#### Task 8.1: Utility scaffold + Home (categories)

- [ ] Category grid: Electricity, Water, Gas, Telecom, Insurance, etc.

#### Task 8.2: Biller search

- [ ] Search by name/category via GET /bbps/categories-v2
- [ ] Biller list with icons

#### Task 8.3: Bill details + payment

- [ ] Consumer number input
- [ ] Amount fetch/display
- [ ] Payment flow placeholder

**Acceptance Criteria:**
- Category grid, biller search, bill details, payment
- Works with all 5 brands

---

### SP9: Seller Verification App (All 5 brands)

**Scope:** Port receiver-onboarding from Next.js 16 to Vite.
**Agent:** superx:coder (parallel with SP5, SP6, SP8)
**Depends on:** SP4

**Porting changes (from research):**
1. Server actions ("use server") -> client-side fetch via @pay/api
2. NextAuth -> @pay/auth (localStorage JWT)
3. next/link -> react-router-dom Link
4. next/font -> CSS @font-face (shared)
5. App directory routing -> react-router-dom routes
6. process.env -> import.meta.env
7. Encrypted link decryption -> backend API call (RSA key stays server-side)

#### Task 9.1: Seller verification scaffold

- [ ] Vite app with react-router-dom (routes: /, /consent)
- [ ] Brand-themed with shared UI

#### Task 9.2: Main verification flow (/)

- [ ] Parse ?d= query param
- [ ] Call backend API to decrypt payload (RSA stays server-side)
- [ ] Auto-trigger OTP to benePhone
- [ ] OTPInput verification
- [ ] On verify: call verifySellerFlowTxn + getDetailsForBeneOnboardingStep2
- [ ] Display OnboardingDetails (destination, tutor ID, PAN, expiry timer)
- [ ] "Understood" button -> completeBeneOnboardingV2
- [ ] Success/failure result screen

#### Task 9.3: Consent flow (/consent)

- [ ] Phone entry -> Send OTP
- [ ] OTP verification -> "Verify & Give Consent"
- [ ] Success: "Consent Registered" with verified phone badge

**Acceptance Criteria:**
- Encrypted link -> API decrypt -> OTP -> verify -> details -> result
- Consent: phone->OTP->success
- All Next.js code replaced
- Brand-themed
- Works with all 5 brands

---

### SP10: Shared Registration Flow (@pay/registration)

**Scope:** CRED-style stacked sheets: name->phone->PAN->bank/UPI->confirm.
**Agent:** superx:coder (parallel with SP4)
**Depends on:** SP2

#### Task 10.1: Registration types + flow

- [ ] Types: RecipientType ('tutor'|'landlord'), RegistrationData, RegistrationFlowProps
- [ ] RegistrationFlow: step state machine, Sheet per step, recipientType switches labels
- [ ] Steps: NameStep, PhoneStep, PANStep, BankStep, ConfirmStep
  - Each: title with recipientLabel, input with validation, "Next" button
  - PAN: XXXXX0000X format validation
  - BankStep: choose bank account (account+IFSC) or UPI
- [ ] Barrel export, test, commit

**Acceptance Criteria:**
- CRED-style one-field-per-sheet
- recipientType switches all labels
- PAN validation
- onComplete returns full RegistrationData

---

## 6. TESTING STRATEGY

| Level | What | Tool |
|---|---|---|
| **Type checking** | Strict mode across all packages | tsc --noEmit per package |
| **Unit** | Brand config, API client, auth storage, validation | Vitest |
| **Component** | PhoneInput, OTPInput, Sheet, Button, RegistrationFlow | Vitest + @testing-library/react |
| **Integration** | Auth flow, registration flow, seller verification | Vitest + MSW |
| **E2E** | Full user journeys per service | Playwright |
| **Build verification** | All 22 combos build without errors | CI matrix |

```bash
pnpm test                    # All unit/component tests
pnpm typecheck               # tsc --noEmit all packages
pnpm build:all               # Build all 22 combos
npx playwright test          # E2E (future)
```

---

## 7. DEPLOYMENT PIPELINE

### PR Checks

1. pnpm install --frozen-lockfile
2. pnpm typecheck
3. pnpm test
4. pnpm build:all (all 22 combos)

### Production

```
main branch merge
  -> CI builds 22 combos in parallel
  -> Each dist/ deployed to <service>.<brand-domain>
  -> CDN cache invalidation
  -> Health check (HTTP 200 per subdomain)
```

### Rollback

Previous dist/ artifacts versioned. Rollback = re-deploy previous version. No DB migrations.

---

## 8. AGENT DISPATCH SUMMARY

| Phase | Sub-Project | Agent | Parallel? | Depends On | Est. Tasks |
|---|---|---|---|---|---|
| **1** | SP1: Monorepo + Brand Config | superx:coder | Solo | None | 9 |
| **2a** | SP2: Shared UI | superx:coder | Parallel | SP1 | 12 |
| **2b** | SP3: API Client | superx:coder | Parallel | SP1 | 5 |
| **2c** | SP10: Registration Flow | superx:coder | Parallel | SP1 | 8 |
| **3** | SP4: Auth Flow | superx:coder | Solo | SP2, SP3 | 8 |
| **4a** | SP5: Wallet | superx:coder | Parallel | SP4 | 15 |
| **4b** | SP6: Education | superx:coder | Parallel | SP4, SP10 | 14 |
| **4c** | SP8: Utility | superx:coder | Parallel | SP4 | 10 |
| **4d** | SP9: Seller Verification | superx:coder | Parallel | SP4 | 12 |
| **5** | SP7: Rent | superx:coder | Solo | SP10, SP4 | 10 |
| **6** | Integration + build matrix | superx:test-runner | Solo | All | 8 |

**Total: ~111 tasks. Max parallelism: 4 agents in Phase 4.**

---

## 9. SERVICE-BRAND DEPLOYMENT MATRIX

| Service \ Brand | superpe.in | spaid.in | kuxdistro.com | mewt.in | slongo.in | Count |
|---|---|---|---|---|---|---|
| wallet | Yes | -- | -- | -- | Yes | 2 |
| education | Yes | Yes | Yes | Yes | Yes | 5 |
| rent | Yes | Yes | Yes | Yes | Yes | 5 |
| utility | Yes | Yes | Yes | Yes | Yes | 5 |
| seller-verification | Yes | Yes | Yes | Yes | Yes | 5 |
| **Total** | 5 | 4 | 4 | 4 | 5 | **22** |

---

## 10. WHAT'S NEEDED FROM USER

| # | Item | Blocking? | Which SP? |
|---|---|---|---|
| 1 | **Target repo location** -- assume /Users/rj/Downloads/pay-platform/? | Yes for SP1 | SP1 |
| 2 | **Brand background images** (5 images) | No (placeholders) | SP2 |
| 3 | **Remaining brand themes** (Spaid/KuxDistro/Mewt/Slongo exact colors/radius) | No (defaults) | SP1 |
| 4 | **OTP API endpoint** -- dev uses localhost:8000 or api.spaid.in? | Clarify | SP4 |
| 5 | **Same API key for all brands?** | Clarify | SP3 |
| 6 | **Production API base URLs** -- per-brand or single api.spaid.in? | Yes for prod | SP3 |
| 7 | **PG integration details** (Juspay? redirect? iframe?) | Yes for payment | SP5-SP8 |
| 8 | **Rent agreement AI verification endpoint** | Yes for SP7 | SP7 |
| 9 | **Encrypted link decryption** -- confirm stays server-side via API? | Yes for SP9 | SP9 |
| 10 | **Hosting platform** (Cloudflare Pages / Vercel / GKE?) | Yes for CI/CD | Infra |
| 11 | **Policy content per entity** (terms, privacy, refund) | No (placeholders) | All |
| 12 | **Wildcard SSL / DNS access** | Yes for prod deploy | Infra |

### Priority Decisions:

1. **Where should the monorepo live?** Default: /Users/rj/Downloads/pay-platform/
2. **Hosting platform?** Determines CI config format
3. **Same backend for all brands?** If yes, just api.spaid.in/backend/v2
4. **Encrypted payload** -- server-side API confirmed? (RSA key must not be in client)

---

## APPENDIX: Key Patterns from Research

### Pattern 1: CSS Variable Brand Injection (from supercheckout)

Supercheckout uses semantic CSS vars (--bg, --bg-raised, --cta-bg, --accent) mapped to Tailwind. BrandProvider injects brand-specific values at mount.

### Pattern 2: Auth Endpoints (confirmed from both repos)

- Send OTP: POST /authentication/app-authenticate/ with { phone, appOrigin }
- Verify: POST /authentication/app-validate/ with { phone, otp, appOrigin }
- Returns: { accessToken } stored as Bearer token

### Pattern 3: Build-Time Brand Selection

```typescript
const brandId = (import.meta.env.VITE_BRAND || 'superpe') as BrandId
```

### Pattern 4: vaul Sheet Pattern (from supercheckout)

```
Drawer.Root > Drawer.Portal > Drawer.Overlay + Drawer.Content
  Content styled with brand --sheet-radius
  Drag handle bar
  Scrollable content area
```

### Pattern 5: Education BBPS Flow (from spaid RN)

State -> City -> School search (Fuse.js) -> Student ID (14-digit) -> Parent mobile + DOB -> Payment.
API: /bbps/cities, /bbps/categories-v2.

### Pattern 6: Seller Verification Port (from receiver-onboarding)

Replace "use server" with client fetch. Replace NextAuth with @pay/auth. Replace next/link with react-router. Encrypted link decryption stays server-side (private RSA key).

---PLAN READY---
