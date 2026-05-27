import React, { useEffect } from 'react'
import { DeviceEventEmitter, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import RootNavigator from './src/navigation/RootNavigator'
import { supabase } from './src/lib/supabase'

// Share Intent로 받은 텍스트를 parse-text Edge Function으로 전송
async function handleShareText(text: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // 로그인 전 공유 → 로그인 후 처리 (현재 MVP에서는 무시하고 알림만)
      Alert.alert('알림', '로그인 후 공유 기능을 사용할 수 있습니다')
      return
    }

    const { data, error } = await supabase.functions.invoke('parse-text', {
      body: {
        text,
        userId: user.id,
        source: 'share_intent',
      },
    })

    if (error) throw error

    const result = data as { ok: boolean; confidence?: number; needsAiAssist?: boolean }
    if (result.ok) {
      const pct = result.confidence != null ? Math.round(result.confidence * 100) : 0
      Alert.alert(
        '거래 등록 완료',
        `신뢰도 ${pct}%${result.needsAiAssist ? '\n카드사 패턴 미매칭 — AI 보조 분류 요청됨' : ''}`,
      )
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '처리 실패'
    Alert.alert('오류', message)
  }
}

export default function App() {
  useEffect(() => {
    // Share Intent 이벤트 구독
    const subscription = DeviceEventEmitter.addListener(
      'ShareIntentReceived',
      (event: { text: string }) => {
        if (event.text) {
          handleShareText(event.text)
        }
      }
    )
    return () => subscription.remove()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  )
}
