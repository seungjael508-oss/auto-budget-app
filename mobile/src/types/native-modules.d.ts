// NativeModules 타입 확장 — Android 전용 NativeModule 선언
// iOS에서는 이 모듈들이 undefined — 호출 전 null 체크 필수
import 'react-native'

declare module 'react-native' {
  interface NativeModulesStatic {
    NotificationListenerModule: {
      isPermissionGranted: () => Promise<boolean>
      openPermissionSettings: () => void
      setUserId: (userId: string) => void
      setUserSession: (userId: string, accessToken: string) => void
      clearUserId: () => void
      getAndClearPendingNotifications: () => Promise<string[]>
      removePendingNotifications: (processedTexts: string[]) => void
    }
  }
}
