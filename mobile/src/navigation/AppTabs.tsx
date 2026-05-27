import React from 'react'
import { Text, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/HomeScreen'
import TransactionListScreen from '../screens/TransactionListScreen'
import ReviewScreen from '../screens/ReviewScreen'
import DashboardScreen from '../screens/DashboardScreen'
import { useTransactions } from '../hooks/useTransactions'

const Tab = createBottomTabNavigator()

// 검수 탭 배지 컴포넌트
function BadgeIcon({ emoji, count }: { emoji: string; count?: number }) {
  return (
    <View>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      {count != null && count > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -6,
          backgroundColor: '#EF4444', borderRadius: 8,
          minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
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
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
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
    </Tab.Navigator>
  )
}

export default function AppTabs() {
  return <AppTabsInner />
}
