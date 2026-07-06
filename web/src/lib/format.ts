export function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export function toMonthParts(date = new Date()) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function transactionSign(kind: 'expense' | 'income', amount: number): number {
  const abs = Math.abs(amount)
  return kind === 'expense' ? -abs : abs
}
