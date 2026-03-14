/**
 * Auto-detect the composition server URL.
 *
 * The server runs on the same Mac as Metro. We derive the IP from
 * Expo's manifest which contains the dev server host.
 */

import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const COMPOSITION_PORT = 8420;

let _cachedUrl: string | null = null;

function getDevHost(): string | null {
  // Method 1: Expo Constants — most reliable in dev builds
  try {
    // expoConfig.hostUri is "IP:PORT" from the dev server
    const hostUri = (Constants.expoConfig as any)?.hostUri
      ?? Constants.manifest?.debuggerHost
      ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch {}

  // Method 2: scriptURL from SourceCode native module
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:\/]+)/);
      if (match && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {}

  return null;
}

/**
 * Get the composition server base URL.
 * Works on any network — auto-derives from Expo dev server.
 */
export function getServerUrl(): string {
  if (_cachedUrl) return _cachedUrl;

  const host = getDevHost();
  if (host) {
    _cachedUrl = `http://${host}:${COMPOSITION_PORT}`;
    if (__DEV__) console.log(`[Server] Auto-detected: ${_cachedUrl}`);
    return _cachedUrl;
  }

  // Fallback: localhost (simulator only)
  const fallback = `http://localhost:${COMPOSITION_PORT}`;
  if (__DEV__) console.log(`[Server] Fallback: ${fallback}`);
  return fallback;
}

export function resetServerUrl(): void {
  _cachedUrl = null;
}
