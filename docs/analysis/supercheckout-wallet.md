# Supercheckout Wallet - Comprehensive Analysis

## 1. Tech Stack

- **Vite 6.0.5** (NOT Next.js -- already pure Vite+React client-side)
- React 18.3.1 + React DOM 18.3.1
- TypeScript 5.6.3
- Tailwind CSS 3.4.17
- vaul 1.1.2 (headless sheets/drawers)
- FontAwesome (Pro): Core 7.2.0, Free+Pro Solid/Regular/Light icons
- No state management library (localStorage + React state only)
- No auth library (manual JWT handling)
- No API client library (raw fetch)

## 2. File Structure

```
src/
  api/
    auth.ts              # userAuthenticate, appAuthenticate, appValidate
    checkout.ts          # initiatePayment, getPaymentStatus
    client.ts            # fetch wrapper with Bearer auth
    partner.ts           # getPartnerInfo
    payment.ts           # getPaymentModes, addCard, addUpi, addNetbanking, BIN lookup, AES encryption
  components/
    BankLogo.tsx         # Bank logo mapping
    ThemeToggle.tsx      # Dark/light mode toggle
  pages/
    AddCard.tsx          # Card form with Luhn validation, AES encryption
    AddNetbanking.tsx    # Netbanking form with IFSC validation
    AddUpi.tsx           # UPI ID form with provider selection
    AuthGate.tsx         # Loading state during auth verification
    NetworkLogo.tsx      # Card network logos (Visa, MC, Amex, RuPay, Discover, Maestro)
    OtpVerify.tsx        # 4-digit OTP with resend timer
    PaymentModes.tsx     # Main payment sheet with vaul Drawer
    PaymentStatus.tsx    # Success/failure result page
    PhoneInput.tsx       # Phone entry (+91 parsing)
    Processing.tsx       # Payment polling (60 attempts, 3s intervals)
  utils/
    cardValidation.ts    # Luhn check, expiry validation
    cookies.ts           # JWT token & phone storage
    theme.ts             # Light/dark mode with system preference
  App.tsx                # Main orchestrator, page routing
  main.tsx               # React entry, theme application
  types.ts               # Full type definitions
  index.css              # Tailwind + CSS variables + custom animations

public/
  fonts/
    UberMove-Regular.ttf
    UberMove-Medium.ttf
    UberMove-Bold.ttf
  icons/
    icons8-google-pay.svg, icons8-phone-pe.svg, icons8-paytm.svg, icons8-bhim.svg, zepto-logo.svg
```

## 3. Auth Flow

**Components:** PhoneInput.tsx -> OtpVerify.tsx -> AuthGate.tsx

**Flow:**
1. URL params parsed: `token`, `phone`, `deviceId`, `amount`, `orderId`, `partnerId`, `currency`
2. Phone normalization: `parsePhone()` converts 10-digit to +91XXXXXXXXXX
3. Auto-auth: if phone+deviceId, call `/api/auth/user-authenticate`
   - Success -> save token cookie -> payment selection
   - "Device not verified" -> OTP screen
   - Failure -> phone input
4. OTP request: `appAuthenticate()` -> `/api/auth/app-authenticate`
   - Sends: phoneNumber, deviceId, source:'supercheckout'
5. OTP verify: `appValidate()` on 4-digit completion
   - Sends: phoneNumber, otp, deviceId, source:'supercheckout'
   - Returns: { token, merchantId }
6. Token stored in cookie: `spe_token` (7 days, Secure, SameSite=Lax)

**Key Auth Endpoints:**
- `POST /api/auth/user-authenticate` - device check
- `POST /api/auth/app-authenticate` - send OTP
- `POST /api/auth/app-validate` - verify OTP & get token

## 4. Wallet Features (THIS REPO IS CHECKOUT, NOT FULL WALLET)

**Implemented:**
- Add Card with real-time BIN lookup & network detection
- Add UPI with provider selection
- Add Net Banking with popular bank shortcuts
- Card encryption (AES-GCM with public key from backend)
- Card validation (Luhn checksum, expiry date)
- Payment method selection via bottom sheet
- Payment initiation with CVV entry for cards
- Payment status polling (60 attempts, 3s intervals)
- Partner branding (logo, theme color, order details)

**NOT Implemented (missing for full wallet):**
- KYC flow
- Dashboard/wallet balance
- Add money flow with preset amounts
- P2P transfers
- Beneficiary management
- Transaction history page

## 5. UI Patterns

**Sheet (vaul):**
- Used for PaymentModes, AddCard, AddUpi, AddNetbanking
- Modal overlay with dismiss protection
- Drag handle + close button header
- Dynamic max-height to keep order card visible
- Portal rendering

**CSS Variable Theming (index.css):**
- Light: --bg:#f5f5f5, --bg-raised:#ffffff, --text:#000000, --cta-bg:#000000, --cta-text:#ffffff, --accent:#266ef1
- Dark: --bg:#121212, --bg-raised:#1e1e1e, --text:#f0f0f0, --cta-bg:#ffffff, --cta-text:#000000
- Applied via `data-theme="light"|"dark"` attribute

**Tailwind Config:**
- font-family: 'UberMove' with system fallbacks
- Color tokens: accent, surface, ink, cta, btn-disabled, action-bar, status (all CSS var references)

**Animations:** fadeIn, slideUp, spin-slow

## 6. All API Endpoints

Base: `https://api-supercheckout.superpe.in`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/user-authenticate` | POST | Device check |
| `/api/auth/app-authenticate` | POST | Send OTP |
| `/api/auth/app-validate` | POST | Verify OTP |
| `/api/payment-info/` | GET | Saved payment modes |
| `/api/payment-info/public-aes-key` | GET | AES key for card encryption |
| `/api/payment-info/bin/{bin}` | GET | Card BIN info |
| `/api/payment-info/card` | POST | Add card |
| `/api/payment-info/upi` | POST | Add UPI |
| `/api/payment-info/netbanking` | POST | Add netbanking |
| `/api/checkout/initiate` | POST | Initiate payment |
| `/api/checkout/status/{orderId}` | GET | Payment status |
| `/api/partner/{partnerId}` | GET | Partner branding |

All responses: `{ success: boolean, message: string, data: T }`

## 7. State Management

**No Zustand/Redux** -- React state + cookie storage only.

App.tsx state: page, userToken, merchantId, phone, internalOrderId, error
PaymentModes.tsx state: modes, selectedId, partner, showModes, add*Open, sheetHeight

Storage: spe_token (cookie 7d), spe_phone (cookie 30d), spe_theme (localStorage)

## 8. Key Finding: NO NEXT.JS CODE TO PORT

- No next/link, next/router, next/image, next/font
- No server actions, API routes, getServerSideProps
- Already uses `import.meta.env.VITE_API_URL`
- Already pure Vite+React client-side SPA
- All API calls via fetch to /api/* paths (Vite proxy in dev)

## 9. Components to Reuse

1. **PhoneInput.tsx** - phone formatting, +91 handling, validation
2. **OtpVerify.tsx** - 4-digit auto-advance, paste, resend timer
3. **PaymentModes.tsx** - vaul Drawer pattern, receipt header, radio group
4. **AddCard/AddUpi/AddNetbanking** - form patterns, validation
5. **NetworkLogo.tsx** - card network SVGs
6. **client.ts** - fetch wrapper with Bearer auth, 401 handling
7. **cardValidation.ts** - Luhn check
8. **cookies.ts** - token/phone storage
9. **theme.ts** - dark/light mode system
10. **index.css** - CSS variable system, animations, font declarations
