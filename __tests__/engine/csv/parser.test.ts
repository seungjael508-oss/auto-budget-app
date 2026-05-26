import { parseCsvRows } from '../../../src/engine/csv/parser'
import { BANK_CONFIGS } from '../../../src/engine/csv/banks'

describe('parseCsvRows', () => {
  const kb = BANK_CONFIGS.kb

  it('지출 행: 출금액 컬럼 → 음수 amount', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액\n2024.03.15 14:30:00,스타벅스,6500,,250000`
    const [tx] = parseCsvRows(csv, kb)
    expect(tx.merchant).toBe('스타벅스')
    expect(tx.amount).toBe(-6500)
    expect(tx.transaction_at).toBeInstanceOf(Date)
  })

  it('수입 행: 입금액 컬럼 → 양수 amount', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액\n2024.03.15 09:00:00,급여이체,,3000000,3250000`
    const [tx] = parseCsvRows(csv, kb)
    expect(tx.amount).toBe(3000000)
  })

  it('금액 0인 행 제외 (잔액 조회 등)', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액\n2024.03.15 10:00:00,잔액조회,,,250000`
    expect(parseCsvRows(csv, kb)).toHaveLength(0)
  })

  it('쉼표 포함 금액: "1,234,567" → -1234567', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액\n2024.03.15 14:30:00,백화점,"1,234,567",,0`
    const [tx] = parseCsvRows(csv, kb)
    expect(tx.amount).toBe(-1234567)
  })

  it('상호명 앞뒤 공백 제거', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액\n2024.03.15 14:30:00,  편의점  ,1000,,0`
    const [tx] = parseCsvRows(csv, kb)
    expect(tx.merchant).toBe('편의점')
  })

  it('여러 행 한 번에 파싱', () => {
    const csv = `거래일시,적요,출금액,입금액,잔액
2024.03.15 14:30:00,스타벅스,6500,,250000
2024.03.15 15:00:00,지하철,1400,,248600
2024.03.15 18:00:00,마트,25000,,223600`
    const result = parseCsvRows(csv, kb)
    expect(result).toHaveLength(3)
    expect(result.map(r => r.merchant)).toEqual(['스타벅스', '지하철', '마트'])
  })
})
