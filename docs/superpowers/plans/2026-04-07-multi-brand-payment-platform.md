# Multi-Brand Payment Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monorepo of Vite+React webapps (wallet, education, seller-verification) sharing code but styled per-brand, deployed to subdomains like `wallet.superpe.in` and `education.spaid.in`.

**Architecture:** pnpm monorepo with shared packages (`brand-config`, `ui`, `auth`, `utils`) consumed by independent Vite apps (`wallet`, `education`, `seller-verification`). Brand is detected at runtime from subdomain hostname. CSS custom properties driven by brand config provide per-brand theming (colors, border-radius, fonts, backgrounds) with zero code changes between deployments.

**Tech Stack:** Vite 6, React 19, TypeScript, Tailwind CSS 4, Zustand, Framer Motion, React Router 7, pnpm workspaces

---

## Brand Reference

| Brand | Entity Name | Domain | Accent | Primary | Border Radius | Background Style |
|-------|-------------|--------|--------|---------|---------------|-----------------|
| superpe | SuperPE Marketplace Pvt Ltd | superpe.in | `#266EF1` | `#FFFFFF` | `0px` | Line illustration |
| spaid | Spaid ESolutions Private Limited | spaid.in | TBD | TBD | `16px` | Complicated color pattern |
| kux | KuxDistro Technology Private Limited | kux.in | TBD | TBD | `12px` | Black & white photo |
| mewt | Mewt Account Pvt Ltd | mewt.in | TBD | TBD | `8px` | TBD |
| slongo | Slongo Technology Pvt Ltd | slongo.in | TBD | TBD | `8px` | TBD |

## Service-Brand Matrix

| Service | superpe | spaid | kux | mewt | slongo |
|---------|---------|-------|-----|------|--------|
| Wallet | YES | - | - | - | YES |
| Education | YES | YES | YES | YES | YES |
| Seller Verification | YES | YES | YES | YES | YES |
| Rent | TBD | TBD | TBD | TBD | TBD |
| Utility | TBD | TBD | TBD | TBD | TBD |

## Subdomain Pattern

```
<service>.<brand-domain>
```

Examples: `wallet.superpe.in`, `education.spaid.in`, `seller-verification.kux.in`

Dev: `localhost:5173` with `?brand=superpe` query param override.

---

## File Structure

```
brandpay/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml                   # Workspace definition
├── tsconfig.base.json                    # Shared TypeScript config
├── packages/
│   ├── brand-config/                     # Brand detection + theme injection
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                  # Public exports
│   │   │   ├── types.ts                  # BrandKey, BrandConfig types
│   │   │   ├── brands.ts                 # All 5 brand definitions
│   │   │   ├── detect.ts                 # Runtime subdomain -> brand detection
│   │   │   ├── theme.ts                  # Inject CSS custom properties
│   │   │   └── policies.ts              # Brand-specific policy metadata
│   │   └── assets/
│   │       ├── bg-superpe.svg            # Line illustration background
│   │       ├── bg-spaid.svg              # Color pattern background
│   │       ├── bg-kux.jpg                # B&W photo background
│   │       ├── logo-superpe.svg          # Brand logos
│   │       ├── logo-spaid.svg
│   │       ├── logo-kux.svg
│   │       ├── logo-mewt.svg
│   │       └── logo-slongo.svg
│   ├── ui/                               # Shared UI component library
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── BottomSheet.tsx           # Sheet-based modal (brand-aware border-radius)
│   │   │   ├── OTPInput.tsx              # OTP digit boxes
│   │   │   ├── PhoneInput.tsx            # +91 phone input
│   │   │   ├── Button.tsx                # Branded button variants
│   │   │   ├── NumberPad.tsx             # Numeric keypad
│   │   │   ├── SearchInput.tsx           # Search field
│   │   │   ├── BrandHeader.tsx           # Header with brand logo + menu
│   │   │   ├── BottomNav.tsx             # Mobile bottom navigation
│   │   │   ├── PinInput.tsx              # PIN entry
│   │   │   ├── BrandBackground.tsx       # Full-screen brand background
│   │   │   └── PolicyPage.tsx            # Generic policy renderer
│   │   └── tailwind.css                  # Component-level Tailwind
│   ├── auth/                             # Shared OTP authentication
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── LoginFlow.tsx             # Phone -> OTP -> authenticated (sheet-based)
│   │       ├── PhoneStep.tsx             # Phone number entry sheet
│   │       ├── OtpStep.tsx               # OTP verification sheet
│   │       ├── api.ts                    # OTP send/verify API calls
│   │       ├── store.ts                  # Auth Zustand store (session, merchant)
│   │       ├── guard.tsx                 # Route guard component
│   │       └── types.ts                  # Auth types
│   └── utils/                            # Shared utilities
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── api.ts                    # Generic API caller with auth headers
│           ├── formatters.ts             # Currency, date, phone formatters
│           └── storage.ts               # Session storage helpers
├── apps/
│   ├── wallet/                           # Wallet webapp (superpe + slongo)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── tailwind.css
│   │   └── src/
│   │       ├── main.tsx                  # Entry point + brand init
│   │       ├── App.tsx                   # Router + providers
│   │       ├── router.tsx                # Route definitions
│   │       ├── pages/
│   │       │   ├── LoginPage.tsx
│   │       │   ├── DashboardPage.tsx     # Balance, quick actions, recent txns
│   │       │   ├── AddMoneyPage.tsx      # Amount selection + payment gateway
│   │       │   ├── SendMoneyPage.tsx     # 4-step P2P transfer
│   │       │   ├── HistoryPage.tsx       # Transaction history
│   │       │   ├── ProfilePage.tsx       # User profile + KYC
│   │       │   └── PolicyPage.tsx        # Dynamic policy display
│   │       ├── components/
│   │       │   ├── WalletCard.tsx        # Balance card display
│   │       │   ├── QuickActions.tsx      # Add Money, Send, Beneficiaries, Settings
│   │       │   ├── TransactionList.tsx   # Recent transaction items
│   │       │   ├── TransactionItem.tsx   # Single transaction row
│   │       │   ├── KycSheet.tsx          # KYC initiation/status sheet
│   │       │   ├── BeneficiarySheet.tsx  # Beneficiary list sheet
│   │       │   ├── BeneficiaryDetail.tsx # Single beneficiary detail
│   │       │   ├── AddBeneficiarySheet.tsx
│   │       │   ├── PaymentStatusSheet.tsx
│   │       │   └── SettingsSheet.tsx     # Wallet settings
│   │       ├── store/
│   │       │   ├── wallet.ts            # Wallet balance, KYC status
│   │       │   ├── recipient.ts         # Current P2P recipient
│   │       │   └── ui.ts               # Modal/sheet open states
│   │       ├── api/
│   │       │   └── endpoints.ts         # Wallet-specific API endpoints
│   │       └── constants/
│   │           └── policies.ts          # Wallet policy content
│   ├── education/                        # Education webapp (all brands)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── tailwind.css
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── router.tsx
│   │       ├── pages/
│   │       │   ├── LoginPage.tsx
│   │       │   ├── HomePage.tsx          # Choose: School/Institute or Tutor
│   │       │   ├── SchoolPayPage.tsx     # School/institute payment flow
│   │       │   └── TutorRegisterPage.tsx # Tutor registration (CRED-style)
│   │       ├── components/
│   │       │   ├── ServiceCard.tsx       # School vs Tutor selection cards
│   │       │   ├── TutorRegistrationSheet.tsx  # "Requires registration" sheet
│   │       │   ├── CredStyleFlow.tsx     # Multi-step tutor registration (CRED-style)
│   │       │   ├── SchoolSearchSheet.tsx # Search for school/institute
│   │       │   └── PaymentSheet.tsx      # Amount entry + pay
│   │       ├── store/
│   │       │   └── education.ts         # Education-specific state
│   │       └── api/
│   │           └── endpoints.ts
│   └── seller-verification/              # Seller/receiver onboarding (all brands)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       ├── tailwind.css
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── router.tsx
│           ├── pages/
│           │   ├── OnboardingPage.tsx    # Encrypted link entry point
│           │   ├── ConsentPage.tsx       # Consent flow
│           │   └── PolicyPage.tsx
│           ├── components/
│           │   ├── OTPVerification.tsx   # OTP verify with transaction context
│           │   ├── OnboardingDetails.tsx # Bank/UPI details display
│           │   ├── SuccessScreen.tsx     # Onboarding complete
│           │   └── ExpiryTimer.tsx       # 72-hour countdown
│           ├── store/
│           │   └── onboarding.ts        # Onboarding state
│           ├── api/
│           │   ├── endpoints.ts
│           │   └── crypto.ts            # Calls backend decrypt endpoint
│           └── constants/
│               └── policies.ts
└── policies/                             # Shared policy markdown content
    ├── superpe/
    │   ├── terms-of-service.md
    │   ├── privacy-policy.md
    │   └── refund-policy.md
    ├── spaid/
    │   ├── terms-of-service.md
    │   └── privacy-policy.md
    └── ... (per brand)
```

