import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateDedupKey } from '../_shared/dedup.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RequestBody {
  text: string            // Share Intent로 받은 원문 텍스트
  userId: string
  source: 'share_intent' | 'paste' | 'notification'
}

interface ParsedTransaction {
  merchant: string
  amount: number
  transaction_at: Date
  confidence: number
  needsAiAssist: boolean
}

// 카드사별 패턴: [카드사명] MM/DD HH:mm 상호명 N,NNN원 승인
const CARD_PATTERNS = [
  { name: '국민카드',  regex: /\[국민카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/ },
  { name: '신한카드',  regex: /\[신한카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/ },
  { name: '삼성카드',  regex: /\[삼성카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/ },
  { name: '현대카드',  regex: /\[현대카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/ },
]

const GENERIC_AMOUNT_REGEX = /([\d,]+)원/

// 유효한 source 값 (runtime 검증용)
const VALID_SOURCES = ['share_intent', 'paste', 'notification'] as const

// JSON 응답 헬퍼 (Content-Type 항상 포함)
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseAmountStr(val: string): number {
  return parseInt(val.replace(/,/g, ''), 10)
}

function buildDate(month: string, day: string, hour: string, minute: string): Date {
  const now = new Date()
  return new Date(now.getFullYear(), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10))
}

function parseText(text: string): ParsedTransaction | null {
  // 1. 카드사 패턴 매칭
  for (const { regex } of CARD_PATTERNS) {
    const m = text.match(regex)
    if (m) {
      return {
        merchant: m[5].trim(),
        amount: -parseAmountStr(m[6]),  // 승인 = 지출(음수)
        transaction_at: buildDate(m[1], m[2], m[3], m[4]),
        confidence: 0.90,
        needsAiAssist: false,
      }
    }
  }

  // 2. 범용 금액 패턴 fallback
  const amountMatch = text.match(GENERIC_AMOUNT_REGEX)
  if (amountMatch) {
    return {
      merchant: '알 수 없음',
      amount: -parseAmountStr(amountMatch[1]),
      transaction_at: new Date(),
      confidence: 0.40,
      needsAiAssist: true,  // Claude 보조 파싱 필요
    }
  }

  return null  // 거래 정보 없음
}

serve(async (req: Request) => {
  const { text, userId, source }: RequestBody = await req.json()

  // 필수 파라미터 및 source 유효성 검증 (TypeScript 타입은 런타임에 강제되지 않음)
  if (!text || !userId) {
    return jsonResponse({ ok: false, error: '필수 파라미터 누락: text, userId' }, 400)
  }
  if (!VALID_SOURCES.includes(source)) {
    return jsonResponse({ ok: false, error: `유효하지 않은 source: ${source}` }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. raw_data에 원본 텍스트 저장 (파싱 전 보존)
  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .insert({
      user_id: userId,
      source,
      raw_content: text,
      status: 'pending',
    })
    .select('id')
    .single()

  if (rawError) {
    return jsonResponse({ ok: false, error: `raw_data 저장 실패: ${rawError.message}` }, 500)
  }

  // 2. 텍스트 파싱
  const parsed = parseText(text)

  if (!parsed) {
    await supabase.from('raw_data').update({
      status: 'failed',
      error_message: '거래 정보를 찾을 수 없습니다',
    }).eq('id', rawData.id)
    return jsonResponse({ ok: false, error: 'no transaction found' }, 422)
  }

  // 3. dedup_key 생성 + transaction insert
  const dedupKey = await generateDedupKey({
    userId,
    amount: parsed.amount,
    merchant: parsed.merchant,
    transactionAt: parsed.transaction_at,
  })

  const { error: txError } = await supabase
    .from('transactions')
    .upsert({
      user_id: userId,
      raw_data_id: rawData.id,
      amount: parsed.amount,
      merchant: parsed.merchant,
      transaction_at: parsed.transaction_at.toISOString(),
      source,
      status: 'pending_review',
      dedup_key: dedupKey,
      confidence: parsed.confidence,
    }, { onConflict: 'dedup_key', ignoreDuplicates: true })

  await supabase.from('raw_data').update({
    status: txError ? 'failed' : 'parsed',
    error_message: txError?.message ?? null,
  }).eq('id', rawData.id)

  if (!txError) {
    // 4. AI 분류 요청 (fire-and-forget)
    supabase.functions.invoke('classify-transactions', {
      body: { userId, rawDataId: rawData.id },
    })
  }

  return jsonResponse({ ok: !txError, confidence: parsed.confidence, needsAiAssist: parsed.needsAiAssist })
})
