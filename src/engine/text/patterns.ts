// 카드사별 SMS/알림 정규식 패턴
// 새 카드사 추가 시 이 파일만 수정 (parser.ts 변경 불필요)
export interface CardPattern {
  cardName: string
  // 그룹: (월)(일)(시)(분)(상호명)(금액)
  fullRegex: RegExp
}

export const CARD_PATTERNS: CardPattern[] = [
  {
    cardName: '국민카드',
    fullRegex: /\[국민카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
  },
  {
    cardName: '신한카드',
    fullRegex: /\[신한카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
  },
  {
    cardName: '삼성카드',
    fullRegex: /\[삼성카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
  },
  {
    cardName: '현대카드',
    fullRegex: /\[현대카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
  },
]

// 카드사 패턴 미매칭 시 사용하는 범용 금액 추출 패턴
export const GENERIC_AMOUNT_REGEX = /([\d,]+)원/