---

## Phase 1: Monorepo Foundation + Brand Config

### Task 1.1: Initialize pnpm Monorepo

**Files:**
- Create: `brandpay/package.json`
- Create: `brandpay/pnpm-workspace.yaml`
- Create: `brandpay/tsconfig.base.json`
- Create: `brandpay/.gitignore`

- [ ] **Step 1: Create repo and root package.json**

```bash
mkdir brandpay && cd brandpay && git init
```

```json
// package.json
{
  "name": "brandpay",
  "private": true,
  "scripts": {
    "dev:wallet": "pnpm --filter @brandpay/wallet dev",
    "dev:education": "pnpm --filter @brandpay/education dev",
    "dev:seller": "pnpm --filter @brandpay/seller-verification dev",
    "build": "pnpm -r build",
    "build:wallet": "pnpm --filter @brandpay/wallet build",
    "build:education": "pnpm --filter @brandpay/education build",
    "build:seller": "pnpm --filter @brandpay/seller-verification build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

- [ ] **Step 2: Create pnpm workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: Create shared TypeScript config**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 5: Install root devDependencies**

```bash
pnpm add -D -w typescript @types/node
```

Run: `pnpm install`
Expected: Clean install, `pnpm-lock.yaml` created.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: init pnpm monorepo with workspace config"
```

---

### Task 1.2: Brand Config Package

**Files:**
- Create: `packages/brand-config/package.json`
- Create: `packages/brand-config/tsconfig.json`
- Create: `packages/brand-config/src/types.ts`
- Create: `packages/brand-config/src/brands.ts`
- Create: `packages/brand-config/src/detect.ts`
- Create: `packages/brand-config/src/theme.ts`
- Create: `packages/brand-config/src/policies.ts`
- Create: `packages/brand-config/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
// packages/brand-config/package.json
{
  "name": "@brandpay/brand-config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create types**

```typescript
// packages/brand-config/src/types.ts

export type BrandKey = 'superpe' | 'spaid' | 'kux' | 'mewt' | 'slongo';

export type ServiceKey = 'wallet' | 'education' | 'seller-verification' | 'rent' | 'utility';

export interface BrandConfig {
  key: BrandKey;
  entityName: string;
  domain: string;
  accent: string;
  accentForeground: string;
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  borderRadius: string;
  borderRadiusSm: string;
  fontFamily: string;
  backgroundImage: string | null;
  backgroundStyle: 'line-illustration' | 'color-pattern' | 'bw-photo' | 'solid' | 'gradient';
  services: ServiceKey[];
  otpProvider: string;
  otpCompany: string;
}

