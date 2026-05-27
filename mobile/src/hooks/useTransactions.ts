import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Transaction, Category } from '../types'

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

  const approveTransaction = useCallback(async (txId: string) => {
    // 오른쪽 스와이프: AI 카테고리 그대로 승인
    await supabase
      .from('transactions')
      .update({ status: 'reviewed' })
      .eq('id', txId)
    await fetchTransactions()
  }, [fetchTransactions])

  const changeCategory = useCallback(async (
    txId: string,
    merchant: string,
    newCategoryId: string
  ) => {
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

    await fetchTransactions()
  }, [fetchTransactions])

  const approveAllHighConfidence = useCallback(async () => {
    // 배치 승인: confidence >= 0.80인 pending_review 거래 일괄 승인
    await supabase
      .from('transactions')
      .update({ status: 'reviewed' })
      .eq('status', 'pending_review')
      .gte('confidence', 0.80)
    await fetchTransactions()
  }, [fetchTransactions])

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
