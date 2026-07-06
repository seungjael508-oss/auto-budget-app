// mobile/src/hooks/useCategories.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Category } from '../types'

// ManualEntryScreen과 ReceiptConfirmScreen에서 카테고리 선택에 공용 사용
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('is_system', { ascending: false })
      setCategories(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return { categories, loading }
}
