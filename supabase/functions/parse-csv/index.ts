import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5'
import { generateDedupKey } from '../_shared/dedup.ts'

// SERVICE_ROLE_KEY는 Edge Function 내부에서만 사용 (클라이언트 노출 금지)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface BankCsvConfig {
  encoding: string
  date_col: string
  date_format: string
  amount_col: string
  income_col: string | null
  merchant_col: string
}

interface TransactionInsert {
  user_id: string
  raw_data_id: string
  amount: number
  merchant: string
  transaction_at: string
  source: string
  status: string
  dedup_key: string
}

interface RequestBody {
  rawDataId: string
  bankCode: string
  userId: string
}

function parseAmountStr(val: string | undefined): number {
  if (!val) return 0
  return parseInt((val).replace(/,/g, '').trim(), 10) || 0
}

serve(async (req: Request) => {
  const { rawDataId, bankCode, userId }: RequestBody = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. raw_data에서 파일 경로 조회
  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .select('file_path, raw_content')
    .eq('id', rawDataId)
    .single()

  if (rawError) {
    return new Response(JSON.stringify({ ok: false, error: 'raw_data not found' }), { status: 404 })
  }

  // 2. bank_parsers에서 은행별 설정 조회
  const { data: bankParser, error: bankParserError } = await supabase
    .from('bank_parsers')
    .select('csv_config')
    .eq('bank_code', bankCode)
    .single()

  if (bankParserError || !bankParser) {
    const errorMsg = bankParserError
      ? `bank_parsers 조회 실패: ${bankParserError.message}`
      : `지원하지 않는 은행 코드: ${bankCode}`
    await supabase.from('raw_data').update({
      status: 'failed',
      error_message: errorMsg,
    }).eq('id', rawDataId)
    return new Response(JSON.stringify({ ok: false, error: errorMsg }), { status: 400 })
  }

  const config = bankParser.csv_config as BankCsvConfig

  // 3. CSV 텍스트 확보 (Storage 파일 또는 raw_content 직접)
  let csvText: string = rawData.raw_content ?? ''
  if (!csvText && rawData.file_path) {
    const { data: fileData } = await supabase.storage
      .from('uploads')
      .download(rawData.file_path)
    if (fileData) {
      const decoder = new TextDecoder(config.encoding === 'euc-kr' ? 'euc-kr' : 'utf-8')
      csvText = decoder.decode(await fileData.arrayBuffer())
    }
  }

  // CSV 텍스트가 없으면 raw_data 실패 처리 후 종료
  if (!csvText.trim()) {
    await supabase.from('raw_data').update({
      status: 'failed',
      error_message: 'CSV 텍스트를 읽을 수 없습니다 (raw_content와 file_path 모두 없음)',
    }).eq('id', rawDataId)
    return new Response(JSON.stringify({ ok: false, error: 'empty csv' }), { status: 422 })
  }

  // 4. CSV 파싱 → Transaction 객체 목록 생성
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const transactionsToInsert: TransactionInsert[] = []
  for (const row of parsed.data) {
    const outAmt = parseAmountStr(row[config.amount_col])
    // income_col이 null이면 입금 없는 카드사 (삼성/현대)
    const inAmt = config.income_col ? parseAmountStr(row[config.income_col]) : 0
    const amount = outAmt > 0 ? -outAmt : inAmt
    if (amount === 0) continue  // 잔액조회 등 비거래 행 제외

    const merchant = (row[config.merchant_col] ?? '').trim()
    // TODO: date_format 컬럼 기반 파싱 구현 필요 (현재는 runtime 기본 파서 사용)
    // 국민은행 'yyyy.MM.dd HH:mm:ss' 등 비표준 포맷은 Invalid Date 가능성 있음
    const txAt = new Date(row[config.date_col])
    const dedupKey = await generateDedupKey({ userId, amount, merchant, transactionAt: txAt })

    transactionsToInsert.push({
      user_id: userId,
      raw_data_id: rawDataId,
      amount,
      merchant,
      transaction_at: txAt.toISOString(),
      source: 'csv',
      status: 'pending_review',
      dedup_key: dedupKey,
    })
  }

  // 5. upsert: dedup_key 충돌 시 silent skip (중복 거래 방지)
  const { error: upsertError } = await supabase
    .from('transactions')
    .upsert(transactionsToInsert, {
      onConflict: 'dedup_key',
      ignoreDuplicates: true,
    })

  // 6. raw_data 상태 업데이트
  await supabase.from('raw_data').update({
    status: upsertError ? 'failed' : 'parsed',
    error_message: upsertError?.message ?? null,
  }).eq('id', rawDataId)

  if (!upsertError && transactionsToInsert.length > 0) {
    // 7. AI 분류 Edge Function 비동기 호출 (fire-and-forget)
    supabase.functions.invoke('classify-transactions', {
      body: { userId, rawDataId },
    })
  }

  return new Response(
    JSON.stringify({ ok: !upsertError, inserted: transactionsToInsert.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
