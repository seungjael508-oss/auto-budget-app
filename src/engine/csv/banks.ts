export interface BankConfig {
  bankCode: string
  bankName: string
  encoding: string
  dateCol: string
  dateFormat: string
  amountCol: string   // 지출(출금) 컬럼명
  incomeCol: string   // 수입(입금) 컬럼명 (카드사는 빈 문자열)
  merchantCol: string
}

// seed.sql의 bank_parsers와 동일한 설정 (클라이언트 사이드 파싱용)
export const BANK_CONFIGS: Record<string, BankConfig> = {
  kb: {
    bankCode: 'kb',
    bankName: '국민은행',
    encoding: 'euc-kr',
    dateCol: '거래일시',
    dateFormat: 'yyyy.MM.dd HH:mm:ss',
    amountCol: '출금액',
    incomeCol: '입금액',
    merchantCol: '적요',
  },
  shinhan: {
    bankCode: 'shinhan',
    bankName: '신한은행',
    encoding: 'euc-kr',
    dateCol: '거래일자',
    dateFormat: 'yyyy/MM/dd',
    amountCol: '출금금액',
    incomeCol: '입금금액',
    merchantCol: '거래내용',
  },
  samsung: {
    bankCode: 'samsung',
    bankName: '삼성카드',
    encoding: 'utf-8',
    dateCol: '이용일',
    dateFormat: 'yyyy.MM.dd',
    amountCol: '이용금액',
    incomeCol: '',
    merchantCol: '가맹점명',
  },
  hyundai: {
    bankCode: 'hyundai',
    bankName: '현대카드',
    encoding: 'utf-8',
    dateCol: '이용일',
    dateFormat: 'yyyy-MM-dd',
    amountCol: '이용금액',
    incomeCol: '',
    merchantCol: '이용가맹점',
  },
}
