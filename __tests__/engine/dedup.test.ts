import { generateDedupKey } from '../../src/engine/dedup'

describe('generateDedupKey', () => {
  const base = {
    userId: 'user-123',
    amount: -6500,
    merchant: '스타벅스',
    transactionAt: new Date('2024-03-15T14:30:00'),
  }

  it('동일 파라미터는 항상 같은 키를 반환한다', () => {
    expect(generateDedupKey(base)).toBe(generateDedupKey(base))
  })

  it('±2분 이내 동일 거래는 같은 키 (CSV + Notification 중복 방지)', () => {
    // 14:30:00 → bucket 435, 14:31:00 → bucket 435 (같은 120초 구간)
    const key1 = generateDedupKey({ ...base, transactionAt: new Date('2024-03-15T14:30:00') })
    const key2 = generateDedupKey({ ...base, transactionAt: new Date('2024-03-15T14:31:00') })
    expect(key1).toBe(key2)
  })

  it('3분 이상 차이나면 다른 키', () => {
    const key1 = generateDedupKey({ ...base, transactionAt: new Date('2024-03-15T14:30:00') })
    const key2 = generateDedupKey({ ...base, transactionAt: new Date('2024-03-15T14:32:01') })
    expect(key1).not.toBe(key2)
  })

  it('다른 사용자는 같은 거래도 다른 키', () => {
    const key1 = generateDedupKey({ ...base, userId: 'user-1' })
    const key2 = generateDedupKey({ ...base, userId: 'user-2' })
    expect(key1).not.toBe(key2)
  })

  it('상호명 앞뒤 공백 무시', () => {
    const key1 = generateDedupKey({ ...base, merchant: '스타벅스' })
    const key2 = generateDedupKey({ ...base, merchant: '  스타벅스  ' })
    expect(key1).toBe(key2)
  })

  it('64자 소문자 hex 반환', () => {
    const key = generateDedupKey(base)
    expect(key).toHaveLength(64)
    expect(key).toMatch(/^[0-9a-f]+$/)
  })
})