export interface PolicyMeta {
  slug: string;
  title: string;
  brandTitle: string;
}
```

- [ ] **Step 3: Create brand definitions**

```typescript
// packages/brand-config/src/brands.ts
import type { BrandKey, BrandConfig } from './types';

export const BRANDS: Record<BrandKey, BrandConfig> = {
  superpe: {
    key: 'superpe',
    entityName: 'SuperPE Marketplace Pvt Ltd',
    domain: 'superpe.in',
    accent: '#266EF1',
    accentForeground: '#FFFFFF',
    primary: '#FFFFFF',
    primaryForeground: '#111111',
    background: '#F8F9FA',
    foreground: '#111111',
    muted: '#F1F3F5',
    mutedForeground: '#6B7280',
    borderRadius: '0px',
    borderRadiusSm: '0px',
    fontFamily: "'Inter', system-ui, sans-serif",
    backgroundImage: '/assets/bg-superpe.svg',
    backgroundStyle: 'line-illustration',
    services: ['wallet', 'education', 'seller-verification'],
    otpProvider: 'twilio',
    otpCompany: 'SuperPE',
  },
  spaid: {
    key: 'spaid',
    entityName: 'Spaid ESolutions Private Limited',
    domain: 'spaid.in',
    accent: '#7C3AED',
    accentForeground: '#FFFFFF',
    primary: '#FFFFFF',
    primaryForeground: '#111111',
    background: '#FAF5FF',
    foreground: '#111111',
    muted: '#F3E8FF',
    mutedForeground: '#6B7280',
    borderRadius: '16px',
    borderRadiusSm: '8px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    backgroundImage: '/assets/bg-spaid.svg',
    backgroundStyle: 'color-pattern',
    services: ['education', 'seller-verification'],
    otpProvider: 'twilio',
    otpCompany: 'Spaid',
  },
  kux: {
    key: 'kux',
    entityName: 'KuxDistro Technology Private Limited',
    domain: 'kux.in',
    accent: '#18181B',
    accentForeground: '#FFFFFF',
    primary: '#FFFFFF',
    primaryForeground: '#18181B',
    background: '#FAFAFA',
    foreground: '#18181B',
    muted: '#F4F4F5',
    mutedForeground: '#71717A',
    borderRadius: '12px',
    borderRadiusSm: '6px',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    backgroundImage: '/assets/bg-kux.jpg',
    backgroundStyle: 'bw-photo',
    services: ['education', 'seller-verification'],
    otpProvider: 'twilio',
    otpCompany: 'KuxDistro',
  },
  mewt: {
    key: 'mewt',
    entityName: 'Mewt Account Pvt Ltd',
    domain: 'mewt.in',
    accent: '#059669',
    accentForeground: '#FFFFFF',
    primary: '#FFFFFF',
    primaryForeground: '#111111',
    background: '#F0FDF4',
    foreground: '#111111',
    muted: '#DCFCE7',
    mutedForeground: '#6B7280',
    borderRadius: '8px',
    borderRadiusSm: '4px',
    fontFamily: "'Inter', system-ui, sans-serif",
    backgroundImage: null,
    backgroundStyle: 'solid',
    services: ['education', 'seller-verification'],
    otpProvider: 'twilio',
    otpCompany: 'Mewt',
  },
  slongo: {
    key: 'slongo',
    entityName: 'Slongo Technology Pvt Ltd',
    domain: 'slongo.in',
    accent: '#DC2626',
    accentForeground: '#FFFFFF',
    primary: '#FFFFFF',
    primaryForeground: '#111111',
    background: '#FFFBEB',
    foreground: '#111111',
    muted: '#FEF3C7',
    mutedForeground: '#6B7280',
    borderRadius: '8px',
    borderRadiusSm: '4px',
    fontFamily: "'Inter', system-ui, sans-serif",
    backgroundImage: null,
    backgroundStyle: 'gradient',
    services: ['wallet', 'education', 'seller-verification'],
    otpProvider: 'twilio',
    otpCompany: 'Slongo',
  },
};
```

- [ ] **Step 4: Create brand detection**

```typescript
// packages/brand-config/src/detect.ts
import type { BrandKey } from './types';
import { BRANDS } from './brands';

/**
 * Detect brand from current hostname.
 * wallet.superpe.in -> 'superpe'
 * education.spaid.in -> 'spaid'
 * localhost:5173?brand=superpe -> 'superpe' (dev override)
 */
export function detectBrand(): BrandKey {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('brand');
    if (override && override in BRANDS) {
      return override as BrandKey;
    }
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  for (const [key, brand] of Object.entries(BRANDS)) {
    if (hostname.endsWith(brand.domain) || hostname.includes(brand.domain)) {
      return key as BrandKey;
    }
  }

  return 'superpe';
}

export function detectService(): string {
  if (typeof window === 'undefined') return 'unknown';

  const params = new URLSearchParams(window.location.search);
  const override = params.get('service');
  if (override) return override;

  const hostname = window.location.hostname;
  const firstPart = hostname.split('.')[0];

  if (['wallet', 'education', 'seller-verification', 'rent', 'utility'].includes(firstPart)) {
    return firstPart;
  }

  return 'unknown';
}
```

- [ ] **Step 5: Create theme injector**

```typescript
// packages/brand-config/src/theme.ts
import type { BrandConfig } from './types';

