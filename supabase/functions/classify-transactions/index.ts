import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// 설계 원칙: confidence >= 0.95만 자동 승인
const AUTO_APPROVE_THRESHOLD = 0.95
const BATCH_SIZE = 20
const CATEGORY_LIST = ['식비', '교통', '의료', '쇼핑', '구독', '이체', '기타']

interface ClassifyRequest {
  userId: string
  rawDataId?: string
  transactionIds?: string[]
}

// JSON 응답 헬퍼
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  const { userId, rawDataId, transactionIds }: ClassifyRequest = await req.json()

  if (!userId) {
    return jsonResponse({ ok: false, error: 'userId 필수' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  // 1. 분류 대기 거래 조회 (최대 20건 배치)
  let query = supabase
    .from('transactions')
    .select('id, merchant, amount')
    .eq('user_id', userId)
    .eq('status', 'pending_review')
    .limit(BATCH_SIZE)

  if (rawDataId) query = query.eq('raw_data_id', rawDataId)
  if (transactionIds?.length) query = query.in('id', transactionIds)

  const { data: txList, error: queryError } = await query

  if (queryError) {
    return jsonResponse({ ok: false, error: `거래 조회 실패: ${queryError.message}` }, 500)
  }

  if (!txList?.length) {
    return jsonResponse({ ok: true, processed: 0, autoApproved: 0 })
  }

  // 2. user_category_hints 먼저 확인 (Claude 호출 절약)
  const merchants = [...new Set(txList.map(t => t.merchant))]
  const { data: hints } = await supabase
    .from('user_category_hints')
    .select('merchant, category_id, hit_count')
    .eq('user_id', userId)
    .in('merchant', merchants)

  // hit_count >= 3인 힌트만 신뢰 (3번 같은 분류 = 패턴 확정)
  const hintMap = new Map(
    (hints ?? []).filter(h => h.hit_count >= 3).map(h => [h.merchant, h])
  )

  interface UpdateRecord {
    id: string
    category_id: string | null
    ai_category?: string
    confidence: number
    status: string
  }

  const updates: UpdateRecord[] = []
  const needsAi: typeof txList = []

  for (const tx of txList) {
    const hint = hintMap.get(tx.merchant)
    if (hint) {
      updates.push({
        id: tx.id,
        category_id: hint.category_id,
        confidence: 0.97,
        status: 'auto_approved',
      })
    } else {
      needsAi.push(tx)
    }
  }

  // 3. Claude haiku 배치 분류
  if (needsAi.length > 0) {
    interface AiResult {
      id: string
      category: string
      confidence: number
    }
    let aiResults: AiResult[] = []

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `너는 한국 가계부 분류 전문가야.
카테고리 목록: ${CATEGORY_LIST.join(', ')}
JSON 배열로만 응답해. 다른 텍스트 포함 금지.
형식: [{"id":"...","category":"...","confidence":0.0~1.0}]`,
        messages: [{
          role: 'user',
          content: JSON.stringify(needsAi.map(t => ({ id: t.id, merchant: t.merchant, amount: t.amount }))),
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
      aiResults = JSON.parse(text) as AiResult[]
    } catch (e) {
      // Claude 타임아웃/파싱 실패: pending_review 유지 후 재시도 큐 (에러 처리 원칙)
      console.error('Claude 분류 실패, pending_review 유지:', e)
    }

    // 카테고리 이름 → DB ID 변환
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_system', true)
    const catMap = new Map((cats ?? []).map(c => [c.name, c.id]))

    for (const r of aiResults) {
      updates.push({
        id: r.id,
        category_id: catMap.get(r.category) ?? null,
        ai_category: r.category,
        confidence: r.confidence,
        status: r.confidence >= AUTO_APPROVE_THRESHOLD ? 'auto_approved' : 'pending_review',
      })
    }
  }

  // 4. 거래 상태 일괄 업데이트
  for (const u of updates) {
    await supabase.from('transactions').update({
      category_id: u.category_id,
      ai_category: u.ai_category ?? null,
      confidence: u.confidence,
      status: u.status,
    }).eq('id', u.id)
  }

  // 5. auto_approved → monthly_summary 갱신 (fire-and-forget)
  const approvedIds = updates.filter(u => u.status === 'auto_approved').map(u => u.id)
  if (approvedIds.length > 0) {
    supabase.functions.invoke('update-monthly-summary', {
      body: { userId, transactionIds: approvedIds },
    })
  }

  return jsonResponse({
    ok: true,
    processed: updates.length,
    autoApproved: approvedIds.length,
  })
})
