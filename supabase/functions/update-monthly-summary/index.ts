import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveRequestUserId } from '../_shared/auth.ts'

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
  const { userId: requestedUserId, transactionIds }: { userId: string; transactionIds: string[] } = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const auth = await resolveRequestUserId(req, supabase, SUPABASE_SERVICE_ROLE_KEY, requestedUserId)
  if (auth.error) return auth.error
  const userId = auth.userId!

  // 필수 파라미터 검증
  if (!transactionIds?.length) {
    return jsonResponse({ ok: false, error: 'transactionIds 필수' }, 400)
  }

  // 1. 변경된 거래가 속한 월을 찾는다.
  const { data: txList, error } = await supabase
    .from('transactions')
    .select('transaction_at')
    .in('id', transactionIds)
    .eq('user_id', userId)

  if (error) {
    return jsonResponse({ ok: false, error: `거래 조회 실패: ${error.message}` }, 500)
  }

  if (!txList?.length) {
    return jsonResponse({ ok: true, updated: 0 })
  }

  const months = new Map<string, { year: number; month: number; start: Date; end: Date }>()
  for (const tx of txList) {
    const d = new Date(tx.transaction_at)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    months.set(`${year}-${month}`, { year, month, start, end })
  }

  let updated = 0

  // 2. 변경 거래가 포함된 월 전체를 재계산한다.
  for (const period of months.values()) {
    const { data: monthTx, error: monthError } = await supabase
      .from('transactions')
      .select('amount, category_id')
      .eq('user_id', userId)
      .in('status', ['auto_approved', 'reviewed'])
      .gte('transaction_at', period.start.toISOString())
      .lt('transaction_at', period.end.toISOString())

    if (monthError) {
      return jsonResponse({ ok: false, error: `월 거래 조회 실패: ${monthError.message}` }, 500)
    }

    const summaryMap = new Map<string, { total: number; count: number }>()
    for (const tx of monthTx ?? []) {
      if (!tx.category_id) continue
      const existing = summaryMap.get(tx.category_id) ?? { total: 0, count: 0 }
      existing.total += tx.amount
      existing.count += 1
      summaryMap.set(tx.category_id, existing)
    }

    const { error: deleteError } = await supabase
      .from('monthly_summary')
      .delete()
      .eq('user_id', userId)
      .eq('year', period.year)
      .eq('month', period.month)

    if (deleteError) {
      return jsonResponse({ ok: false, error: `기존 monthly_summary 삭제 실패: ${deleteError.message}` }, 500)
    }

    const summaries = Array.from(summaryMap.entries()).map(([categoryId, s]) => ({
      user_id: userId,
      year: period.year,
      month: period.month,
      category_id: categoryId,
      total_amount: s.total,
      tx_count: s.count,
    }))

    if (summaries.length > 0) {
      const { error: upsertError } = await supabase
        .from('monthly_summary')
        .upsert(summaries, { onConflict: 'user_id,year,month,category_id' })

      if (upsertError) {
        return jsonResponse({ ok: false, error: `monthly_summary 갱신 실패: ${upsertError.message}` }, 500)
      }
    }
    updated += summaries.length
  }

  return jsonResponse({ ok: true, updated })
})
