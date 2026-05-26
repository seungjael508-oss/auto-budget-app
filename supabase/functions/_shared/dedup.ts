// Edge Function용 dedup_key 생성 (Deno 환경)
// src/engine/dedup.ts와 동일한 로직, Deno import 방식만 다름
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

async function hashSha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ±2분 버킷: CSV + Notification 동일 거래 중복 방지
export async function generateDedupKey(params: {
  userId: string
  amount: number
  merchant: string
  transactionAt: Date
}): Promise<string> {
  const timeBucket = Math.floor(params.transactionAt.getTime() / (1000 * 120))
  const normalizedMerchant = params.merchant.trim().toLowerCase()
  const raw = `${params.userId}|${params.amount}|${normalizedMerchant}|${timeBucket}`
  return hashSha256(raw)
}
