# Receiver-Onboarding Repository Analysis

## 1. Tech Stack

- **Next.js 16.1.4** (NEEDS PORTING TO VITE)
- React 19.2.3
- next-auth 5.0.0-beta.30
- Tailwind CSS 4 (@tailwindcss/postcss)
- axios 1.13.2
- FontAwesome Pro (duotone icons 7.1.0)
- TypeScript 5
- crypto 1.0.1 (RSA-AES decryption)
- react-hot-toast 2.6.0

## 2. File Structure

```
src/
  app/
    actions/
      analytics.ts       # Event logging
      api.ts             # Axios wrapper with auth headers
      auth.ts            # NextAuth signIn/signOut/getSession
      crypto.ts          # RSA-AES decryption for encrypted links
      onboarding.ts      # Beneficiary onboarding API calls
    api/[...nextauth]/route.ts  # NextAuth route handler
    consent/page.tsx     # Consent flow page
    policies/[slug]/page.tsx    # Dynamic policy pages
    layout.tsx           # Root layout
    manifest.ts          # PWA manifest
    page.tsx             # Main onboarding flow
    tailwind.css
  auth/
    auth.config.ts       # NextAuth config (JWT, Credentials provider)
  components/
    BrandHeader.tsx      # Header with green gradient + menu
    Button.tsx           # Variants: primary/secondary/outline/ghost/success/danger
    ConsentFlow.tsx      # Phone -> OTP -> Success (3-step)
    OnboardingDetails.tsx # PAN/bank/UPI details screen
    OTPInput.tsx         # 4-digit with paste, auto-advance
    OTPVerification.tsx  # Full OTP verification flow
    PhoneInput.tsx       # +91 prefix, 10-digit, formatted display
    ResendOTP.tsx        # 30s cooldown timer
    HamburgerMenu.tsx    # Logout menu
  constants/
    allPolicies.ts       # Terms & Privacy markdown
    endpoints.ts         # API endpoint URLs
    global.tsx           # BASE_URL, AUTH_SECRET
  types/
    brandHeader.ts, button.ts, otpInput.d.ts, otpVerification.d.ts
  utils/
    api.ts               # Error handling, slug replacement
    fonts.ts             # next/font local fonts (UberMove family)
    index.tsx            # cn() utility (clsx + tailwind-merge)
    logger.ts            # LogStore class
  assets/fonts/
    UberMove-Bold/Light/Medium/Regular.ttf
    UberMoveMono-Medium/Regular.ttf
```

## 3. Encrypted Link + OTP Flow

**Decryption (RSA-AES Hybrid, crypto.ts):**
- Query param `?d=<payload>` contains encrypted data
- RSA private key (PKCS#1 OAEP SHA-256) decrypts AES key
- AES-256-GCM decrypts payload -> `{ amount, beneName, benePhone, paymentId, senderName }`
- **This uses embedded private key — currently server-side only**

**OTP Flow:**
1. Auto-trigger OTP to benePhone on page load
2. Verify via NextAuth credentials provider (phone + OTP + appOrigin)
3. JWT stored in session (24hr maxAge)

## 4. Full Onboarding Flow

1. **Link validation** - parse `?d=`, decrypt, validate benePhone + amount
2. **OTP entry** - auto-triggered, 4-digit input, auto-submit
3. **OTP verify** - authenticate via NextAuth -> setIsVerified
4. **Transaction verify** - `verifySellerFlowTxn(paymentId)`
5. **Fetch details** - `getDetailsForBeneOnboardingStep2(paymentId)` returns bank/UPI/PAN
6. **Details screen** - shows destination (UPI or account+IFSC), tutor ID, PAN, expiry timer
7. **Complete** - `completeBeneOnboardingV2()` -> returns beneficiaryId
8. **Success** - if beneficiaryId starts with "be_" -> full success; else consent received

## 5. Consent Flow (3-step, /consent)

1. **Phone entry** - PhoneInput, validate 10 digits, "Send OTP"
2. **OTP entry** - OTPInput + ResendOTP (30s), "Verify & Give Consent"
3. **Success** - "Consent Registered", verified phone badge

## 6. API Endpoints

Base: `https://api.spaid.in/backend/v2`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/authentication/app-authenticate/` | POST | Send OTP |
| `/authentication/app-validate/` | POST | Verify OTP |
| `/merchant/get-details-for-bene-onboard/{paymentId}` | POST | Fetch encrypted data |
| `/merchant/get-details-for-bene-onboard-step-2/{paymentId}` | POST | Fetch bank/UPI/PAN |
| `/merchant/beneficiary-onboarding/complete` | POST | Complete onboarding |
| `/merchant/beneficiary-onboarding/complete/v2` | POST | Complete v2 |
| `/payoutcc/verify-seller-flow-transaction-web` | POST | Verify transaction |
| `/amplitude/log-analytics-event` | POST | Analytics |

**Headers:**
```
app-origin: spaid
x-api-key: c54eab066ae91001df5058063001ab0c25bbf9d52861c50c11e3442f73a6fa3a
```

## 7. Styling

- Dark theme: black bg, green (#0e8345) accent/CTAs
- Header: green-to-black gradient
- Buttons: `bg-green-600/80 hover:bg-green-600/70 active:scale-[0.99]`
- Inputs: `border-2 rounded-xl focus:border-green-600`
- Cards: `bg-[#0e8345]/5 rounded-2xl border border-[#0e8345]/15`
- Max-width: `max-w-md` (mobile-first)
- Animations: fadeIn, shake (for errors)

## 8. What Must Change for Vite Port

**High Priority:**
1. Server actions ("use server") -> client-side API calls
2. NextAuth -> custom JWT auth (store token in localStorage)
3. next/link -> react-router Link
4. next/font -> CSS @font-face
5. App directory routing -> react-router
6. process.env -> import.meta.env
7. Encrypted link decryption -> must decide: keep server-side API or move to client

**Medium Priority:**
8. Metadata exports -> HTML meta tags or react-helmet
9. Dynamic routes [slug] -> react-router :param
10. PWA manifest -> static manifest.json

**Components portable as-is (after removing next imports):**
- OTPInput.tsx, PhoneInput.tsx, ResendOTP.tsx, Button.tsx
- OnboardingDetails.tsx, ConsentFlow.tsx (flow logic)
- BrandHeader.tsx (replace green with brand accent)

## 9. Key Types

```typescript
interface IOnboardingDetails {
  paymentId: string;
  amount: number;
  senderName: string;
  beneName: string;
  benePhone: string;
  beneAccountNumber: string;
  beneIfsc: string;
  beneUpi?: string;
  benePan: string;
  beneficiaryId: string;
  onboardingStatus?: string;
}
```

## 10. Environment Variables

- `process.env.HOST` -> defaults to https://api.spaid.in
- `process.env.BASE_PATH` -> defaults to /backend/v2
- `process.env.NEXTAUTH_SECRET` -> JWT secret (hardcoded default)
- Hardcoded API key in api.ts headers
