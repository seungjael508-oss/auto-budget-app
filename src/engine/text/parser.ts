import { CARD_PATTERNS, GENERIC_AMOUNT_REGEX, NOISE_WORDS_REGEX } from './patterns'
import { ParseResult, RawTransaction } from '../types'

function parseAmountStr(val: string): number {
  return parseInt(val.replace(/,/g, ''), 10)
}

// MM/DD HH:mm → 올해 기준 Date
function buildDate(month: string, day: string, hour: string, minute: string): Date {
  const now = new Date()
  return new Date(now.getFullYear(), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10))
}

function cleanMerchant(value: string): string {
  return value
    .replace(NOISE_WORDS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseText(text: string): ParseResult {
  const normalized = text.replace(/\s+/g, ' ').trim()

  // 1. 카드사 패턴 우선 매칭 (정확도 높음)
  for (const pattern of CARD_PATTERNS) {
    const m = normalized.match(pattern.regex)
    if (m) {
      const hasDate = pattern.monthIndex && pattern.dayIndex && pattern.hourIndex && pattern.minuteIndex
      const tx: RawTransaction = {
        merchant: cleanMerchant(m[pattern.merchantIndex]),
        amount: -parseAmountStr(m[pattern.amountIndex]),  // 승인/결제 = 지출(음수)
        transaction_at: hasDate
          ? buildDate(
            m[pattern.monthIndex!],
            m[pattern.dayIndex!],
            m[pattern.hourIndex!],
            m[pattern.minuteIndex!],
          )
          : new Date(),
      }
      return { transaction: tx, confidence: pattern.confidence, needsAiAssist: pattern.confidence < 0.85 }
    }
  }

  // 2. 범용 금액 패턴 fallback
  const amountMatch = normalized.match(GENERIC_AMOUNT_REGEX)
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
