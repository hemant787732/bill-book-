// App-lock PIN, stored hashed in AsyncStorage. This is an obfuscating hash, not
// strong crypto — it matches the app's existing local-data posture and works on
// native, web and Expo Go without a native build. (A SecureStore + biometric
// upgrade can be added later behind a dev/EAS build.)
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'app_lock_pin_hash_v1';

function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h) ^ pin.charCodeAt(i);
  }
  return String(h >>> 0);
}

export async function isAppLockSet(): Promise<boolean> {
  try {
    return !!(await AsyncStorage.getItem(PIN_KEY));
  } catch {
    return false;
  }
}

export async function setAppLockPin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, hashPin(pin));
}

export async function clearAppLockPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_KEY);
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    return !!stored && stored === hashPin(pin);
  } catch {
    return false;
  }
}
