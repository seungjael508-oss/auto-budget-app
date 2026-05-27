import React, { useCallback, useEffect, useState } from 'react'
import {
  AppState,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import Card from '../components/ui/Card'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'

const { NotificationListenerModule } = NativeModules

export default function NotificationPermissionScreen() {
  const [granted, setGranted] = useState<boolean | null>(null)

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || !NotificationListenerModule) return
    const isGranted: boolean = await NotificationListenerModule.isPermissionGranted()
    setGranted(isGranted)
  }, [])

  useEffect(() => {
    checkPermission()

    // 설정에서 돌아올 때 권한 재체크
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermission()
    })
    return () => sub.remove()
  }, [checkPermission])

  const handleOpenSettings = () => {
    NotificationListenerModule?.openPermissionSettings()
  }

  if (granted === null) return null  // 권한 확인 전 빈 화면

  return (
    <>
      <TopBar title="자동 수집 설정" />
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.title}>카드 알림 자동 수집</Text>
          <Text style={styles.desc}>
            카드사 앱 결제 알림을 받으면 자동으로 거래가 기록됩니다.{'\n'}
            별도 입력 없이 소비가 정리됩니다.
          </Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>이 권한이 필요한 이유</Text>
            <Text style={styles.reasonDesc}>
              앱이 꺼져 있어도 카드 승인 알림을 받아야 자동 수집이 됩니다.
              알림 내용은 본인의 거래 기록 저장에만 사용되며, 외부로 전송되지 않습니다.
            </Text>
          </View>

          {granted ? (
            <View style={styles.grantedBadge}>
              <Text style={styles.grantedText}>✅ 알림 접근 허가됨</Text>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={handleOpenSettings}>
              <Text style={styles.buttonText}>Android 설정에서 허가하기</Text>
            </Pressable>
          )}
        </Card>

        {!granted && (
          <Text style={styles.guide}>
            설정 → 특별한 앱 접근권한 → 알림 접근 → 자동화가계부 활성화
          </Text>
        )}
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
    textAlign: 'center',
  },
  desc: {
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  reasonBox: {
    width: '100%',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reasonTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray900,
  },
  reasonDesc: {
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  grantedBadge: {
    backgroundColor: '#E6F4EA',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  grantedText: {
    color: colors.success,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  guide: {
    marginTop: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
