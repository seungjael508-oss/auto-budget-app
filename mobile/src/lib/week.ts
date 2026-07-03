const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekRange(base = new Date()) {
  const current = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const day = current.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(current.getTime() + mondayOffset * DAY_MS)
  const end = new Date(start.getTime() + 6 * DAY_MS)

  return {
    start,
    end,
    weekStartDate: formatDate(start),
    weekEndDate: formatDate(end),
  }
}

export function getPreviousWeekStartDate(weekStart: Date): string {
  return formatDate(new Date(weekStart.getTime() - 7 * DAY_MS))
}
