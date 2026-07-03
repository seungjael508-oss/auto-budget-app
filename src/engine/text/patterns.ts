export interface CardPattern {
  provider: string
  regex: RegExp
  merchantIndex: number
  amountIndex: number
  monthIndex?: number
  dayIndex?: number
  hourIndex?: number
  minuteIndex?: number
  confidence: number
}

export const CARD_PATTERNS: CardPattern[] = [
  {
    provider: '국민카드',
    regex: /\[(?:KB)?국민카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '국민카드',
    regex: /\[(?:KB)?국민카드\]\s+(.+?)\s+([\d,]+)원\s*(?:승인|이용|결제).+?(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/,
    merchantIndex: 1, amountIndex: 2, monthIndex: 3, dayIndex: 4, hourIndex: 5, minuteIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '신한카드',
    regex: /\[신한카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '삼성카드',
    regex: /\[삼성카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '현대카드',
    regex: /\[현대카드\]\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+(.+?)\s+([\d,]+)원/,
    monthIndex: 1, dayIndex: 2, hourIndex: 3, minuteIndex: 4, merchantIndex: 5, amountIndex: 6,
    confidence: 0.92,
  },
  {
    provider: '토스',
    regex: /(?:토스|토스페이|Toss)\s+(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '토스',
    regex: /(?:토스|토스페이|Toss).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
  {
    provider: '카카오페이',
    regex: /(?:카카오페이|KakaoPay).+?(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '카카오페이',
    regex: /(?:카카오페이|KakaoPay).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
  {
    provider: '네이버페이',
    regex: /(?:네이버페이|NaverPay).+?(.+?)\s+([\d,]+)원\s*(?:결제|승인|이용)/i,
    merchantIndex: 1, amountIndex: 2,
    confidence: 0.82,
  },
  {
    provider: '네이버페이',
    regex: /(?:네이버페이|NaverPay).+?([\d,]+)원\s*(?:결제|승인|이용)\s+(.+)/i,
    amountIndex: 1, merchantIndex: 2,
    confidence: 0.78,
  },
]

// 카드사 패턴 미매칭 시 사용하는 범용 금액 추출 패턴
export const GENERIC_AMOUNT_REGEX = /([\d,]+)원/

export const NOISE_WORDS_REGEX = /\b(승인|결제|이용|체크카드|신용카드|일시불|누적|잔액|알림)\b/g
