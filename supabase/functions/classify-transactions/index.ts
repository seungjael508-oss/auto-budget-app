import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { resolveRequestUserId } from '../_shared/auth.ts'

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
  const { userId: requestedUserId, rawDataId, transactionIds }: ClassifyRequest = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const auth = await resolveRequestUserId(req, supabase, SUPABASE_SERVICE_ROLE_KEY, requestedUserId)
  if (auth.error) return auth.error
  const userId = auth.userId!

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
      // 힌트 기반 분류: AUTO_APPROVE_THRESHOLD(0.95)보다 높은 0.97로 고신뢰 자동 승인
      // ai_category는 null (Claude 미호출, 힌트 학습 결과 적용)
      updates.push({
        id: tx.id,
        category_id: hint.category_id,
        ai_category: undefined,  // 힌트 적용 = AI 미사용, 명시적 null
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

    // Claude 성공 시에만 categories 조회 + updates 추가 (Claude 실패 = aiResults 빈 배열)
    if (aiResults.length > 0) {
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
  }

  // 4. 거래 상태 병렬 업데이트 (직렬 루프 대신 Promise.all로 DB 왕복 최소화)
  await Promise.all(
    updates.map(u =>
      supabase.from('transactions').update({
        category_id: u.category_id,
        ai_category: u.ai_category ?? null,
        confidence: u.confidence,
        status: u.status,
      }).eq('id', u.id)
    )
  )

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
