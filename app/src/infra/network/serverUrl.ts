/**
 * Auto-detect the composition server URL.
 *
 * The server runs on the same Mac as Metro, so we derive the IP from
 * the dev server connection. Multiple detection methods are tried.
 */

import { NativeModules, Platform } from 'react-native';

const COMPOSITION_PORT = 8420;

let _cachedUrl: string | null = null;

function getDevHost(): string | null {
  // Method 1: scriptURL from SourceCode native module
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:\/]+)/);
      if (match && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {}

  // Method 2: Expo DevLauncher / DevMenu packager URL
  try {
    const devMenu = NativeModules.ExpoDevMenu;
    const url = devMenu?.packagerUrl as string | undefined;
    if (url) {
      const match = url.match(/^https?:\/\/([^:\/]+)/);
      if (match) return match[1];
    }
  } catch {}

  // Method 3: RCTBundleURLProvider (iOS only)
  if (Platform.OS === 'ios') {
    try {
      const bundleUrl = NativeModules.DevSettings?.bundleURL as string | undefined;
      if (bundleUrl) {
        const match = bundleUrl.match(/^https?:\/\/([^:\/]+)/);
        if (match && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
          return match[1];
        }
      }
    } catch {}
  }

  // Method 4: __DEV__ global fetch to metro
  // The packager host is embedded in the error handler
  try {
    const devServer = (global as any).__METRO_GLOBAL_PREFIX__;
    if (devServer) return devServer;
  } catch {}

  return null;
}

/**
 * Get the composition server base URL.
 * Caches the result after first successful detection.
 */
export function getServerUrl(): string {
  if (_cachedUrl) return _cachedUrl;

  const host = getDevHost();
  if (host) {
    _cachedUrl = `http://${host}:${COMPOSITION_PORT}`;
    if (__DEV__) console.log(`[Server] Auto-detected: ${_cachedUrl}`);
    return _cachedUrl;
  }

  // Last resort: localhost (works on simulator)
  const fallback = `http://localhost:${COMPOSITION_PORT}`;
  if (__DEV__) console.log(`[Server] Using fallback: ${fallback}`);
  return fallback;
}

/**
 * Reset the cached URL (call if network changes).
 */
export function resetServerUrl(): void {
  _cachedUrl = null;
}
