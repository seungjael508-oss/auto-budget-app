import { CARD_PATTERNS, GENERIC_AMOUNT_REGEX } from './patterns'
import { ParseResult, RawTransaction } from '../types'

function parseAmountStr(val: string): number {
  return parseInt(val.replace(/,/g, ''), 10)
}

// MM/DD HH:mm → 올해 기준 Date
function buildDate(month: string, day: string, hour: string, minute: string): Date {
  const now = new Date()
  return new Date(now.getFullYear(), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10))
}

export function parseText(text: string): ParseResult {
  // 1. 카드사 패턴 우선 매칭 (정확도 높음)
  for (const { fullRegex } of CARD_PATTERNS) {
    const m = text.match(fullRegex)
    if (m) {
      const tx: RawTransaction = {
        merchant: m[5].trim(),
        amount: -parseAmountStr(m[6]),  // 승인 = 지출(음수)
        transaction_at: buildDate(m[1], m[2], m[3], m[4]),
      }
      return { transaction: tx, confidence: 0.90, needsAiAssist: false }
    }
  }

  // 2. 범용 금액 패턴 fallback
  const amountMatch = text.match(GENERIC_AMOUNT_REGEX)
  if (amountMatch) {
    const tx: RawTransaction = {
      merchant: '알 수 없음',
      amount: -parseAmountStr(amountMatch[1]),
      transaction_at: new Date(),
    }
    return { transaction: tx, confidence: 0.40, needsAiAssist: true }
  }

  // 3. 거래 정보 없음
  return { transaction: null, confidence: 0, needsAiAssist: false }
}
