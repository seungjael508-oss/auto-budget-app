export const colors = {
  primary: '#1F4B99',
  primaryLight: '#EAF1FF',
  primaryDark: '#183A78',
  accent: '#D44B7A',
  accentLight: '#FFF0F5',
  danger: '#E5484D',
  dangerLight: '#FFF1F1',
  success: '#25966F',
  successLight: '#ECFDF5',
  warning: '#D88914',
  warningLight: '#FFF8E8',
  background: '#F8F6F1',
  surface: '#FFFFFF',
  surfaceStrong: '#F1EEE8',
  border: '#E6E1D8',
  muted: '#7B746B',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  white: '#FFFFFF',
  black: '#000000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}

export const categoryColors: Record<string, string> = {
  식비: '#E5484D',
  카페: '#B76E3D',
  교통: '#1F4B99',
  의료: '#25966F',
  쇼핑: '#8B5CF6',
  구독: '#D88914',
  생활: '#2F7D89',
  문화: '#D44B7A',
  이체: '#6B7280',
  기타: '#9CA3AF',
}