export function applyBrandTheme(brand: BrandConfig): void {
  const root = document.documentElement;

  root.style.setProperty('--brand-accent', brand.accent);
  root.style.setProperty('--brand-accent-fg', brand.accentForeground);
  root.style.setProperty('--brand-primary', brand.primary);
  root.style.setProperty('--brand-primary-fg', brand.primaryForeground);
  root.style.setProperty('--brand-background', brand.background);
  root.style.setProperty('--brand-foreground', brand.foreground);
  root.style.setProperty('--brand-muted', brand.muted);
  root.style.setProperty('--brand-muted-fg', brand.mutedForeground);
  root.style.setProperty('--brand-radius', brand.borderRadius);
  root.style.setProperty('--brand-radius-sm', brand.borderRadiusSm);
  root.style.setProperty('--brand-font', brand.fontFamily);

  if (brand.backgroundImage) {
    root.style.setProperty('--brand-bg-image', `url(${brand.backgroundImage})`);
  } else {
    root.style.setProperty('--brand-bg-image', 'none');
  }
}
```

- [ ] **Step 6: Create policy metadata**

```typescript
// packages/brand-config/src/policies.ts
import type { BrandKey, PolicyMeta } from './types';

const POLICY_OVERRIDES: Partial<Record<BrandKey, Partial<Record<string, string>>>> = {
  superpe: {
    'terms-of-service': 'SuperPE Terms of Service',
    'privacy-policy': 'SuperPE Privacy Policy',
    'refund-policy': 'SuperPE Refund & Cancellation Policy',
  },
  spaid: {
    'terms-of-service': 'Spaid Terms of Service',
    'privacy-policy': 'Spaid Privacy Policy',
    'refund-policy': 'Spaid Refund Policy',
  },
  kux: {
    'terms-of-service': 'KuxDistro Terms of Service',
    'privacy-policy': 'KuxDistro Privacy Policy',
  },
  mewt: {
    'terms-of-service': 'Mewt Terms of Service',
    'privacy-policy': 'Mewt Privacy Policy',
  },
  slongo: {
    'terms-of-service': 'Slongo Terms of Service',
    'privacy-policy': 'Slongo Privacy Policy',
  },
};

const DEFAULT_TITLES: Record<string, string> = {
  'terms-of-service': 'Terms of Service',
  'privacy-policy': 'Privacy Policy',
  'refund-policy': 'Refund & Cancellation Policy',
  'shipping-policy': 'Shipping & Delivery Policy',
  'grievance-policy': 'Grievance Redressal Policy',
};

export function getPolicies(brand: BrandKey): PolicyMeta[] {
  const overrides = POLICY_OVERRIDES[brand] ?? {};
  return Object.entries(DEFAULT_TITLES).map(([slug, title]) => ({
    slug,
    title,
    brandTitle: overrides[slug] ?? title,
  }));
}
```

- [ ] **Step 7: Create barrel export**

```typescript
// packages/brand-config/src/index.ts
export { BRANDS } from './brands';
export { detectBrand, detectService } from './detect';
export { applyBrandTheme } from './theme';
export { getPolicies } from './policies';
export type { BrandKey, BrandConfig, ServiceKey, PolicyMeta } from './types';
```

- [ ] **Step 8: Create tsconfig.json**

```json
// packages/brand-config/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 9: Commit**

```bash
git add packages/brand-config/
git commit -m "feat: add brand-config package with 5 brand definitions, detection, and theme injection"
```

---

### Task 1.3: Shared Utils Package

**Files:**
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/src/api.ts`
- Create: `packages/utils/src/formatters.ts`
- Create: `packages/utils/src/storage.ts`
- Create: `packages/utils/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
// packages/utils/package.json
{
  "name": "@brandpay/utils",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create API caller**

```typescript
// packages/utils/src/api.ts

interface ApiCallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  sessionId?: string;
  merchantId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

export async function apiCall<T>(options: ApiCallOptions): Promise<ApiResponse<T>> {
  const { method, url, data, params, headers = {}, sessionId, merchantId } = options;

  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const fullUrl = url + queryString;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (sessionId) requestHeaders['session-id'] = sessionId;
  if (merchantId) requestHeaders['merchant-id'] = merchantId;

  try {
    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      return { success: false, data: null, error: json.message ?? 'Request failed', status: response.status };
    }

    return { success: true, data: json as T, error: null, status: response.status };
  } catch (err) {
    return { success: false, data: null, error: (err as Error).message, status: 0 };
  }
}
```

- [ ] **Step 3: Create formatters**

```typescript
// packages/utils/src/formatters.ts

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    return `****${last4}`;
  }
  return phone;
}
```

- [ ] **Step 4: Create storage helpers**

```typescript
// packages/utils/src/storage.ts

export function getSessionItem<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: unknown): void {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function clearSession(): void {
  sessionStorage.clear();
}
```

- [ ] **Step 5: Create barrel export and tsconfig**

```typescript
// packages/utils/src/index.ts
export { apiCall } from './api';
export type { ApiResponse } from './api';
export { formatCurrency, formatPhone, formatDate, maskPhone } from './formatters';
export { getSessionItem, setSessionItem, clearSession } from './storage';
```

```json
// packages/utils/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/utils/
git commit -m "feat: add shared utils package with API caller, formatters, storage helpers"
```

---

### Task 1.4: Shared Auth Package

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/types.ts`
- Create: `packages/auth/src/api.ts`
- Create: `packages/auth/src/store.ts`
- Create: `packages/auth/src/LoginFlow.tsx`
- Create: `packages/auth/src/PhoneStep.tsx`
- Create: `packages/auth/src/OtpStep.tsx`
- Create: `packages/auth/src/guard.tsx`
- Create: `packages/auth/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
// packages/auth/package.json
{
  "name": "@brandpay/auth",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "zustand": "^5.0.0",
    "framer-motion": "^12.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create auth types**

```typescript
// packages/auth/src/types.ts

export interface AuthUser {
  merchantId: string;
  phone: string;
  name: string;
  email?: string;
  kycCompleted?: boolean;
}

export interface AuthState {
  sessionId: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (sessionId: string, user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export interface OTPSendRequest {
  to: string;
  company: string;
  channel: 'SMS' | 'WHATSAPP';
  provider: string;
}

export interface OTPSendResponse {
  success: boolean;
  message: string;
}

export interface OTPValidateResponse {
  sessionId: string;
  merchantId: string;
  name: string;
  phone: string;
  email?: string;
}
```

- [ ] **Step 3: Create auth API**

```typescript
// packages/auth/src/api.ts
import type { OTPSendRequest, OTPSendResponse, OTPValidateResponse } from './types';

const OTP_BASE_URL = import.meta.env.VITE_OTP_API_URL ?? 'http://localhost:8000';
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:8000';

export async function sendOTP(request: OTPSendRequest): Promise<OTPSendResponse> {
  const response = await fetch(`${OTP_BASE_URL}/api/v1/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function validateOTP(phone: string, otp: string): Promise<OTPValidateResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/backend/v2/authentication/app-validate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, token: otp, source: 'web' }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message ?? 'OTP validation failed');
  }

  return response.json();
}

