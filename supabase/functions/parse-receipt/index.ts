import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { resolveRequestUserId } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

interface RequestBody {
  storage_path: string
}

interface OcrFields {
  merchant: string | null
  amount: number | null
  transaction_at: string | null
}

interface OcrResult extends OcrFields {
  confidence: number
  raw_text: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function calcConfidence(result: OcrFields): number {
  const filled = [result.merchant, result.amount, result.transaction_at]
    .filter(value => value !== null && value !== undefined && value !== '').length
  if (filled === 3) return 0.9
  if (filled === 2) return 0.6
  if (filled === 1) return 0.3
  return 0
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(Math.round(value))
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value.replace(/[^\d-]/g, ''), 10)
    return Number.isFinite(parsed) ? Math.abs(parsed) : null
  }
  return null
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function extractJson(text: string): OcrFields | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const parsed = JSON.parse(jsonMatch[0])
  return {
    merchant: typeof parsed.merchant === 'string' && parsed.merchant.trim()
      ? parsed.merchant.trim()
      : null,
    amount: normalizeAmount(parsed.amount),
    transaction_at: normalizeDate(parsed.transaction_at),
  }
}

async function imageToBase64(signedUrl: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(signedUrl)
  if (!response.ok) {
    throw new Error(`이미지 다운로드 실패: ${response.status}`)
  }

  const mediaType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { base64: bytesToBase64(bytes), mediaType }
}

async function parseReceiptWithClaude(signedUrl: string): Promise<OcrResult> {
  const { base64, mediaType } = await imageToBase64(signedUrl)
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64,
          },
        },
        {
          type: 'text',
          text: `한국 영수증 이미지에서 상호명, 총 결제금액, 결제일시만 추출하세요.
반드시 JSON 객체 하나만 반환하세요. 설명 문장, 마크다운, 코드블록은 쓰지 마세요.

규칙:
- merchant: 상호명 문자열, 모르면 null
- amount: 총 결제금액 숫자, 모르면 null
- transaction_at: ISO 8601 문자열, 날짜만 있으면 가능한 시간은 12:00:00으로 보정, 모르면 null

반환 예:
{"merchant":"스타벅스","amount":6300,"transaction_at":"2026-06-02T08:31:00+09:00"}`,
        },
      ],
    }],
  })

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''

  try {
    const fields = extractJson(rawText)
    if (!fields) {
      return { merchant: null, amount: null, transaction_at: null, confidence: 0, raw_text: rawText }
    }
    return { ...fields, confidence: calcConfidence(fields), raw_text: rawText }
  } catch (_error) {
    return { merchant: null, amount: null, transaction_at: null, confidence: 0, raw_text: rawText }
  }
}

serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const auth = await resolveRequestUserId(req, supabase, SUPABASE_SERVICE_ROLE_KEY)
  if (auth.error) return auth.error
  const userId = auth.userId!

  let body: RequestBody
  try {
    body = await req.json()
  } catch (_error) {
    return jsonResponse({ ok: false, error: '잘못된 요청 바디' }, 400)
  }

  const storagePath = body.storage_path
  if (!storagePath) {
    return jsonResponse({ ok: false, error: 'storage_path 필수' }, 400)
  }

  const expectedPrefix = `receipts/${userId}/`
  if (!storagePath.startsWith(expectedPrefix)) {
    return jsonResponse({ ok: false, error: '영수증 이미지 접근 권한 없음' }, 403)
  }

  const objectPath = storagePath.replace(/^receipts\//, '')
  const { data: signedData, error: signedError } = await supabase
    .storage
    .from('receipts')
    .createSignedUrl(objectPath, 300)

  if (signedError || !signedData?.signedUrl) {
    return jsonResponse({ ok: false, error: `이미지 접근 실패: ${signedError?.message ?? 'signed URL 없음'}` }, 400)
  }

  try {
    const result = await parseReceiptWithClaude(signedData.signedUrl)
    return jsonResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR 처리 실패'
    console.error('[parse-receipt] 처리 실패:', error)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
