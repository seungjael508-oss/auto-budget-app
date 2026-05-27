export function formatKRW(value: number) {
  return Math.round(value).toLocaleString('ko-KR')
}

export function formatDateLabel(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}`
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
