import { supabase } from './supabase'
import { getPreviousWeekStartDate, getWeekRange } from './week'
import { WeeklyConnectionStatus } from '../types'

export type WeeklyConnectionSource = 'notification' | 'csv' | 'paste' | 'share_intent' | 'ocr'

function calculateReportAccuracy(sourceCount: number, connectedCount: number): number {
  return Math.min(95, 45 + sourceCount * 15 + connectedCount * 5)
}

export async function fetchCurrentWeeklyConnection(): Promise<WeeklyConnectionStatus | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { weekStartDate } = getWeekRange()
  const { data, error } = await supabase
    .from('weekly_connection_status')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function markWeeklyConnection(source: WeeklyConnectionSource): Promise<WeeklyConnectionStatus> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')

  const { start, weekStartDate, weekEndDate } = getWeekRange()
  const previousWeekStartDate = getPreviousWeekStartDate(start)

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from('weekly_connection_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle(),
    supabase
      .from('weekly_connection_status')
      .select('streak_count')
      .eq('user_id', user.id)
      .eq('week_start_date', previousWeekStartDate)
      .maybeSingle(),
  ])

  if (currentRes.error) throw currentRes.error
  if (previousRes.error) throw previousRes.error

  const current = currentRes.data as WeeklyConnectionStatus | null
  const previousStreak = previousRes.data?.streak_count ?? 0
  const connectedSources = Array.from(new Set([...(current?.connected_sources ?? []), source]))
  const connectedCount = (current?.connected_count ?? 0) + 1
  const streakCount = current?.streak_count ?? previousStreak + 1
  const reportAccuracy = calculateReportAccuracy(connectedSources.length, connectedCount)

  const { data, error } = await supabase
    .from('weekly_connection_status')
    .upsert({
      user_id: user.id,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      connected_sources: connectedSources,
      connected_count: connectedCount,
      report_accuracy: reportAccuracy,
      streak_count: streakCount,
      last_connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start_date' })
    .select('*')
    .single()

  if (error) throw error
  return data
}
