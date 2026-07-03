export type TabKey = 'home' | 'transactions' | 'review' | 'dashboard' | 'goals'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  is_system: boolean
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  merchant: string
  category_id: string | null
  ai_category: string | null
  confidence: number | null
  transaction_at: string
  source: 'csv' | 'share_intent' | 'paste' | 'notification' | 'ocr' | 'manual'
  status: 'auto_approved' | 'pending_review' | 'reviewed'
  memo: string | null
  categories?: Pick<Category, 'name' | 'icon' | 'color'> | null
}

export interface MonthlySummary {
  id: string
  year: number
  month: number
  category_id: string
  total_amount: number
  tx_count: number
  categories?: Pick<Category, 'name' | 'icon' | 'color'> | null
}

export interface Budget {
  id: string
  category_id: string
  amount: number
  categories?: Pick<Category, 'name' | 'icon' | 'color'> | null
}

export interface Goal {
  id: string
  title: string
  target_amount: number
  current_amount: number
  category_id: string | null
  is_active: boolean
  categories?: Pick<Category, 'name' | 'icon' | 'color'> | null
}

export interface ReceiptDraft {
  merchant: string
  amount: number
  transaction_at: string
  confidence: number
  raw_text?: string
}
