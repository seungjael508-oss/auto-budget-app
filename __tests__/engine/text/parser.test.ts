import { parseText } from '../../../src/engine/text/parser'

describe('parseText', () => {
  it('국민카드 패턴: 금액+상호명+날짜 → confidence 0.90', () => {
    const sms = '[국민카드] 03/15 14:30 스타벅스 6,500원 승인'
    const { transaction, confidence, needsAiAssist } = parseText(sms)
    expect(transaction).not.toBeNull()
    expect(transaction!.merchant).toBe('스타벅스')
    expect(transaction!.amount).toBe(-6500)
    expect(confidence).toBeGreaterThanOrEqual(0.90)
    expect(needsAiAssist).toBe(false)
  })

  it('신한카드 패턴 파싱', () => {
    const sms = '[신한카드] 03/15 15:00 GS25강남점 2,300원 승인'
    const { transaction, confidence } = parseText(sms)
    expect(transaction!.amount).toBe(-2300)
    expect(confidence).toBeGreaterThanOrEqual(0.90)
  })

  it('카드 패턴 미매칭 + 금액만 있으면 confidence 0.40, needsAiAssist true', () => {
    const text = '6,500원이 출금되었습니다'
    const { transaction, confidence, needsAiAssist } = parseText(text)
    expect(transaction!.amount).toBe(-6500)
    expect(confidence).toBe(0.40)
    expect(needsAiAssist).toBe(true)
  })

  it('거래 정보 없는 텍스트 → transaction null', () => {
    const { transaction, confidence } = parseText('안녕하세요 이벤트 안내입니다.')
    expect(transaction).toBeNull()
    expect(confidence).toBe(0)
  })

  it('카드 승인 금액은 항상 음수 (지출)', () => {
    const sms = '[삼성카드] 03/15 16:00 올리브영 15,900원 승인'
    const { transaction } = parseText(sms)
    expect(transaction!.amount).toBeLessThan(0)
  })
})
