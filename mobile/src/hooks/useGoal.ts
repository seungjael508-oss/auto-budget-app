import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Goal, Category } from '../types'

export function useGoal(year: number, month: number) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    const [goalRes, catRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*, categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .eq('is_active', true)
        .order('created_at'),
      supabase
        .from('categories')
        .select('*')
        .eq('is_system', true)
        .order('name'),
    ])
    setGoals(goalRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLoading(false)
  }, [year, month])

  const createGoal = useCallback(async (params: {
    title: string
    categoryId: string | null
    targetAmount: number
    period: 'monthly' | 'weekly'
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인 필요')

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      category_id: params.categoryId,
      title: params.title,
      target_amount: params.targetAmount,
      period: params.period,
      year,
      month,
      is_active: true,
    })
    if (error) throw error
    await fetchGoals()
  }, [year, month, fetchGoals])

  const updateGoal = useCallback(async (goalId: string, params: {
    title: string
    categoryId: string | null
    targetAmount: number
    period: 'monthly' | 'weekly'
  }) => {
    const { error } = await supabase
      .from('goals')
      .update({
        title: params.title,
        category_id: params.categoryId,
        target_amount: params.targetAmount,
        period: params.period,
      })
      .eq('id', goalId)
    if (error) throw error
    await fetchGoals()
  }, [fetchGoals])

  const deleteGoal = useCallback(async (goalId: string) => {
    const { error } = await supabase
      .from('goals')
      .update({ is_active: false })  // hard delete 대신 비활성화
      .eq('id', goalId)
    if (error) throw error
    // 즉시 목록에서 제거 (optimistic)
    setGoals(prev => prev.filter(g => g.id !== goalId))
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  return { goals, categories, loading, createGoal, updateGoal, deleteGoal, refresh: fetchGoals }
}
