import { supabase } from './supabase'

export type TextInputSource = 'share_intent' | 'paste' | 'notification'

export interface TextIngestionResult {
  ok: boolean
  confidence?: number
  needsAiAssist?: boolean
  message: string
}

export async function ingestTransactionText(
  text: string,
  source: TextInputSource,
): Promise<TextIngestionResult> {
  const normalized = text.trim()
  if (!normalized) {
    throw new Error('거래 알림 내용을 입력해주세요')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  const { data, error } = await supabase.functions.invoke('parse-text', {
    body: {
      text: normalized,
      userId: user.id,
      source,
    },
  })

  if (error) throw error

  const result = data as { ok: boolean; confidence?: number; needsAiAssist?: boolean; error?: string }
  if (!result.ok) {
    throw new Error(result.error ?? '거래 정보를 찾지 못했습니다')
  }

  const pct = result.confidence != null ? Math.round(result.confidence * 100) : 0

  return {
    ok: result.ok,
    confidence: result.confidence,
    needsAiAssist: result.needsAiAssist,
    message: `거래 등록 완료 · 신뢰도 ${pct}%${result.needsAiAssist ? '\nAI 보조 분류 대기 중' : ''}`,
  }
}
