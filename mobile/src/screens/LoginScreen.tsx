import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'

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
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>돈</Text>
        </View>
        <Text style={styles.title}>자동화가계부</Text>
        <Text style={styles.copy}>찍어두면 정리되고, 주말에 확인하면 끝.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>{isSignUp ? '회원가입' : '로그인'}</Text>
        <TextInput
          style={styles.input}
          placeholder="이메일"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? '가입하기' : '로그인'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsSignUp(!isSignUp)} hitSlop={8}>
          <Text style={styles.toggleText}>
            {isSignUp ? '이미 계정이 있어요 -> 로그인' : '계정이 없어요 -> 회원가입'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  logoText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  copy: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  formTitle: {
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
    color: colors.gray900,
    backgroundColor: colors.surface,
  },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  toggleText: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.6,
  },
})
