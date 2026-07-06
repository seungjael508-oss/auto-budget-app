import { useCallback, useEffect, useState } from 'react'
import { fetchCurrentWeeklyConnection, markWeeklyConnection, WeeklyConnectionSource } from '../lib/weeklyConnection'
import { WeeklyConnectionStatus } from '../types'

export function useWeeklyConnection() {
  const [connection, setConnection] = useState<WeeklyConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCurrentWeeklyConnection()
      setConnection(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const markConnected = useCallback(async (source: WeeklyConnectionSource) => {
    const data = await markWeeklyConnection(source)
    setConnection(data)
    return data
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    connection,
    loading,
    refresh,
    markConnected,
    isConnectedThisWeek: Boolean(connection?.last_connected_at),
    reportAccuracy: connection?.report_accuracy ?? 0,
    streakCount: connection?.streak_count ?? 0,
  }
}
