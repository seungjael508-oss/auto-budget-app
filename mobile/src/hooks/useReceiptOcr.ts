// mobile/src/hooks/useReceiptOcr.ts
import { useState } from 'react'
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker'
import { supabase } from '../lib/supabase'

// parse-receipt Edge Function 응답과 동일
export interface OcrResult {
  merchant: string | null
  amount: number | null
  transaction_at: string | null
  confidence: number
  raw_text: string
}

export function useReceiptOcr() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 이미지를 Storage에 업로드하고 storage_path 반환
  async function uploadImage(uri: string, userId: string): Promise<string> {
    const uniqueSuffix = Math.random().toString(36).slice(2) + Date.now()
    const storagePath = `${userId}/${uniqueSuffix}.jpg`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error: uploadError } = await supabase
      .storage
      .from('receipts')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) throw new Error(`이미지 업로드 실패: ${uploadError.message}`)

    // Edge Function 소유권 검증에서 요구하는 전체 경로
    return `receipts/${storagePath}`
  }

  // parse-receipt Edge Function 호출
  async function callParseReceipt(storagePath: string): Promise<OcrResult> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인 필요')

    const { data, error: fnError } = await supabase.functions.invoke('parse-receipt', {
      body: { storage_path: storagePath },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (fnError) throw new Error(`OCR 처리 실패: ${fnError.message}`)
    return data as OcrResult
  }

  // 카메라 촬영 → 업로드 → OCR
  async function captureAndOcr(): Promise<OcrResult | null> {
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인 필요'); return null }

    return new Promise(resolve => {
      launchCamera(
        { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || !response.assets?.[0]?.uri) {
            resolve(null)
            return
          }
          setLoading(true)
          try {
            const uri = response.assets[0].uri!
            const storagePath = await uploadImage(uri, user.id)
            const result = await callParseReceipt(storagePath)
            resolve(result)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'OCR 실패'
            setError(msg)
            console.error('[useReceiptOcr] 촬영 오류:', err)
            resolve(null)
          } finally {
            setLoading(false)
          }
        }
      )
    })
  }

  // 갤러리 선택 → 업로드 → OCR
  async function pickAndOcr(): Promise<OcrResult | null> {
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인 필요'); return null }

    return new Promise(resolve => {
      launchImageLibrary(
        { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || !response.assets?.[0]?.uri) {
            resolve(null)
            return
          }
          setLoading(true)
          try {
            const uri = response.assets[0].uri!
            const storagePath = await uploadImage(uri, user.id)
            const result = await callParseReceipt(storagePath)
            resolve(result)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'OCR 실패'
            setError(msg)
            console.error('[useReceiptOcr] 갤러리 오류:', err)
            resolve(null)
          } finally {
            setLoading(false)
          }
        }
      )
    })
  }

  return { captureAndOcr, pickAndOcr, loading, error }
}
