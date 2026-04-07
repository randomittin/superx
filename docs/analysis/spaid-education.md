# Spaid Education Payment Flow Analysis

## Repository Status

GitHub repos `mewt-app/spaid-education` and `mewt-app/spaid-landing` returned 404 (private). However, a complete working implementation exists locally at `/Users/rj/Downloads/code/spaid/` — this is the **React Native** spaid app.

## Tech Stack (React Native, NOT web)

- React Native (TypeScript)
- React Navigation (bottom-tabs, native-stack)
- Redux Toolkit for state management
- Unistyles for theming
- Axios for HTTP
- Fuse.js for fuzzy search (institution search)
- Firebase (Analytics, Crashlytics, Messaging, Remote Config)
- FontAwesome icons
- Version: 1.2.21

## Education Payment Flow

### Step 1: Home -> Institute Selection
- User selects "Institute" from dropdown on Home
- Routes to EDUCATION_BBPS_1 screen

### Step 2: Institution Selection (EducationBBPS1.tsx)
- Select State from predefined list (35 states/territories)
- API: `GET /bbps/cities` -> cities for selected state
- Select City from filtered list
- API: `GET /bbps/categories-v2` -> schools in city
- Fuzzy search schools using Fuse.js (threshold: 0.5)
- Select school from results

### Step 3: Student Verification (EducationBBPS2.tsx)
- Displays selected school + location
- Enter Unique Student ID (14 digits)
- First verification: API validates Student ID
- If verified, additional fields appear:
  - Parent's Mobile Number (10 digits)
  - Date of Birth (DD/MM/YYYY auto-formatting)
- Final verification validates all fields

### Step 4: Payment (Recharge.tsx)
- Routes to RECHARGE with amount, biller_id, operator details
- Standard BBPS payment flow

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bbps/cities` | GET | Cities for selected state |
| `/bbps/categories-v2` | GET | School billers for city |
| `/bbps/get-bbps-mdr-v2` | GET | Merchant Discount Rate |

Auth: `Authorization: Bearer {AUTH_TOKEN}` with headers: app-origin, session-id, merchant-id, app-version, device-id

## UI Components (React Native)

- `ScreenSuper` - base screen wrapper
- `ButtonSuper` - primary action button
- `TextField` - input with validation
- `Typography` - themed text
- `ListItem` - operator/school list
- `SheetManagerSuper` - bottom sheet for selections
- `SnackSuper` - error/success notifications

## Key Features

1. **BBPS Integration** - Uses Bharat Bill Payment System for school billing
2. **Two-Stage Verification** - Student ID first, then parent mobile + DOB
3. **Fuzzy Search** - Fuse.js for institution name search
4. **Mock Data** - VALID_INSTITUTIONS array with 3 test schools
5. **Analytics** - Firebase events for each flow step

## Static Data

- 35 Indian states/territories hardcoded
- Asset URLs from Google Cloud Storage (education_banner.webp, education_fees.png)
- Education purpose: code 'education', cards allowed: visa, mastercard, rupay, amex

## Key Observation for Web Port

The source is React Native — ALL UI components need to be rebuilt as web React components. However the **flow logic, API endpoints, and data structures** can be directly reused. The BBPS integration pattern (state -> city -> institution -> verification -> payment) is the canonical flow to replicate.
