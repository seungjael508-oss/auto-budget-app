import Papa from 'papaparse'
import { parse as parseDateFns } from 'date-fns'
import { BankConfig } from './banks'
import { RawTransaction } from '../types'

// "1,234,567" → 1234567
function parseAmount(value: string | undefined): number {
  if (!value) return 0
  return parseInt(value.replace(/,/g, '').trim(), 10) || 0
}

// 날짜 문자열 → Date (date-fns 포맷 기반)
function parseDateStr(value: string, format: string): Date {
  const parsed = parseDateFns(value.trim(), format, new Date())
  // 파싱 실패 시 현재 시각 fallback (에러 대신 부분 데이터 보존)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

export function parseCsvRows(csvText: string, config: BankConfig): RawTransaction[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return data
    .map((row): RawTransaction | null => {
      const outAmount = parseAmount(row[config.amountCol])
      const inAmount = parseAmount(row[config.incomeCol])

      // 출금이 있으면 지출(음수), 입금이 있으면 수입(양수)
      const amount = outAmount > 0 ? -outAmount : inAmount
      if (amount === 0) return null  // 비거래 행 제외

      return {
        merchant: (row[config.merchantCol] ?? '').trim(),
        amount,
        transaction_at: parseDateStr(row[config.dateCol] ?? '', config.dateFormat),
      }
    })
    .filter((tx): tx is RawTransaction => tx !== null)
}
