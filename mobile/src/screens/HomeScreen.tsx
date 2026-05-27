import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import DocumentPicker from 'react-native-document-picker'
import { supabase } from '../lib/supabase'

// 지원 은행 목록 — bank_parsers 테이블의 bank_code와 일치
const BANKS = [
  { label: '국민은행', code: 'kb' },
  { label: '신한은행', code: 'shinhan' },
  { label: '삼성카드', code: 'samsung' },
  { label: '현대카드', code: 'hyundai' },
]

export default function HomeScreen() {
  const [uploading, setUploading] = useState(false)
  const [selectedBank, setSelectedBank] = useState(BANKS[0].code)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const uploadCsv = async () => {
    let pickerResult
    try {
      // CSV 파일 선택 (allFiles: 일부 Android에서 CSV MIME 인식 안 될 수 있음)
      pickerResult = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] })
    } catch (e) {
      if (DocumentPicker.isCancel(e)) return  // 사용자가 취소
      throw e
    }

    const file = pickerResult[0]
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')

      // 1. 파일 blob 생성 (EUC-KR 인코딩은 Edge Function이 처리)
      const response = await fetch(file.uri)
      const blob = await response.blob()

      // 2. Supabase Storage 업로드
      const storagePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, blob, { contentType: 'text/csv' })

      if (uploadError) throw uploadError

      // 3. raw_data 레코드 생성
      const { data: rawData, error: rawError } = await supabase
        .from('raw_data')
        .insert({
          user_id: user.id,
          source: 'csv',
          file_path: storagePath,
          status: 'pending',
        })
        .select('id')
        .single()

      if (rawError) throw rawError

      // 4. parse-csv Edge Function 호출
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-csv', {
        body: {
          rawDataId: rawData.id,
          bankCode: selectedBank,
          userId: user.id,
        },
      })

      if (parseError) throw parseError

      setLastResult(`완료: ${(parseResult as { inserted?: number }).inserted ?? 0}건 처리됨`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '업로드 실패'
      Alert.alert('오류', message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>CSV 업로드</Text>

      {/* 은행 선택 */}
      <Text style={styles.label}>은행/카드사 선택</Text>
      <View style={styles.bankRow}>
        {BANKS.map(bank => (
          <TouchableOpacity
            key={bank.code}
            style={[styles.bankBtn, selectedBank === bank.code && styles.bankBtnSelected]}
            onPress={() => setSelectedBank(bank.code)}
          >
            <Text style={[styles.bankBtnText, selectedBank === bank.code && styles.bankBtnTextSelected]}>
              {bank.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 업로드 버튼 */}
      <TouchableOpacity style={styles.uploadBtn} onPress={uploadCsv} disabled={uploading}>
        {uploading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.uploadBtnText}>📁 CSV 파일 선택 및 업로드</Text>
        }
      </TouchableOpacity>

      {lastResult && (
        <Text style={styles.result}>✅ {lastResult}</Text>
      )}

      <Text style={styles.hint}>
        업로드 후 AI 분류가 자동으로 진행됩니다.{'\n'}
        confidence {'<'} 0.95인 거래는 "검수" 탭에서 확인하세요.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111' },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  bankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  bankBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 6, borderWidth: 1, borderColor: '#ddd',
  },
  bankBtnSelected: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  bankBtnText: { fontSize: 14, color: '#444' },
  bankBtnTextSelected: { color: '#fff' },
  uploadBtn: {
    backgroundColor: '#3B82F6', borderRadius: 8, padding: 14,
    alignItems: 'center', marginBottom: 16,
  },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { color: '#10B981', fontSize: 14, marginBottom: 12 },
  hint: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
})
