import { useEffect, useState, useCallback } from 'react'
import { NativeModules, Platform } from 'react-native'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const { NotificationListenerModule } = NativeModules

// 로그인 후 로컬 큐 flush 콜백 타입
type OnPendingNotifications = (texts: string[]) => void

export function useAuth(onPendingNotifications?: OnPendingNotifications) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUserIdToNative = useCallback((userId: string | null) => {
    // Android 전용 — iOS는 NotificationListenerModule 없음
    if (Platform.OS !== 'android' || !NotificationListenerModule) return

    if (userId) {
      // 로그인: userId 저장 + 로컬 큐 flush
      NotificationListenerModule.setUserId(userId)
      NotificationListenerModule.getAndClearPendingNotifications().then(
        (texts: string[]) => {
          if (texts.length > 0 && onPendingNotifications) {
            onPendingNotifications(texts)
          }
        }
      )
    } else {
      // 로그아웃: userId 제거
      NotificationListenerModule.clearUserId()
    }
  }, [onPendingNotifications])

  useEffect(() => {
    // 앱 시작 시 저장된 세션 복원
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      syncUserIdToNative(session?.user?.id ?? null)
      setLoading(false)
    })

    // 로그인/로그아웃 이벤트 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      syncUserIdToNative(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [syncUserIdToNative])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { session, loading, signIn, signUp, signOut }
}
