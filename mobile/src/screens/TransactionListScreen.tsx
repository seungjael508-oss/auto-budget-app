import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function TransactionListScreen() {
  return <View style={s.c}><Text style={s.t}>거래목록</Text></View>
}
const s = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center' }, t: { fontSize: 24 } })
