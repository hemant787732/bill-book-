// Stable per-install device id (persisted in AsyncStorage) + a friendly name,
// used by the device-management / remote sign-out feature.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createId } from '../utils/format';

const DEVICE_ID_KEY = 'device_id_v1';

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = createId('dev');
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  switch (Platform.OS) {
    case 'web':
      return 'Web browser';
    case 'ios':
      return 'iPhone / iPad';
    case 'android':
      return 'Android device';
    default:
      return 'Device';
  }
}
