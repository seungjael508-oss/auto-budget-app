// @env 모듈 타입 선언 — react-native-dotenv가 .env를 읽어 주입한다
// 새 환경변수 추가 시 여기에도 추가할 것
declare module '@env' {
  export const SUPABASE_URL: string
  export const SUPABASE_ANON_KEY: string
}
