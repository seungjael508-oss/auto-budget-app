import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import HomeScreen from '../screens/HomeScreen'
import TransactionListScreen from '../screens/TransactionListScreen'
import ReviewScreen from '../screens/ReviewScreen'
import DashboardScreen from '../screens/DashboardScreen'

// 검수 대기 건수 배지를 위한 전역 상태는 Task 6에서 추가
const Tab = createBottomTabNavigator()

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          const icons: Record<string, string> = {
            홈: '🏠', 거래목록: '📋', 검수: '✅', 대시보드: '📊',
          }
          return <Text style={{ fontSize: 20, color }}>{icons[route.name]}</Text>
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
      })}
    >
      <Tab.Screen name="홈" component={HomeScreen} />
      <Tab.Screen name="거래목록" component={TransactionListScreen} />
      <Tab.Screen name="검수" component={ReviewScreen} />
      <Tab.Screen name="대시보드" component={DashboardScreen} />
    </Tab.Navigator>
  )
}
