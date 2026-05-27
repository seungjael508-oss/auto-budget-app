import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function ReviewScreen() {
  return <View style={s.c}><Text style={s.t}>검수</Text></View>
}
const s = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center' }, t: { fontSize: 24 } })
