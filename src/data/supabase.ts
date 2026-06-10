// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
const supabaseUrl = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
