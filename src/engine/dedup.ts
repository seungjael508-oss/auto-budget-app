import { sha256 } from 'js-sha256'

interface DedupParams {
  userId: string
  amount: number
  merchant: string
  transactionAt: Date
}

// ±2분 버킷: CSV와 Notification이 동일 거래를 동시에 가져와도 한 번만 저장
function createTimeBucket(date: Date): number {
  return Math.floor(date.getTime() / (1000 * 120))
}

export function generateDedupKey(params: DedupParams): string {
  const timeBucket = createTimeBucket(params.transactionAt)
  const normalizedMerchant = params.merchant.trim().toLowerCase()
  const raw = `${params.userId}|${params.amount}|${normalizedMerchant}|${timeBucket}`
  return sha256(raw)
}
