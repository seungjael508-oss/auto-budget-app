import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useAuth } from '../hooks/useAuth'

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요')
      return
    }
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
        Alert.alert('회원가입 완료', '이메일 인증 후 로그인하세요')
      } else {
        await signIn(email, password)
        // 로그인 성공 시 RootNavigator가 자동으로 앱 탭으로 전환
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류'
      Alert.alert('오류', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>자동화가계부</Text>
      <Text style={styles.subtitle}>{isSignUp ? '회원가입' : '로그인'}</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{isSignUp ? '가입하기' : '로그인'}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggleText}>
          {isSignUp ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#111' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32, color: '#666' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 12, fontSize: 16,
  },
  button: {
    backgroundColor: '#3B82F6', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleText: { textAlign: 'center', marginTop: 16, color: '#3B82F6' },
})
