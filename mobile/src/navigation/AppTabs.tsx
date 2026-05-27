import React from 'react'
import { Text, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/HomeScreen'
import TransactionListScreen from '../screens/TransactionListScreen'
import ReviewScreen from '../screens/ReviewScreen'
import DashboardScreen from '../screens/DashboardScreen'
import GoalsScreen from '../screens/GoalsScreen'
import { useTransactions } from '../hooks/useTransactions'
import { colors, fontSize, fontWeight, radius } from '../theme'

const Tab = createBottomTabNavigator()

// 검수 탭 배지 컴포넌트
function BadgeIcon({ emoji, count }: { emoji: string; count?: number }) {
  return (
    <View>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      {count != null && count > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -6,
          backgroundColor: colors.danger, borderRadius: radius.full,
          minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: colors.white, fontSize: 10, fontWeight: '700' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  )
}

function AppTabsInner() {
  const { pendingCount } = useTransactions()

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarStyle: {
          height: 70,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
        },
      }}
    >
      <Tab.Screen name="홈" component={HomeScreen}
        options={{ tabBarIcon: () => <BadgeIcon emoji="🏠" /> }} />
      <Tab.Screen name="거래목록" component={TransactionListScreen}
        options={{ tabBarIcon: () => <BadgeIcon emoji="📋" /> }} />
      <Tab.Screen name="검수" component={ReviewScreen}
        options={{ tabBarIcon: () => <BadgeIcon emoji="✅" count={pendingCount} /> }} />
      <Tab.Screen name="대시보드" component={DashboardScreen}
        options={{ tabBarIcon: () => <BadgeIcon emoji="📊" /> }} />
      <Tab.Screen name="목표" component={GoalsScreen}
        options={{ tabBarIcon: () => <BadgeIcon emoji="🎯" /> }} />
    </Tab.Navigator>
  )
}

export default function AppTabs() {
  return <AppTabsInner />
}
