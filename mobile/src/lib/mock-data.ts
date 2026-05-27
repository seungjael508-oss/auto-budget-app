// 오프라인/개발 테스트용 샘플 데이터
// Supabase 연결 실패 시 fallback으로 사용 (실제 배포에서는 미사용)

import { Transaction, Category, MonthlySummary, Budget, Goal } from '../types'

const USER_ID = 'mock-user-id'
const now = new Date()
const thisYear  = now.getFullYear()
const thisMonth = now.getMonth() + 1

// ── 카테고리 ──────────────────────────────────────────────────
export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', user_id: null, name: '식비',   icon: '🍽️', color: '#EF4444', parent_id: null, is_system: true },
  { id: 'cat-2', user_id: null, name: '교통',   icon: '🚌', color: '#3B82F6', parent_id: null, is_system: true },
  { id: 'cat-3', user_id: null, name: '의료',   icon: '🏥', color: '#10B981', parent_id: null, is_system: true },
  { id: 'cat-4', user_id: null, name: '쇼핑',   icon: '🛍️', color: '#8B5CF6', parent_id: null, is_system: true },
  { id: 'cat-5', user_id: null, name: '구독',   icon: '📱', color: '#F59E0B', parent_id: null, is_system: true },
  { id: 'cat-6', user_id: null, name: '이체',   icon: '💸', color: '#6B7280', parent_id: null, is_system: true },
  { id: 'cat-7', user_id: null, name: '기타',   icon: '📌', color: '#9CA3AF', parent_id: null, is_system: true },
]

// ── 거래 내역 ─────────────────────────────────────────────────
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1', user_id: USER_ID, raw_data_id: null,
    amount: -8500, merchant: '스타벅스 강남점',
    category_id: 'cat-1', ai_category: '식비', confidence: 0.97,
    transaction_at: new Date(thisYear, thisMonth - 1, 25, 9, 30).toISOString(),
    source: 'csv', status: 'auto_approved', dedup_key: 'dk-1',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-2', user_id: USER_ID, raw_data_id: null,
    amount: -1500, merchant: 'T머니 충전',
    category_id: 'cat-2', ai_category: '교통', confidence: 0.99,
    transaction_at: new Date(thisYear, thisMonth - 1, 24, 18, 0).toISOString(),
    source: 'csv', status: 'auto_approved', dedup_key: 'dk-2',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-3', user_id: USER_ID, raw_data_id: null,
    amount: -45000, merchant: '올리브영 신촌',
    category_id: 'cat-4', ai_category: '쇼핑', confidence: 0.88,
    transaction_at: new Date(thisYear, thisMonth - 1, 23, 14, 15).toISOString(),
    source: 'csv', status: 'pending_review', dedup_key: 'dk-3',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-4', user_id: USER_ID, raw_data_id: null,
    amount: -13900, merchant: '넷플릭스',
    category_id: 'cat-5', ai_category: '구독', confidence: 0.99,
    transaction_at: new Date(thisYear, thisMonth - 1, 22, 0, 0).toISOString(),
    source: 'csv', status: 'auto_approved', dedup_key: 'dk-4',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-5', user_id: USER_ID, raw_data_id: null,
    amount: 2500000, merchant: '급여',
    category_id: 'cat-6', ai_category: '이체', confidence: 0.95,
    transaction_at: new Date(thisYear, thisMonth - 1, 25, 9, 0).toISOString(),
    source: 'csv', status: 'auto_approved', dedup_key: 'dk-5',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-6', user_id: USER_ID, raw_data_id: null,
    amount: -32000, merchant: '동네 슈퍼',
    category_id: null, ai_category: null, confidence: null,
    transaction_at: new Date(thisYear, thisMonth - 1, 21, 11, 0).toISOString(),
    source: 'csv', status: 'pending_review', dedup_key: 'dk-6',
    memo: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

// ── 예산 ──────────────────────────────────────────────────────
export const MOCK_BUDGETS: Budget[] = [
  {
    id: 'bud-1', user_id: USER_ID,
    category_id: 'cat-1', amount: 400000,
    period: 'monthly', year: thisYear, month: thisMonth,
    categories: { name: '식비', icon: '🍽️', color: '#EF4444' },
  },
  {
    id: 'bud-2', user_id: USER_ID,
    category_id: 'cat-2', amount: 80000,
    period: 'monthly', year: thisYear, month: thisMonth,
    categories: { name: '교통', icon: '🚌', color: '#3B82F6' },
  },
  {
    id: 'bud-3', user_id: USER_ID,
    category_id: 'cat-4', amount: 150000,
    period: 'monthly', year: thisYear, month: thisMonth,
    categories: { name: '쇼핑', icon: '🛍️', color: '#8B5CF6' },
  },
]

// ── 월간 요약 (대시보드용) ─────────────────────────────────────
export const MOCK_SUMMARY: MonthlySummary[] = [
  {
    id: 'sum-1', user_id: USER_ID,
    year: thisYear, month: thisMonth,
    category_id: 'cat-1', total_amount: 310000, tx_count: 12,
    updated_at: new Date().toISOString(),
    categories: { name: '식비', icon: '🍽️', color: '#EF4444' },
  },
  {
    id: 'sum-2', user_id: USER_ID,
    year: thisYear, month: thisMonth,
    category_id: 'cat-2', total_amount: 52000, tx_count: 8,
    updated_at: new Date().toISOString(),
    categories: { name: '교통', icon: '🚌', color: '#3B82F6' },
  },
  {
    id: 'sum-3', user_id: USER_ID,
    year: thisYear, month: thisMonth,
    category_id: 'cat-4', total_amount: 45000, tx_count: 1,
    updated_at: new Date().toISOString(),
    categories: { name: '쇼핑', icon: '🛍️', color: '#8B5CF6' },
  },
  {
    id: 'sum-4', user_id: USER_ID,
    year: thisYear, month: thisMonth,
    category_id: 'cat-5', total_amount: 27800, tx_count: 2,
    updated_at: new Date().toISOString(),
    categories: { name: '구독', icon: '📱', color: '#F59E0B' },
  },
]

// ── 목표 ──────────────────────────────────────────────────────
export const MOCK_GOALS: Goal[] = [
  {
    id: 'goal-1', user_id: USER_ID,
    category_id: null,
    title: '이번 달 총 지출 100만원 이하',
    target_amount: 1000000,
    period: 'monthly', year: thisYear, month: thisMonth,
    is_active: true,
    categories: undefined,
  },
  {
    id: 'goal-2', user_id: USER_ID,
    category_id: 'cat-1',
    title: '식비 40만원 이하',
    target_amount: 400000,
    period: 'monthly', year: thisYear, month: thisMonth,
    is_active: true,
    categories: { name: '식비', icon: '🍽️', color: '#EF4444' },
  },
  {
    id: 'goal-3', user_id: USER_ID,
    category_id: 'cat-4',
    title: '쇼핑 15만원 이하',
    target_amount: 150000,
    period: 'monthly', year: thisYear, month: thisMonth,
    is_active: true,
    categories: { name: '쇼핑', icon: '🛍️', color: '#8B5CF6' },
  },
]

// 이번 달 총 지출 (mock)
export const MOCK_TOTAL_EXPENSE = MOCK_TRANSACTIONS
  .filter(t => t.amount < 0)
  .reduce((sum, t) => sum + Math.abs(t.amount), 0)  // 434,900원
