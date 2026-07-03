import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateDedupKey } from '../_shared/dedup.ts'
import { resolveRequestUserId } from '../_shared/auth.ts'

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

interface TextPattern {
  provider: string
  regex: RegExp
  merchantIndex: number
  amountIndex: number
  monthIndex?: number
  dayIndex?: number
  hourIndex?: number
  minuteIndex?: number
  confidence: number
}

// 카드/페이 알림 패턴: 날짜 위치가 앞/뒤인 케이스를 모두 허용한다.
const CARD_PATTERNS = [
  {
    provider: '국민카드',
    regex: /\[(?:KB)?국민카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '국민카드',
    regex: /\[(?:KB)?국민카드\]\s+(.+?)\s+([\d,]+)원\s*(?:승인|이용|결제).+?(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/,
    merchantIndex: 1, amountIndex: 2, monthIndex: 3, dayIndex: 4, hourIndex: 5, minuteIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '신한카드',
    regex: /\[신한카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '삼성카드',
    regex: /\[삼성카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '현대카드',
    regex: /\[현대카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '토스',
    regex: /(?:토스|토스페이|Toss)\s+(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '토스',
    regex: /(?:토스|토스페이|Toss).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
  {
    provider: '카카오페이',
    regex: /(?:카카오페이|KakaoPay).+?(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '카카오페이',
    regex: /(?:카카오페이|KakaoPay).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
  {
    provider: '네이버페이',
    regex: /(?:네이버페이|NaverPay).+?(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '네이버페이',
    regex: /(?:네이버페이|NaverPay).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
] satisfies TextPattern[]

const GENERIC_AMOUNT_REGEX = /([\d,]+)원/
const NOISE_WORDS_REGEX = /\b(승인|결제|이용|체크카드|신용카드|일시불|누적|잔액|알림)\b/g
const DAY_MS = 24 * 60 * 60 * 1000

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

function cleanMerchant(value: string): string {
  return value
    .replace(NOISE_WORDS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekRange(base = new Date()) {
  const current = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(current.getTime() + mondayOffset * DAY_MS)
  const end = new Date(start.getTime() + 6 * DAY_MS)

  return {
    start,
    weekStartDate: formatDate(start),
    weekEndDate: formatDate(end),
  }
}

function getPreviousWeekStartDate(weekStart: Date): string {
  return formatDate(new Date(weekStart.getTime() - 7 * DAY_MS))
}

function calculateReportAccuracy(sourceCount: number, connectedCount: number): number {
  return Math.min(95, 45 + sourceCount * 15 + connectedCount * 5)
}

async function markWeeklyConnection(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  source: RequestBody['source'],
) {
  const { start, weekStartDate, weekEndDate } = getWeekRange()
  const previousWeekStartDate = getPreviousWeekStartDate(start)

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from('weekly_connection_status')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle(),
    supabase
      .from('weekly_connection_status')
      .select('streak_count')
      .eq('user_id', userId)
      .eq('week_start_date', previousWeekStartDate)
      .maybeSingle(),
  ])

  if (currentRes.error || previousRes.error) {
    console.error('weekly_connection_status 조회 실패', currentRes.error ?? previousRes.error)
    return
  }

  const current = currentRes.data as {
    connected_sources?: string[] | null
    connected_count?: number | null
    streak_count?: number | null
  } | null
  const previousStreak = previousRes.data?.streak_count ?? 0
  const connectedSources = Array.from(new Set([...(current?.connected_sources ?? []), source]))
  const connectedCount = (current?.connected_count ?? 0) + 1
  const streakCount = current?.streak_count ?? previousStreak + 1
  const reportAccuracy = calculateReportAccuracy(connectedSources.length, connectedCount)

  const { error } = await supabase
    .from('weekly_connection_status')
    .upsert({
      user_id: userId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      connected_sources: connectedSources,
      connected_count: connectedCount,
      report_accuracy: reportAccuracy,
      streak_count: streakCount,
      last_connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start_date' })

  if (error) {
    console.error('weekly_connection_status 저장 실패', error)
  }
}

function parseText(text: string): ParsedTransaction | null {
  const normalized = text.replace(/\s+/g, ' ').trim()

  // 1. 카드사 패턴 매칭
  for (const pattern of CARD_PATTERNS) {
    const m = normalized.match(pattern.regex)
    if (m) {
      const hasDate = pattern.monthIndex && pattern.dayIndex && pattern.hourIndex && pattern.minuteIndex
      return {
        merchant: cleanMerchant(m[pattern.merchantIndex]),
        amount: -parseAmountStr(m[pattern.amountIndex]),
        transaction_at: hasDate
          ? buildDate(
            m[pattern.monthIndex!],
            m[pattern.dayIndex!],
            m[pattern.hourIndex!],
            m[pattern.minuteIndex!],
          )
          : new Date(),
        confidence: pattern.confidence,
        needsAiAssist: pattern.confidence < 0.85,
      }
    }
  }

  // 2. 범용 금액 패턴 fallback
  const amountMatch = normalized.match(GENERIC_AMOUNT_REGEX)
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
  const { text, userId: requestedUserId, source }: RequestBody = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const auth = await resolveRequestUserId(req, supabase, SUPABASE_SERVICE_ROLE_KEY, requestedUserId)
  if (auth.error) return auth.error
  const userId = auth.userId!

  // 필수 파라미터 및 source 유효성 검증 (TypeScript 타입은 런타임에 강제되지 않음)
  if (!text) {
    return jsonResponse({ ok: false, error: '필수 파라미터 누락: text' }, 400)
  }
  if (!VALID_SOURCES.includes(source)) {
    return jsonResponse({ ok: false, error: `유효하지 않은 source: ${source}` }, 400)
  }

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
    await markWeeklyConnection(supabase, userId, source)

    supabase.functions.invoke('classify-transactions', {
      body: { userId, rawDataId: rawData.id },
    })
  }

  return jsonResponse({ ok: !txError, confidence: parsed.confidence, needsAiAssist: parsed.needsAiAssist })
})
