// DB row 형태 그대로 — 앱에서 사용하는 타입

export interface Transaction {
  id: string
  user_id: string
  raw_data_id: string | null
  amount: number             // 음수=지출, 양수=수입
  merchant: string
  category_id: string | null
  ai_category: string | null
  confidence: number | null
  transaction_at: string     // ISO 8601
  source: string
  status: 'auto_approved' | 'pending_review' | 'reviewed'
  dedup_key: string
  memo: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  parent_id: string | null
  is_system: boolean
}

export interface MonthlySummary {
  id: string
  user_id: string
  year: number
  month: number
  category_id: string
  total_amount: number
  tx_count: number
  updated_at: string
  // join 결과 (카테고리 정보)
  categories?: { name: string; icon: string; color: string }
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: 'monthly' | 'weekly'
  year: number
  month: number
  categories?: { name: string; icon: string; color: string }
}

export interface Goal {
  id: string
  user_id: string
  category_id: string | null
  title: string
  target_amount: number
  period: 'monthly' | 'weekly'
  year: number
  month: number
  is_active: boolean
  categories?: { name: string; icon: string; color: string }
}
