import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Budget, Category } from '../types'

export function useBudget(year: number, month: number) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    const [budgetRes, catRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .eq('period', 'monthly')
        .order('created_at'),
      supabase
        .from('categories')
        .select('*')
        .eq('is_system', true)
        .order('name'),
    ])
    setBudgets(budgetRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLoading(false)
  }, [year, month])

  const createBudget = useCallback(async (categoryId: string, amount: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인 필요')

    // 같은 카테고리 예산이 이미 있으면 upsert
    const { error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: user.id,
          category_id: categoryId,
          amount,
          period: 'monthly',
          year,
          month,
        },
        { onConflict: 'user_id,category_id,year,month,period' },
      )
    if (error) throw error
    await fetchBudgets()
  }, [year, month, fetchBudgets])

  const updateBudget = useCallback(async (budgetId: string, amount: number) => {
    const { error } = await supabase
      .from('budgets')
      .update({ amount })
      .eq('id', budgetId)
    if (error) throw error
    await fetchBudgets()
  }, [fetchBudgets])

  const deleteBudget = useCallback(async (budgetId: string) => {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId)
    if (error) throw error
    // 즉시 목록에서 제거 (optimistic)
    setBudgets(prev => prev.filter(b => b.id !== budgetId))
  }, [])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

  return { budgets, categories, loading, createBudget, updateBudget, deleteBudget, refresh: fetchBudgets }
}
