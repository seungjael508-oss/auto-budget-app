import React from 'react'
import {
  View, Text, FlatList, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTransactions } from '../hooks/useTransactions'
import TransactionCard from '../components/TransactionCard'

export default function TransactionListScreen() {
  const { transactions, categories, loading, refresh } = useTransactions()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionCard transaction={item} categories={categories} />
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>거래 내역이 없습니다</Text>
            <Text style={styles.emptyHint}>홈에서 CSV를 업로드하세요</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF' },
})
