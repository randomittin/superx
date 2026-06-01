# designmatch — anti-patterns (9-item checklist)

Each item: ❌ wrong / ✅ right + one-line reason.

---

## 1. Literal px instead of `normalize()`

❌
```tsx
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, marginBottom: 22 },
});
```

✅
```tsx
import { normalize } from '@/utils/normalize';

const styles = StyleSheet.create({
  card: {
    padding: normalize(16),
    borderRadius: normalize(12),
    marginBottom: normalize(22),
  },
});
```

Reason: literal px breaks on non-base-414 devices → diff bloats on every screen size other than the canonical.

---

## 2. `fontWeight: '800'` without Platform gate when family is named-bold

❌
```tsx
const styles = StyleSheet.create({
  heading: {
    fontFamily: 'Bricolage-Bold',
    fontWeight: '800',
  },
});
```

✅
```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  heading: {
    fontFamily: 'Bricolage-Bold',
    ...(Platform.OS === 'android' ? {} : { fontWeight: '800' as const }),
  },
});
```

Reason: Android synthesizes a fake bold on top of an already-bold family file → glyph weight drifts from the canonical.

---

## 3. Default Typography variant on headings (resolves to body family)

❌
```tsx
import { Typography } from '@/components/Typography';

export const ScreenTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography>{children}</Typography>
);
```

✅
```tsx
import { Typography } from '@/components/Typography';

export const ScreenTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="displayLg">{children}</Typography>
);
```

Reason: default variant routes to GSF body family → heading renders in body font → entire title block diffs.

---

## 4. Double safe-area padding (Screen wrapper + inner container both apply insets)

❌
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SendScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <Header />
      </View>
    </Screen>
  );
};
```

✅
```tsx
export const SendScreen = () => (
  <Screen>
    <View>
      <Header />
    </View>
  </Screen>
);
```

Reason: `<Screen>` already applies safe-area insets → adding them again in an inner View doubles top padding → header drops below canonical position.

---

## 5. Native stack header + in-screen PushHeader

❌
```tsx
<Stack.Screen
  name="Send"
  component={SendScreen}
  options={{ headerShown: true, title: 'Send' }}
/>

// SendScreen.tsx
export const SendScreen = () => (
  <Screen>
    <PushHeader title="Send" />
    <SendForm />
  </Screen>
);
```

✅
```tsx
<Stack.Screen
  name="Send"
  component={SendScreen}
  options={{ headerShown: false }}
/>

// SendScreen.tsx
export const SendScreen = () => (
  <Screen>
    <PushHeader title="Send" />
    <SendForm />
  </Screen>
);
```

Reason: two stacked headers double the chrome → form pushes down → entire screen diffs against canonical.

---

## 6. Standard `tabBarStyle` when expand-to-label animation needed

❌
```tsx
<Tab.Navigator
  screenOptions={{
    tabBarStyle: { height: 64 },
  }}
>
  <Tab.Screen name="Home" component={HomeScreen} />
</Tab.Navigator>
```

✅
```tsx
import { AnimatedTabBar } from '@/components/AnimatedTabBar';

<Tab.Navigator
  tabBar={(props) => <AnimatedTabBar {...props} />}
  screenOptions={{ tabBarStyle: { height: normalize(64) } }}
>
  <Tab.Screen name="Home" component={HomeScreen} />
</Tab.Navigator>
```

Reason: default tab bar cannot animate label expansion on focus → canonical shows pill-with-label on active tab → static `tabBarStyle` can never match.

---

## 7. Literal pixel values inlined instead of design-token references

❌
```tsx
const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
```

✅
```tsx
import { tokens } from '@/design/tokens';

const styles = StyleSheet.create({
  badge: {
    backgroundColor: tokens.color.danger,
    paddingHorizontal: normalize(tokens.space.sm),
    paddingVertical: normalize(tokens.space.xs),
    borderRadius: normalize(tokens.radius.pill),
  },
});
```

Reason: inlined values drift from the canonical token sheet → one canonical change requires N-screen sweeps to re-match.

---

## 8. Divergent agent outputs without shared contract (each picking own conventions)

❌
```tsx
// Agent A — SendScreen
<Text style={{ fontFamily: 'Bricolage', fontWeight: 'bold', fontSize: 28 }}>Send</Text>

// Agent B — ReceiveScreen
<Typography variant="h1">Receive</Typography>

// Agent C — HomeScreen
<Text style={styles.title}>Home</Text>  // styles.title hand-rolled
```

✅
```tsx
// All agents — single shared contract
import { Typography } from '@/components/Typography';

<Typography variant="displayLg">Send</Typography>
<Typography variant="displayLg">Receive</Typography>
<Typography variant="displayLg">Home</Typography>
```

Reason: parallel agents without a shared spec each invent a convention → every screen has its own typography rules → no single fix lifts SSIM across the app.

---

## 9. Rebuilding screens by eyeballing PNGs instead of porting canonical source

❌
```tsx
// Agent reads the canonical PNG, guesses paddings / colors / font sizes,
// hand-rolls a Send screen from scratch.
export const SendScreen = () => (
  <View style={{ padding: 24, backgroundColor: '#FFFFFF' }}>
    <Text style={{ fontSize: 28, fontWeight: '700' }}>Send</Text>
    {/* …rebuilds layout via per-pixel inspection of canonical.png… */}
  </View>
);
```

✅
```bash
designmatch port Send --out src/screens/Send.tsx
```
```tsx
// The emitted file is the canonical JSX preceded by a TRANSLATION GUIDE.
// Translate top-down per the guide:
//   <div>          → <View>
//   className=…    → StyleSheet.create + normalize(px)
//   onClick=       → onPress
//   fontWeight on bold-family → Platform.OS gate (see #2)
// Keep variable names + structure identical to the canonical source.
// Then `designmatch iterate Send` → diff verifies; refine only the deltas
// the diff surfaces. Do NOT freelance pixel adjustments.
```

Reason: the canonical JSX is the spec; the PNG is the verification gate. Eyeballing pixels re-derives layout / spacing / colors that already exist in source → drift, token bloat, and 30-wave grind. appco Send-screen Waves 15.0→15.32 was exactly this miss.