export async function createMerchant(sessionId: string, phone: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/backend/v2/merchant/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'session-id': sessionId,
    },
    body: JSON.stringify({ phone }),
  });
  return response.json();
}

export async function getMerchantDetails(sessionId: string, merchantId: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/backend/v2/merchant/get-details/`, {
    method: 'GET',
    headers: {
      'session-id': sessionId,
      'merchant-id': merchantId,
    },
  });
  return response.json();
}
```

- [ ] **Step 4: Create auth Zustand store**

```typescript
// packages/auth/src/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState } from './types';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionId: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (sessionId, user) =>
        set({ sessionId, user, isAuthenticated: true, isLoading: false }),
      clearAuth: () =>
        set({ sessionId: null, user: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'brandpay-auth',
      storage: {
        getItem: (name) => {
          const item = sessionStorage.getItem(name);
          return item ? JSON.parse(item) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
```

- [ ] **Step 5: Create PhoneStep component**

```tsx
// packages/auth/src/PhoneStep.tsx
import { useState, type FormEvent } from 'react';

interface PhoneStepProps {
  onSubmit: (phone: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function PhoneStep({ onSubmit, isLoading, error }: PhoneStepProps) {
  const [phone, setPhone] = useState('');
  const isValid = /^[6-9]\d{9}$/.test(phone);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isValid) onSubmit('+91' + phone);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--brand-foreground)' }}>
          Welcome
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-muted-fg)' }}>
          Enter your phone number to continue
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-lg font-medium px-3 py-3 shrink-0"
          style={{
            background: 'var(--brand-muted)',
            borderRadius: 'var(--brand-radius-sm)',
            color: 'var(--brand-foreground)',
          }}
        >
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="Phone number"
          autoFocus
          className="w-full text-lg py-3 px-4 outline-none transition-colors"
          style={{
            background: 'var(--brand-muted)',
            borderRadius: 'var(--brand-radius-sm)',
            color: 'var(--brand-foreground)',
          }}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full py-3.5 text-base font-medium transition-opacity disabled:opacity-40"
        style={{
          background: 'var(--brand-accent)',
          color: 'var(--brand-accent-fg)',
          borderRadius: 'var(--brand-radius-sm)',
        }}
      >
        {isLoading ? 'Sending OTP...' : 'Continue'}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create OtpStep component**

```tsx
// packages/auth/src/OtpStep.tsx
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface OtpStepProps {
  phone: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
  otpLength?: number;
}

export function OtpStep({ phone, onSubmit, onResend, onBack, isLoading, error, otpLength = 6 }: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(otpLength).fill(''));
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === otpLength && digits.every((d) => d !== '')) {
      onSubmit(otp);
    }
  }, [digits, otpLength, onSubmit]);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleResend() {
    onResend();
    setResendCooldown(30);
  }

  const maskedPhone = phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <button onClick={onBack} className="text-sm mb-4" style={{ color: 'var(--brand-accent)' }}>
          &larr; Back
        </button>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--brand-foreground)' }}>Verify OTP</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-muted-fg)' }}>
          Enter the code sent to {maskedPhone}
        </p>
      </div>

      <div className="flex gap-3 justify-center">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-xl font-semibold outline-none transition-colors"
            style={{
              background: 'var(--brand-muted)',
              borderRadius: 'var(--brand-radius-sm)',
              color: 'var(--brand-foreground)',
              border: digit ? '2px solid var(--brand-accent)' : '2px solid transparent',
            }}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      {isLoading && <p className="text-sm text-center" style={{ color: 'var(--brand-muted-fg)' }}>Verifying...</p>}

      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-sm" style={{ color: 'var(--brand-muted-fg)' }}>Resend in {resendCooldown}s</p>
        ) : (
          <button onClick={handleResend} className="text-sm font-medium" style={{ color: 'var(--brand-accent)' }}>Resend OTP</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create LoginFlow orchestrator**

```tsx
// packages/auth/src/LoginFlow.tsx
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandConfig } from '@brandpay/brand-config';
import { PhoneStep } from './PhoneStep';
import { OtpStep } from './OtpStep';
import { sendOTP, validateOTP, createMerchant, getMerchantDetails } from './api';
import { useAuthStore } from './store';

interface LoginFlowProps {
  brand: BrandConfig;
  onSuccess: () => void;
}

type Step = 'phone' | 'otp';

export function LoginFlow({ brand, onSuccess }: LoginFlowProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handlePhoneSubmit(phoneNumber: string) {
    setPhone(phoneNumber);
    setIsLoading(true);
    setError(null);
    try {
      await sendOTP({ to: phoneNumber, company: brand.otpCompany, channel: 'SMS', provider: brand.otpProvider });
      setStep('otp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOtpSubmit = useCallback(async (otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const validated = await validateOTP(phone, otp);
      const merchant = await createMerchant(validated.sessionId, phone);
      const details = await getMerchantDetails(validated.sessionId, merchant.merchantId ?? validated.merchantId);
      setAuth(validated.sessionId, {
        merchantId: merchant.merchantId ?? validated.merchantId,
        phone,
        name: details.name ?? '',
        email: details.email,
        kycCompleted: details.kycCompleted,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [phone, setAuth, onSuccess]);

  function handleResend() {
    sendOTP({ to: phone, company: brand.otpCompany, channel: 'SMS', provider: brand.otpProvider });
  }

  return (
    <AnimatePresence mode="wait">
      {step === 'phone' && (
        <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <PhoneStep onSubmit={handlePhoneSubmit} isLoading={isLoading} error={error} />
        </motion.div>
      )}
      {step === 'otp' && (
        <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <OtpStep phone={phone} onSubmit={handleOtpSubmit} onResend={handleResend} onBack={() => { setStep('phone'); setError(null); }} isLoading={isLoading} error={error} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 8: Create auth route guard and barrel export**

```tsx
// packages/auth/src/guard.tsx
import { type ReactNode } from 'react';
import { useAuthStore } from './store';

interface AuthGuardProps {
  children: ReactNode;
  fallback: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}
```

```typescript
// packages/auth/src/index.ts
export { LoginFlow } from './LoginFlow';
export { PhoneStep } from './PhoneStep';
export { OtpStep } from './OtpStep';
export { AuthGuard } from './guard';
export { useAuthStore } from './store';
export { sendOTP, validateOTP, createMerchant, getMerchantDetails } from './api';
export type { AuthUser, AuthState, OTPSendRequest } from './types';
```

- [ ] **Step 9: Commit**

```bash
git add packages/auth/
git commit -m "feat: add shared auth package with OTP login flow, Zustand store, and route guard"
```

---

### Task 1.5: Shared UI Components Package

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/src/BottomSheet.tsx`
- Create: `packages/ui/src/Button.tsx`
- Create: `packages/ui/src/BrandBackground.tsx`
- Create: `packages/ui/src/BrandHeader.tsx`
- Create: `packages/ui/src/BottomNav.tsx`
- Create: `packages/ui/src/NumberPad.tsx`
- Create: `packages/ui/src/SearchInput.tsx`
- Create: `packages/ui/src/PolicyPage.tsx`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@brandpay/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": { "framer-motion": "^12.0.0" },
  "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }
}
```

- [ ] **Step 2: Create BottomSheet (core sheet component)**

```tsx
// packages/ui/src/BottomSheet.tsx
import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  fullHeight?: boolean;
}

