import React, { useCallback } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoginScreen from '../screens/LoginScreen'
import AppTabs from './AppTabs'

const Stack = createNativeStackNavigator()

// 로그인 전 쌓인 알림 큐를 parse-text로 일괄 처리
async function flushNotificationQueue(texts: string[], userId: string) {
  for (const text of texts) {
    try {
      await supabase.functions.invoke('parse-text', {
        body: { text, userId, source: 'notification' },
      })
      console.log('[알림 큐 flush] 처리 완료:', text.slice(0, 30))
    } catch (e) {
      console.error('[알림 큐 flush] 오류:', e)
    }
  }
}

export default function RootNavigator() {
  // 로그인 직후 로컬 큐에 쌓인 알림을 parse-text로 전송
  const handlePendingNotifications = useCallback(async (texts: string[]) => {
    if (texts.length === 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    console.log(`[알림 큐] 로그인 후 ${texts.length}건 처리`)
    await flushNotificationQueue(texts, user.id)
  }, [])

  const { session, loading } = useAuth(handlePendingNotifications)

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session
          ? <Stack.Screen name="App" component={AppTabs} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}
