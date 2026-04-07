# Spaid Repository Analysis

## What This Repo Is

**Full-featured React Native fintech app** — NOT a web app. Contains education bill payments, utility bills (BBPS), rent, money transfers, wallet, cards, referrals, credit scoring, and more. Production-grade with 100+ API endpoints.

## Tech Stack

- React Native 0.82.0 + TypeScript 5.0.4
- MobX 6.15.0 (state management)
- React Navigation 7.x (native-stack, bottom-tabs)
- React Native Unistyles 3.0.22 (CSS-in-JS theming)
- React Native Paper 5.14.5 (UI components)
- Axios 1.13.4
- Lottie React Native 7.3.5
- Firebase (Analytics, Crashlytics, Messaging, Remote Config)
- Amplitude, Sentry, PostHog (analytics/crash)
- Yarn 4.12.0

## Education Flow (EducationBBPS1 + EducationBBPS2)

**Step 1:** Select State from hardcoded list (35 states)
**Step 2:** API `GET /bbps/cities` -> cities for state
**Step 3:** API `GET /bbps/categories-v2` -> schools in city
**Step 4:** Fuse.js fuzzy search on school names
**Step 5:** Enter Student ID (14 digits) -> API verification
**Step 6:** If verified: Parent Mobile (10 digits) + DOB (DD/MM/YYYY)
**Step 7:** Final verification -> Payment flow

## Key API Endpoints (100+)

**Auth:**
- `/authentication/app-authenticate/` - Send OTP
- `/authentication/app-validate/` - Verify OTP
- `/authentication/app-logout/<phone>` - Logout
- `/authentication/app-session-check/` - Session check

**Payments:**
- `/payoutcc/initiate-pg-transaction/v3` - Create order
- `/payoutcc/create-transaction/` - Send payment
- `/payoutcc/submit-otp-direct/` - Payment OTP
- `/pg/juspay/order/status/v3/` - Order status

**Beneficiary:**
- `/payoutcc/beneficiaries` - Add beneficiary
- `/merchant/update-default-bene-merchant/` - Update default
- `/account-verification/` - Verify account

**Merchant:**
- `/merchant/get_merchant_details/<merchantId>` - Details
- `/merchant/merchant_transactions/v5/<merchantId>` - Transactions
- `/merchant/merchant-txn-statistics/<merchantId>` - Stats

**BBPS:**
- `/bbps/cities` - Cities for state
- `/bbps/categories-v2` - Billers for city
- `/bbps/get-bbps-mdr-v2` - MDR rates
- `/ccavenue/upcoming_bills/` - Upcoming bills

**Cards:**
- `/risk-engine/add-card-v2/` - Save card
- `/risk-engine/soft-delete-merchant-card-new` - Delete card
- `/pg/juspay/cards/list/<merchantId>` - List cards
- `/pg/pg/card-details/<bin>` - BIN lookup

## Styling

- Primary: Black & White (Uber-inspired)
- Safety Blue: #266ef1 for CTAs
- UberMove font family
- Spacing: xxs(2) xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) xxxl(32)
- Light/dark theme support

## 21 Lottie Animations

bill_banner, card_payment, confetti_top, discount_tag, diwali_fireworks, downtime, education_icon, light_shining, location_lottie, low_charges_v2, offer, offer_rotating_circle, rating_and_review, referral_banner, referral_gift_yellow, rent_banner, super_cash, transaction_done, typing, wallet_creation

## Key Observation for Web Port

This is React Native — ALL UI components must be rebuilt as web React. However:
- **API endpoints** are directly reusable
- **Flow logic** (education BBPS, payment, auth) can be replicated
- **Data structures** (types, constants, bbpsData, bankData) can be copied
- **Color system** (#266ef1 blue, semantic colors) aligns with supercheckout