export function BottomSheet({ open, onClose, children, title, fullHeight }: BottomSheetProps) {
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto"
            style={{
              maxHeight: fullHeight ? '95vh' : '85vh',
              background: 'var(--brand-primary)',
              borderTopLeftRadius: 'var(--brand-radius)',
              borderTopRightRadius: 'var(--brand-radius)',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--brand-muted)' }} />
            </div>
            {title && (
              <div className="px-6 pb-2">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--brand-foreground)' }}>{title}</h3>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Create Button, BrandBackground, BrandHeader, BottomNav, NumberPad, SearchInput**

All follow the same pattern: use `var(--brand-*)` CSS custom properties for colors and radii. See the file structure section for component responsibilities. Each component is brand-aware through CSS variables -- no brand prop needed for styling.

- [ ] **Step 4: Create PolicyPage (safe text rendering)**

```tsx
// packages/ui/src/PolicyPage.tsx
interface PolicyPageProps {
  title: string;
  paragraphs: string[];
  onBack: () => void;
}

export function PolicyPage({ title, paragraphs, onBack }: PolicyPageProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-primary)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--brand-muted)' }}>
        <button onClick={onBack} className="text-sm mb-2" style={{ color: 'var(--brand-accent)' }}>&larr; Back</button>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-foreground)' }}>{title}</h1>
      </div>
      <div className="p-4 space-y-4">
        {paragraphs.map((text, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--brand-foreground)' }}>{text}</p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create barrel export and tsconfig**

```typescript
// packages/ui/src/index.ts
export { BottomSheet } from './BottomSheet';
export { Button } from './Button';
export { BrandBackground } from './BrandBackground';
export { BrandHeader } from './BrandHeader';
export { BottomNav } from './BottomNav';
export { NumberPad } from './NumberPad';
export { SearchInput } from './SearchInput';
export { PolicyPage } from './PolicyPage';
```

- [ ] **Step 6: Install dependencies and commit**

```bash
pnpm install
git add packages/ui/
git commit -m "feat: add shared UI components package with BottomSheet, Button, and brand-aware layout"
```

---

## Phase 2: Wallet App (SuperPE + Slongo)

> Ported from mewt-app/wallet-supercheckout (Next.js) to Vite + React Router.
> Flow: OTP login -> dashboard -> add money / send money / history / profile.

### Task 2.1: Wallet App Scaffold

**Files:**
- Create: `apps/wallet/package.json`
- Create: `apps/wallet/vite.config.ts`
- Create: `apps/wallet/tsconfig.json`
- Create: `apps/wallet/index.html`
- Create: `apps/wallet/tailwind.css`
- Create: `apps/wallet/src/main.tsx`
- Create: `apps/wallet/src/App.tsx`
- Create: `apps/wallet/src/router.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@brandpay/wallet",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@brandpay/brand-config": "workspace:*",
    "@brandpay/ui": "workspace:*",
    "@brandpay/auth": "workspace:*",
    "@brandpay/utils": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "zustand": "^5.0.0",
    "framer-motion": "^12.0.0",
    "react-hot-toast": "^2.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts, index.html, tailwind.css**

```typescript
// apps/wallet/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
});
```

```css
/* apps/wallet/tailwind.css */
@import "tailwindcss";

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--brand-font, 'Inter', system-ui, sans-serif);
  background: var(--brand-background, #f8f9fa);
  color: var(--brand-foreground, #111);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Create main.tsx (brand init + render)**

```tsx
// apps/wallet/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { detectBrand, BRANDS, applyBrandTheme } from '@brandpay/brand-config';
import { App } from './App';
import '../tailwind.css';

const brandKey = detectBrand();
const brand = BRANDS[brandKey];
applyBrandTheme(brand);
document.title = `Wallet | ${brand.otpCompany}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode><App brand={brand} /></StrictMode>
);
```

- [ ] **Step 4: Create App.tsx and router.tsx**

App wraps everything in BrowserRouter + BrandBackground + AuthGuard. The login sheet slides up from the bottom (sheet-based UI). Router defines: `/` (dashboard), `/add-money`, `/pay`, `/history`, `/profile`.

- [ ] **Step 5: Install and verify**

```bash
pnpm install && pnpm --filter @brandpay/wallet dev
```

Expected: Vite starts on localhost:5173, shows login. `?brand=slongo` switches theme.

- [ ] **Step 6: Commit**

```bash
git add apps/wallet/
git commit -m "feat: scaffold wallet app with Vite, brand init, router, and auth guard"
```

---

### Task 2.2: Wallet Stores + API Layer

**Files:**
- Create: `apps/wallet/src/api/endpoints.ts` -- All wallet backend endpoints (check, KYC, beneficiaries, transfer, add-money, etc.)
- Create: `apps/wallet/src/store/wallet.ts` -- Zustand store with balance, transactions, beneficiaries, and async fetch methods
- Create: `apps/wallet/src/store/recipient.ts` -- Current P2P transfer recipient
- Create: `apps/wallet/src/store/ui.ts` -- Map-based sheet/modal open states

- [ ] **Step 1-4:** Create each file following the wallet-supercheckout patterns (see `ENDPOINTS` in source repo `/src/constants/endpoints.ts` and stores in `/src/store/slices/`). Port to plain `fetch` instead of `apiCall` via Next.js server actions.

- [ ] **Step 5: Commit**

```bash
git add apps/wallet/src/api/ apps/wallet/src/store/
git commit -m "feat: add wallet stores and API endpoints"
```

---

### Task 2.3: Wallet Pages + Components

**Files:**
- Create: `apps/wallet/src/pages/DashboardPage.tsx` -- WalletCard + QuickActions + recent transactions
- Create: `apps/wallet/src/pages/AddMoneyPage.tsx` -- Preset amounts + NumberPad + payment gateway redirect
- Create: `apps/wallet/src/pages/SendMoneyPage.tsx` -- 4-step P2P: recipient search -> amount -> confirm -> OTP
- Create: `apps/wallet/src/pages/HistoryPage.tsx` -- Full transaction list with date headers
- Create: `apps/wallet/src/pages/ProfilePage.tsx` -- User info sections + policy links + logout
- Create: `apps/wallet/src/components/WalletCard.tsx` -- Balance display on accent bg
- Create: `apps/wallet/src/components/QuickActions.tsx` -- 4 icon buttons grid
- Create: `apps/wallet/src/components/TransactionList.tsx` + `TransactionItem.tsx`

- [ ] **Steps 1-6:** Create each page/component following wallet-supercheckout patterns, using shared `@brandpay/ui` components (BottomSheet, Button, NumberPad, SearchInput) and CSS custom properties for all brand-specific styling.

- [ ] **Step 7: Verify full wallet flow**

```bash
pnpm --filter @brandpay/wallet dev
```

Test: Login -> Dashboard -> Add Money -> Send Money -> History -> Profile. Switch brand with `?brand=slongo`.

- [ ] **Step 8: Commit**

```bash
git add apps/wallet/
git commit -m "feat: complete wallet app with all pages and components"
```

---

## Phase 3: Seller Verification App (All Brands)

> Ported from mewt-app/receiver-onboarding (Next.js) to Vite + React Router.
> Flow: Encrypted link -> OTP verification -> Bank/UPI details -> Onboarding complete.

### Task 3.1: Seller Verification App Scaffold + Flow

**Files:**
- Create: `apps/seller-verification/package.json` (same deps as wallet, port 5174)
- Create: `apps/seller-verification/vite.config.ts`
- Create: `apps/seller-verification/index.html`, `tailwind.css`
- Create: `apps/seller-verification/src/main.tsx`, `App.tsx`, `router.tsx`
- Create: `apps/seller-verification/src/api/crypto.ts` -- Calls backend decrypt endpoint (NOT client-side RSA)
- Create: `apps/seller-verification/src/api/endpoints.ts` -- Backend endpoints
- Create: `apps/seller-verification/src/store/onboarding.ts` -- Step state machine
- Create: `apps/seller-verification/src/components/OTPVerification.tsx`
- Create: `apps/seller-verification/src/components/OnboardingDetails.tsx`
- Create: `apps/seller-verification/src/components/SuccessScreen.tsx`
- Create: `apps/seller-verification/src/pages/OnboardingPage.tsx`

Key differences from wallet app:
- No AuthGuard -- auth happens inline as part of the onboarding flow
- Encrypted `?d=` param in URL triggers the flow
- Decryption happens server-side (backend API), NOT client-side
- 72-hour expiry countdown timer
- Single page app with step-based state machine: loading -> otp -> details -> success

- [ ] **Steps 1-6:** Scaffold and implement following receiver-onboarding patterns. Use shared OtpStep component from `@brandpay/auth`. All styling via CSS custom properties.

- [ ] **Step 7: Verify full seller flow**

```bash
pnpm --filter @brandpay/seller-verification dev
```

Test with: `localhost:5174?d=<test-encrypted-data>&brand=spaid`

- [ ] **Step 8: Commit**

```bash
git add apps/seller-verification/
git commit -m "feat: complete seller-verification app with OTP, onboarding details, and success flow"
```

---

## Phase 4: Education App (All Brands)

> New webapp. After login: choose school/institute or tutor payment.
> Tutor opens "requires registration" sheet, then CRED-style multi-step flow.

### Task 4.1: Education App Scaffold + Home + CRED Flow

**Files:**
- Create: `apps/education/package.json` (same deps, port 5175)
- Create: `apps/education/vite.config.ts`, `index.html`, `tailwind.css`
- Create: `apps/education/src/main.tsx`, `App.tsx`, `router.tsx`
- Create: `apps/education/src/pages/HomePage.tsx` -- Two cards: school/institute and tutor
- Create: `apps/education/src/pages/SchoolPayPage.tsx` -- School search + payment sheet
- Create: `apps/education/src/pages/TutorRegisterPage.tsx` -- CRED-style registration
- Create: `apps/education/src/components/CredStyleFlow.tsx` -- Single-field-at-a-time animated flow

CRED-style flow: One input per screen, smooth slide-up animation between steps, progress bar at top, minimal clean UI. Steps for tutor registration: Name -> Phone -> PAN -> UPI ID.

When user clicks "Pay Tutor" on home page, a BottomSheet opens saying "This will require tutor registration" with a "Register Tutor" button. Clicking it navigates to the CRED-style flow.

- [ ] **Steps 1-6:** Scaffold, implement home page with two service cards, implement CRED-style flow component, wire up routes.

- [ ] **Step 7: Verify education app**

```bash
pnpm --filter @brandpay/education dev
```

Test: Login -> Home -> School search -> Tutor registration (CRED flow). Switch brands with `?brand=kux`.

- [ ] **Step 8: Commit**

```bash
git add apps/education/
git commit -m "feat: complete education app with school payment and CRED-style tutor registration"
```

---

## Phase 5: Brand Assets + Policies

### Task 5.1: Brand Background Assets

- [ ] **Step 1:** Create placeholder SVG backgrounds: `bg-superpe.svg` (geometric line pattern), `bg-spaid.svg` (overlapping colored shapes), `bg-kux.jpg` (grayscale photograph)
- [ ] **Step 2:** Create placeholder brand logo SVGs for all 5 brands
- [ ] **Step 3:** Add asset copy script to root package.json
- [ ] **Step 4:** Create policy markdown content per brand under `policies/`
- [ ] **Step 5: Commit**

```bash
git add packages/brand-config/assets/ policies/
git commit -m "feat: add brand assets and policy content"
```

---

## Phase 6: Build + Deploy

### Task 6.1: Build Configuration + Deploy Docs

- [ ] **Step 1:** Verify all 3 apps build cleanly: `pnpm build:all`
- [ ] **Step 2:** Create `.env.example` for each app
- [ ] **Step 3:** Create nginx config for subdomain routing (all brand subdomains for a service point to same dist/)

```nginx
# Same build serves all brands -- detection is client-side
server {
    server_name wallet.superpe.in wallet.slongo.in;
    root /var/www/brandpay/apps/wallet/dist;
    location / { try_files $uri /index.html; }
}

server {
    server_name education.superpe.in education.spaid.in education.kux.in education.mewt.in education.slongo.in;
    root /var/www/brandpay/apps/education/dist;
    location / { try_files $uri /index.html; }
}

server {
    server_name seller-verification.superpe.in seller-verification.spaid.in seller-verification.kux.in seller-verification.mewt.in seller-verification.slongo.in;
    root /var/www/brandpay/apps/seller-verification/dist;
    location / { try_files $uri /index.html; }
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add build scripts and deployment configuration"
```

---

## Open Items Requiring User Input

| # | Item | Needed For | Status |
|---|------|-----------|--------|
| 1 | Spaid accent color and full styling details | Brand config | Blocked |
| 2 | Kux accent color and full styling details | Brand config | Blocked |
| 3 | Mewt styling details (accent, background) | Brand config | Blocked |
| 4 | Slongo styling details (accent, background) | Brand config | Blocked |
| 5 | CRED flow screenshots/details | Education tutor registration | Blocked -- user said "attached" but no attachment found |
| 6 | Brand logos (SVG preferred) | All apps header | Blocked |
| 7 | Brand background images (actual assets) | All apps login/background | Blocked |
| 8 | Backend API base URL for production | Deployment | Blocked |
| 9 | Domain targets for rent and utility services | Future phases | Not yet started |
| 10 | Policy content per brand | Profile/policy pages | Blocked |
| 11 | Education service API endpoints | Education app | Blocked |

---

## Summary

| Phase | What | Packages/Apps | Tasks |
|-------|------|---------------|-------|
| 1 | Monorepo + shared packages | `brand-config`, `utils`, `auth`, `ui` | 5 |
| 2 | Wallet app | `apps/wallet` | 3 |
| 3 | Seller verification app | `apps/seller-verification` | 1 |
| 4 | Education app | `apps/education` | 1 |
| 5 | Brand assets + policies | shared assets | 1 |
| 6 | Build + deploy | root config | 1 |

**Total: 12 tasks, ~50 steps**

Phase 1 is foundational. Phases 2, 3, 4 can run in parallel once Phase 1 is done.
