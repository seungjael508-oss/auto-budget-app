import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Goal, MonthlySummary } from '../types'

interface GoalRowProps {
  goal: Goal
  summaries: MonthlySummary[]  // 이번 달 전체 집계 (카테고리별 또는 전체)
}

export default function GoalRow({ goal, summaries }: GoalRowProps) {
  // 목표 카테고리가 null이면 전체 지출 합산
  const spent = goal.category_id
    ? summaries.find(s => s.category_id === goal.category_id)
      ? Math.abs(summaries.find(s => s.category_id === goal.category_id)!.total_amount)
      : 0
    : summaries.filter(s => s.total_amount < 0).reduce((acc, s) => acc + Math.abs(s.total_amount), 0)

  const ratio = Math.min(spent / goal.target_amount, 1)
  const pct = Math.round(ratio * 100)
  const achieved = spent <= goal.target_amount
  const cat = goal.categories

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.title}>{goal.title}</Text>
        <Text style={[styles.status, achieved ? styles.ok : styles.over]}>
          {achieved ? '✅ 달성 중' : '⚠️ 초과'}
        </Text>
      </View>
      <Text style={styles.sub}>
        {cat?.icon} {cat?.name ?? '전체'} · 목표 {goal.target_amount.toLocaleString()}원 중 {spent.toLocaleString()}원 사용 ({pct}%)
      </Text>
      <View style={styles.track}>
        <View style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: achieved ? '#10B981' : '#EF4444' },
        ]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '600', color: '#111', flex: 1 },
  status: { fontSize: 12, fontWeight: '600' },
  ok: { color: '#10B981' },
  over: { color: '#EF4444' },
  sub: { fontSize: 12, color: '#666', marginBottom: 6 },
  track: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
})
