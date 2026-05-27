import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env'

// ANON KEY는 공개 키 — RLS가 데이터 보호를 담당
// SERVICE_ROLE_KEY는 절대 앱에 포함하지 않는다 (Edge Function 전용)
// 환경값은 mobile/.env에 보관, git에 커밋되지 않음
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
