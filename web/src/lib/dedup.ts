export async function generateDedupKey(input: {
  userId: string
  amount: number
  merchant: string
  transactionAt: string
}): Promise<string> {
  const timeBucket = Math.floor(new Date(input.transactionAt).getTime() / 120000)
  const raw = `${input.userId}|${input.amount}|${input.merchant.trim()}|${timeBucket}`
  const bytes = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
