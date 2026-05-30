/**
 * visual-qa.ts — drop-in Visual QA stub-mode helper for React Native.
 *
 * Part of the `designmatch` skill (superx). Enables a controlled,
 * predictable boot state so a canonical HTML render (Playwright) and
 * the live RN app can be screenshot-compared at the same logical state.
 *
 * ────────────────────────────────────────────────────────────────────
 * PEER DEPS (your app must already have these):
 *   - react
 *   - react-native
 *   - @react-native-async-storage/async-storage
 *
 * OPTIONAL INJECTED DEP:
 *   - react-native-restart  (you pass it into toggleVqaAndRestart)
 *
 * ────────────────────────────────────────────────────────────────────
 * WIRING (do this once at app boot, before redux store creation):
 *
 *   import {
 *     primeVisualQaFlag, applyVisualQaState, overrideFeatureFlags,
 *     useVqaLongPressDetector, toggleVqaAndRestart, VqaBadge,
 *   } from './visual-qa';
 *   import RNRestart from 'react-native-restart';
 *
 *   await primeVisualQaFlag();
 *   const store = createStore(...);
 *   applyVisualQaState(store.dispatch);
 *   const isFeatureEnabled = overrideFeatureFlags(originalIsFeatureEnabled);
 *
 *   // In your root layout:
 *   //   <VqaBadge />
 *   // In your AppLogo component:
 *   //   const { onPress } = useVqaLongPressDetector(() => toggleVqaAndRestart(RNRestart));
 *   //   <Pressable onPress={onPress}>...</Pressable>
 *
 * ────────────────────────────────────────────────────────────────────
 * ACTION_TYPES — edit the map below to match your app's reducers,
 * or wire a custom dispatcher. Defaults follow a common slice-style
 * convention (`slice/action`).
 */

import React, { useCallback, useRef } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─────────── normalize() — width-relative px scaler, base 414 ─────────── */

const BASE_WIDTH = 414;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE = SCREEN_WIDTH / BASE_WIDTH;

export function normalize(size: number): number {
  return Math.round(size * SCALE);
}

/* ─────────── Storage key + cached flag ─────────── */

export const VQA_STORAGE_KEY = 'wn_visual_qa';

let isVqaEnabled = false;

/* ─────────── Action-type map (edit to match your reducers) ─────────── */

export const ACTION_TYPES = {
  USER_SET: 'user/set',
  RECIPIENT_ADD: 'recipient/add',
  RECIPIENT_SELECT: 'recipient/setSelected',
  BONUS_SET: 'bonus/set',
  TRANSFER_SET_COUNTRIES: 'transfer/setCountries',
} as const;

/* ─────────── Seed payloads (override per app needs) ─────────── */

export const VQA_SEED = {
  user: {
    kycStatus: 'verified' as const,
    phone_verified: true,
    iso: 'GBR',
    name: 'Visual QA',
  },
  recipient: {
    id: 'vqa-r1',
    name: 'Test Recipient',
    country: 'IND',
    phone: '+919999900000',
  },
  bonus: {
    balance: 1000,
    ledger: [] as Array<unknown>,
    applyCapPct: 50,
  },
  transfer: {
    sendingCountry: 'GBR',
    receivingCountry: 'IND',
  },
};

/* ─────────── Flag lifecycle ─────────── */

/**
 * Read the persisted VQA flag from AsyncStorage and cache it for
 * synchronous access via getVqaEnabled(). Call once at app boot,
 * BEFORE createStore() or any UI that branches on the flag.
 */
export async function primeVisualQaFlag(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VQA_STORAGE_KEY);
    isVqaEnabled = raw === '1' || raw === 'true';
  } catch {
    isVqaEnabled = false;
  }
  return isVqaEnabled;
}

/** Synchronous accessor for the primed flag. */
export function getVqaEnabled(): boolean {
  return isVqaEnabled;
}

/**
 * Persist a new VQA flag value. Does NOT restart the app —
 * callers wanting an immediate boot effect should use
 * toggleVqaAndRestart() instead, or call RNRestart.restart() themselves.
 */
export async function setVqaEnabled(on: boolean): Promise<void> {
  isVqaEnabled = !!on;
  if (on) {
    await AsyncStorage.setItem(VQA_STORAGE_KEY, '1');
  } else {
    await AsyncStorage.removeItem(VQA_STORAGE_KEY);
  }
}

