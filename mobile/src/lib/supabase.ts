import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ANON KEY는 공개 키 — RLS가 데이터 보호를 담당
// SERVICE_ROLE_KEY는 절대 앱에 포함하지 않는다 (Edge Function 전용)
// Supabase Dashboard → Settings → API에서 복사
const SUPABASE_URL = 'https://<your-project-ref>.supabase.co'
const SUPABASE_ANON_KEY = '<your-anon-key>'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
