// src/engine/types.ts

// 입력 소스 타입 — manual 포함 (수동 직접 입력 시 사용)
export type TransactionSource =
  | 'csv'
  | 'share_intent'
  | 'paste'
  | 'notification'
  | 'ocr'
  | 'manual'   // 사용자가 앱에서 직접 입력

// 거래 처리 상태
export type TransactionStatus =
  | 'auto_approved'   // confidence >= 0.95, 자동 승인
  | 'pending_review'  // confidence < 0.95, 검수 대기
  | 'reviewed'        // 사용자 수동 검수 완료

export type RawDataStatus = 'pending' | 'parsed' | 'failed'

// 정규화 전 원시 거래 데이터 (파서 출력)
export interface RawTransaction {
  merchant: string
  amount: number // 음수=지출, 양수=수입
  transaction_at: Date
}

// 텍스트 파서 결과 (Share Intent / SMS)
export interface ParseResult {
  transaction: RawTransaction | null
  confidence: number     // 0.00 ~ 1.00
  needsAiAssist: boolean // Claude 보조 파싱 필요 여부
}

// DB transactions 테이블
export interface Transaction {
  id: string
  user_id: string
  raw_data_id: string | null
  amount: number
  merchant: string
  category_id: string | null
  ai_category: string | null  // AI 제안 카테고리 원본 보존
  confidence: number | null
  transaction_at: string      // ISO 8601 string
  source: TransactionSource
  status: TransactionStatus
  dedup_key: string
  memo: string | null
  created_at: string
  updated_at: string
}

// DB categories 테이블
export interface Category {
  id: string
  user_id: string | null  // null = 시스템 기본 카테고리
  name: string
  icon: string
  color: string
  parent_id: string | null
  is_system: boolean
}

// DB budgets 테이블 (MVP 포함)
export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: 'monthly' | 'weekly'
  year: number
  month: number
  created_at: string
}

// DB goals 테이블 최소버전 (MVP 포함)
export interface Goal {
  id: string
  user_id: string
  category_id: string | null  // null = 전체 지출 목표
  title: string               // "이번 달 식비 30만원 이하"
  target_amount: number
  period: 'monthly' | 'weekly'
  year: number
  month: number
  is_active: boolean
  created_at: string
}

// DB monthly_summary 테이블 (대시보드 읽기 모델)
export interface MonthlySummary {
  id: string
  user_id: string
  year: number
  month: number
  category_id: string
  total_amount: number
  tx_count: number
  updated_at: string
}
