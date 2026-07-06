// mobile/src/components/ui/AddTransactionModal.tsx
import React from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

interface Props {
  visible: boolean
  onCamera: () => void     // 영수증 촬영 선택
  onGallery: () => void    // 갤러리 선택
  onManual: () => void     // 직접 입력 선택
  onClose: () => void
}

export default function AddTransactionModal({
  visible, onCamera, onGallery, onManual, onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* 배경 탭 → 닫기 */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>지출 추가</Text>

        <Pressable style={styles.option} onPress={onCamera}>
          <Text style={styles.optionIcon}>📷</Text>
          <View>
            <Text style={styles.optionLabel}>영수증 촬영</Text>
            <Text style={styles.optionDesc}>카메라로 찍으면 자동 입력</Text>
          </View>
        </Pressable>

        <Pressable style={styles.option} onPress={onGallery}>
          <Text style={styles.optionIcon}>🖼️</Text>
          <View>
            <Text style={styles.optionLabel}>갤러리에서 선택</Text>
            <Text style={styles.optionDesc}>저장된 영수증 사진 사용</Text>
          </View>
        </Pressable>

        <Pressable style={styles.option} onPress={onManual}>
          <Text style={styles.optionIcon}>✏️</Text>
          <View>
            <Text style={styles.optionLabel}>직접 입력</Text>
            <Text style={styles.optionDesc}>영수증 없는 현금 지출</Text>
          </View>
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // 시니어 UX: 터치 타겟 최소 48px
    minHeight: 56,
  },
  optionIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  optionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray900,
  },
  optionDesc: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.muted,
  },
})