/**
 * Flip the persisted flag and restart the app.
 * Pass `react-native-restart`'s default export as `RNRestart`.
 */
export async function toggleVqaAndRestart(RNRestart: {
  restart: () => void;
}): Promise<void> {
  const next = !getVqaEnabled();
  await setVqaEnabled(next);
  RNRestart.restart();
}

/* ─────────── Redux seeding ─────────── */

type AnyDispatch = (action: { type: string; payload?: unknown }) => unknown;

/**
 * Seeds the redux store with predictable VQA fixtures so a Playwright
 * canonical and the live app start at identical logical state.
 * No-op when VQA is off. Call AFTER primeVisualQaFlag() and AFTER
 * the store is created.
 */
export function applyVisualQaState(dispatch: AnyDispatch): void {
  if (!getVqaEnabled()) return;

  dispatch({ type: ACTION_TYPES.USER_SET, payload: VQA_SEED.user });

  dispatch({ type: ACTION_TYPES.RECIPIENT_ADD, payload: VQA_SEED.recipient });
  dispatch({
    type: ACTION_TYPES.RECIPIENT_SELECT,
    payload: VQA_SEED.recipient.id,
  });

  dispatch({ type: ACTION_TYPES.BONUS_SET, payload: VQA_SEED.bonus });

  dispatch({
    type: ACTION_TYPES.TRANSFER_SET_COUNTRIES,
    payload: {
      sendingCountry: VQA_SEED.transfer.sendingCountry,
      receivingCountry: VQA_SEED.transfer.receivingCountry,
    },
  });
}

/* ─────────── Feature-flag override ─────────── */

/**
 * Wraps your existing isFeatureEnabled so VQA mode force-enables every
 * flag-gated UI surface, ensuring the canonical render does not branch
 * on unrelated experiments. Outside VQA, delegates unchanged.
 */
export function overrideFeatureFlags<T extends (name: string) => boolean>(
  isFeatureEnabled: T,
): T {
  const wrapped = ((name: string): boolean => {
    if (getVqaEnabled()) return true;
    return isFeatureEnabled(name);
  }) as T;
  return wrapped;
}

/* ─────────── 5×-tap long-press detector (4s sliding window) ─────────── */

const TAP_WINDOW_MS = 4_000;
const TAP_THRESHOLD = 5;

/**
 * React hook returning a stable `onPress` handler. Attach to AppLogo.
 * Counts taps within a 4-second sliding window; on the 5th tap fires
 * onTrigger() and resets the counter. Uses useRef so re-renders aren't
 * triggered by tap-counting.
 */
export function useVqaLongPressDetector(onTrigger: () => void): {
  onPress: () => void;
} {
  const timestampsRef = useRef<number[]>([]);

  const onPress = useCallback(() => {
    const now = Date.now();
    const cutoff = now - TAP_WINDOW_MS;
    // Drop taps outside the window, then add the current one.
    const recent = timestampsRef.current.filter((t) => t >= cutoff);
    recent.push(now);
    timestampsRef.current = recent;

    if (recent.length >= TAP_THRESHOLD) {
      timestampsRef.current = [];
      onTrigger();
    }
  }, [onTrigger]);

  return { onPress };
}

/* ─────────── VqaBadge — top-right pill, only visible when VQA on ─────────── */

const badgeStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: normalize(44),
    right: normalize(12),
    backgroundColor: '#E53935',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    zIndex: 9_999,
    elevation: 12,
  } satisfies ViewStyle,
  text: {
    color: '#FFFFFF',
    fontSize: normalize(11),
    letterSpacing: normalize(1),
    // Platform-gate fontWeight to avoid Android synthesized bold.
    // On Android consumers should ship a family-name bold (e.g. their
    // app font's "-Bold" variant) — leave fontFamily unset here so the
    // app's default heading family applies.
    ...(Platform.OS === 'android' ? {} : { fontWeight: '600' as const }),
  },
});

/**
 * Mount once at the root layout (e.g. inside SafeAreaProvider).
 * Renders nothing when VQA is off; a red "VQA" pill top-right otherwise.
 */
export function VqaBadge(): React.ReactElement | null {
  if (!getVqaEnabled()) return null;
  return (
    <View pointerEvents="none" style={badgeStyles.wrap}>
      <Text style={badgeStyles.text}>VQA</Text>
    </View>
  );
}
