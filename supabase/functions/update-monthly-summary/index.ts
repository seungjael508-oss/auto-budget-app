import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// JSON 응답 헬퍼
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  const { userId, transactionIds }: { userId: string; transactionIds: string[] } = await req.json()

  // 필수 파라미터 검증
  if (!userId || !transactionIds?.length) {
    return jsonResponse({ ok: false, error: 'userId와 transactionIds 필수' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. 해당 거래 조회
  const { data: txList, error } = await supabase
    .from('transactions')
    .select('amount, category_id, transaction_at')
    .in('id', transactionIds)
    .eq('user_id', userId)

  if (error) {
    return jsonResponse({ ok: false, error: `거래 조회 실패: ${error.message}` }, 500)
  }

  if (!txList?.length) {
    return jsonResponse({ ok: true, updated: 0 })
  }

  // 2. 월별/카테고리별 집계
  type SummaryKey = string  // `${year}-${month}-${categoryId}`
  const summaryMap = new Map<SummaryKey, {
    year: number
    month: number
    categoryId: string
    total: number
    count: number
  }>()

  for (const tx of txList) {
    // 카테고리 미분류 거래는 집계 제외 (auto_approved 거래만 호출되지만 방어 처리)
    if (!tx.category_id) continue

    const d = new Date(tx.transaction_at)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const key: SummaryKey = `${year}-${month}-${tx.category_id}`

    const existing = summaryMap.get(key) ?? { year, month, categoryId: tx.category_id, total: 0, count: 0 }
    existing.total += tx.amount
    existing.count += 1
    summaryMap.set(key, existing)
  }

  if (summaryMap.size === 0) {
    return jsonResponse({ ok: true, updated: 0 })
  }

  // 3. monthly_summary upsert (대시보드 읽기 모델 갱신)
  // ⚠️ MVP 설계 한계: Supabase JS 클라이언트의 upsert는 충돌 시 기존 행을 완전히 덮어씀.
  // 즉, 이번 배치(transactionIds)의 합계만 반영되며, 해당 월의 누적 합계가 아님.
  // 올바른 구현: PostgreSQL RPC로 ON CONFLICT DO UPDATE SET total_amount = monthly_summary.total_amount + EXCLUDED.total_amount
  // → post-MVP 개선 항목
  const summaries = Array.from(summaryMap.values()).map(s => ({
    user_id: userId,
    year: s.year,
    month: s.month,
    category_id: s.categoryId,
    total_amount: s.total,
    tx_count: s.count,
  }))

  const { error: upsertError } = await supabase
    .from('monthly_summary')
    .upsert(summaries, { onConflict: 'user_id,year,month,category_id' })

  if (upsertError) {
    return jsonResponse({ ok: false, error: `monthly_summary 갱신 실패: ${upsertError.message}` }, 500)
  }

  return jsonResponse({ ok: true, updated: summaries.length })
})
