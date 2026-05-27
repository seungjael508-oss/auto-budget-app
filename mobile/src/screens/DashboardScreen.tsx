import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function DashboardScreen() {
  return <View style={s.c}><Text style={s.t}>대시보드</Text></View>
}
const s = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center' }, t: { fontSize: 24 } })
