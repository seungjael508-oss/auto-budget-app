import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Transaction, Category } from '../types'

// update-monthly-summary Edge Function 호출 (fire-and-forget)
async function triggerMonthlySummaryUpdate(txIds: string[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !txIds.length) return

    await supabase.functions.invoke('update-monthly-summary', {
      body: { userId: user.id, transactionIds: txIds },
    })
  } catch (err) {
    // 집계 실패는 UI를 막지 않음 — 로그만 기록
    console.error('[useTransactions] monthly_summary 갱신 실패:', err)
  }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('is_system', { ascending: false })
    setCategories(data ?? [])
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_at', { ascending: false })
      .limit(100)
    setTransactions(data ?? [])
    setPendingCount((data ?? []).filter(t => t.status === 'pending_review').length)
    setLoading(false)
  }, [])

  // 조용한 백그라운드 동기화 — loading 깜빡임 없음
  const syncTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_at', { ascending: false })
      .limit(100)
    setTransactions(data ?? [])
    setPendingCount((data ?? []).filter(t => t.status === 'pending_review').length)
  }, [])

  const approveTransaction = useCallback(async (txId: string) => {
    // 즉시 목록에서 제거 (optimistic UI)
    setTransactions(prev => prev.filter(t => t.id !== txId))
    setPendingCount(prev => Math.max(0, prev - 1))

    await supabase
      .from('transactions')
      .update({ status: 'reviewed' })
      .eq('id', txId)

    // 월간 집계 갱신 + DB 동기화
    triggerMonthlySummaryUpdate([txId])
    syncTransactions()
  }, [syncTransactions])

  const changeCategory = useCallback(async (
    txId: string,
    merchant: string,
    newCategoryId: string
  ) => {
    // 즉시 카테고리 + 상태 업데이트 (optimistic UI)
    setTransactions(prev => prev.map(t =>
      t.id === txId
        ? { ...t, category_id: newCategoryId, status: 'reviewed' as const }
        : t
    ))
    setPendingCount(prev => Math.max(0, prev - 1))

    // 왼쪽 스와이프: 카테고리 수정 후 승인
    await supabase
      .from('transactions')
      .update({ status: 'reviewed', category_id: newCategoryId })
      .eq('id', txId)

    // 힌트 학습: 동일 merchant 분류 시 Claude 비용 절감
    const { data: existing } = await supabase
      .from('user_category_hints')
      .select('id, hit_count')
      .eq('merchant', merchant)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('user_category_hints')
        .update({ category_id: newCategoryId, hit_count: existing.hit_count + 1 })
        .eq('id', existing.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_category_hints').insert({
          user_id: user.id,
          merchant,
          category_id: newCategoryId,
          hit_count: 1,
        })
      }
    }

    triggerMonthlySummaryUpdate([txId])
    syncTransactions()
  }, [syncTransactions])

  const approveAllHighConfidence = useCallback(async () => {
    // 배치 승인 대상 ID 추출
    const targetIds = transactions
      .filter(t => t.status === 'pending_review' && (t.confidence ?? 0) >= 0.80)
      .map(t => t.id)

    if (!targetIds.length) return

    // 즉시 목록에서 제거 (optimistic UI)
    setTransactions(prev => prev.filter(t => !targetIds.includes(t.id)))
    setPendingCount(prev => Math.max(0, prev - targetIds.length))

    // confidence >= 0.80인 pending_review 거래 일괄 승인
    await supabase
      .from('transactions')
      .update({ status: 'reviewed' })
      .eq('status', 'pending_review')
      .gte('confidence', 0.80)

    triggerMonthlySummaryUpdate(targetIds)
    syncTransactions()
  }, [transactions, syncTransactions])

  useEffect(() => {
    fetchCategories()
    fetchTransactions()
  }, [fetchCategories, fetchTransactions])

  return {
    transactions,
    categories,
    loading,
    pendingCount,
    approveTransaction,
    changeCategory,
    approveAllHighConfidence,
    refresh: fetchTransactions,
  }
}
