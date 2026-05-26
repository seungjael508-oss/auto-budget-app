import { parseCsvRows } from '../../src/engine/csv/parser'
import { BANK_CONFIGS } from '../../src/engine/csv/banks'
import { parseText } from '../../src/engine/text/parser'
import { generateDedupKey } from '../../src/engine/dedup'
import * as fs from 'fs'
import * as path from 'path'

describe('전체 파이프라인 통합 검증', () => {
  it('CSV fixture → 파싱 → dedup_key 생성 일관성', () => {
    const csvPath = path.join(__dirname, '../fixtures/sample-kb.csv')
    const csv = fs.readFileSync(csvPath, 'utf-8')
    const transactions = parseCsvRows(csv, BANK_CONFIGS.kb)

    expect(transactions).toHaveLength(6)

    // dedup_key: 동일 tx를 두 번 처리해도 같은 키
    const userId = 'test-user'
    const key1 = generateDedupKey({
      userId,
      amount: transactions[0].amount,
      merchant: transactions[0].merchant,
      transactionAt: transactions[0].transaction_at,
    })
    const key2 = generateDedupKey({
      userId,
      amount: transactions[0].amount,
      merchant: transactions[0].merchant,
      transactionAt: transactions[0].transaction_at,
    })
    expect(key1).toBe(key2)

    // 서로 다른 거래는 다른 키
    const key3 = generateDedupKey({
      userId,
      amount: transactions[1].amount,
      merchant: transactions[1].merchant,
      transactionAt: transactions[1].transaction_at,
    })
    expect(key1).not.toBe(key3)
  })

  it('SMS fixture → 파싱 → 각 거래 confidence >= 0.90', () => {
    const smsPath = path.join(__dirname, '../fixtures/sample-sms.txt')
    const lines = fs.readFileSync(smsPath, 'utf-8').split('\n').filter(l => l.trim())

    for (const line of lines) {
      const { transaction, confidence } = parseText(line)
      expect(transaction).not.toBeNull()
      expect(confidence).toBeGreaterThanOrEqual(0.90)
    }
  })
})
