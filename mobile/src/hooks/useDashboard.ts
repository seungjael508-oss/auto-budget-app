import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MonthlySummary, Budget, Goal } from '../types'

export function useDashboard(year: number, month: number) {
  const [summaries, setSummaries] = useState<MonthlySummary[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [summaryRes, budgetRes, goalRes] = await Promise.all([
      // 이번 달 카테고리별 집계 (categories join)
      supabase
        .from('monthly_summary')
        .select('*, categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .order('total_amount'),

      // 이번 달 예산 (categories join)
      supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .eq('period', 'monthly'),

      // 활성 목표 (categories join)
      supabase
        .from('goals')
        .select('*, categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .eq('is_active', true),
    ])

    setSummaries(summaryRes.data ?? [])
    setBudgets(budgetRes.data ?? [])
    setGoals(goalRes.data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetch() }, [fetch])

  // 이번 달 총 지출 (음수 합산 → 절댓값)
  const totalExpense = summaries
    .filter(s => s.total_amount < 0)
    .reduce((acc, s) => acc + Math.abs(s.total_amount), 0)

  // 이번 달 총 수입
  const totalIncome = summaries
    .filter(s => s.total_amount > 0)
    .reduce((acc, s) => acc + s.total_amount, 0)

  return { summaries, budgets, goals, loading, totalExpense, totalIncome, refresh: fetch }
}
