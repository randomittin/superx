# designmatch — canonical values cheat-sheet

Locked values for matching the Claude Design HTML canonical. Drift here = diff everywhere.

---

## Typography weights

### Bricolage (display)
Allowed weights: **600, 700, 800**.

```tsx
// fontFamily strings shipped with the app
'Bricolage-SemiBold'  // 600
'Bricolage-Bold'      // 700
'Bricolage-ExtraBold' // 800
```

### GSF (body)
Allowed weights: **400, 500, 600**.

```tsx
'GSF-Regular'    // 400
'GSF-Medium'     // 500
'GSF-SemiBold'   // 600
```

### Usage — always gate `fontWeight` per platform

```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  hero: {
    fontFamily: 'Bricolage-ExtraBold',
    fontSize: normalize(34),
    ...(Platform.OS === 'android' ? {} : { fontWeight: '800' as const }),
  },
  body: {
    fontFamily: 'GSF-Regular',
    fontSize: normalize(14),
    ...(Platform.OS === 'android' ? {} : { fontWeight: '400' as const }),
  },
});
```

Reason: prefer family-name bolds over `fontWeight` strings on Android → avoids synthesized weight that drifts from canonical.

---

## Common spacings (px)

Canonical scale: **4, 8, 12, 16, 22, 24**.

```tsx
import { normalize } from '@/utils/normalize';

export const space = {
  xs: normalize(4),
  sm: normalize(8),
  md: normalize(12),
  lg: normalize(16),
  xl: normalize(22),
  xxl: normalize(24),
} as const;
```

Sample usage:

```tsx
const styles = StyleSheet.create({
  card: {
    padding: space.lg,            // 16
    marginBottom: space.xl,       // 22
    gap: space.sm,                // 8
  },
  cta: {
    paddingHorizontal: space.xxl, // 24
    paddingVertical: space.md,    // 12
  },
});
```

Anything outside `{4,8,12,16,22,24}` is suspect — confirm against canonical before shipping.

---

## Canonical viewport

**1080 × 2444**. Orientation locked.

```js
// scripts/render-canonical.js — Playwright
await page.setViewportSize({ width: 1080, height: 2444 });
await page.screenshot({ path: outPath, fullPage: false });
```

```tsx
// RN — lock orientation app-wide
import Orientation from 'react-native-orientation-locker';

useEffect(() => {
  Orientation.lockToPortrait();
}, []);
```

Reason: SSIM compares same-shape buffers → any viewport drift = automatic structural mismatch.

---

## Naming convention

Prefer family-name bolds (`Bricolage-Bold`) over `fontWeight` strings on Android.

```tsx
// ❌ Android synthesizes a fake bold on top of the bold family
{ fontFamily: 'Bricolage', fontWeight: '700' }

// ✅ Use the actual bold font file
{ fontFamily: 'Bricolage-Bold' }
```

Reason: synthesized weight drifts from the canonical glyph metrics → diff bloats on every heading.

---

## Quick reference

| Token | Value | Notes |
|---|---|---|
| Display family | Bricolage | weights 600 / 700 / 800 |
| Body family | GSF | weights 400 / 500 / 600 |
| Spacing scale | 4, 8, 12, 16, 22, 24 | always `normalize()` |
| Viewport | 1080×2444 | portrait lock |
| Android weight | family-name bold | no `fontWeight` |
| iOS weight | `fontWeight` string | Platform-gated |
