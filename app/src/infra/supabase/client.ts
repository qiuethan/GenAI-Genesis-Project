import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra =
  Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  (Constants as any).manifest2?.extra?.expoClient?.extra ??
  {};

const SUPABASE_URL: string = extra.supabaseUrl;
const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey;

export { SUPABASE_URL };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
