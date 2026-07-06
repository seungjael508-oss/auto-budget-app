import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { formatKRW, toMonthParts, transactionSign } from './lib/format'
import { generateDedupKey } from './lib/dedup'
import type { Budget, Category, Goal, MonthlySummary, ReceiptDraft, TabKey, Transaction } from './types'

const BANKS = [
  { label: '국민은행', code: 'kb' },
  { label: '신한은행', code: 'shinhan' },
  { label: '삼성카드', code: 'samsung' },
  { label: '현대카드', code: 'hyundai' },
]

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: '홈', icon: '⌂' },
  { key: 'transactions', label: '거래', icon: '≡' },
  { key: 'review', label: '검수', icon: '✓' },
  { key: 'dashboard', label: '리포트', icon: '◌' },
  { key: 'goals', label: '목표', icon: '☆' },
]

function defaultDateTimeLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function sourceLabel(source: Transaction['source']) {
  const map: Record<Transaction['source'], string> = {
    csv: 'CSV',
    share_intent: '공유',
    paste: '붙여넣기',
    notification: '알림',
    ocr: '영수증',
    manual: '수동',
  }
  return map[source]
}

function Header({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">My Money Coach</p>
        <h1>사진 찍고, 주말에 확인하면 끝</h1>
      </div>
      <button className="icon-button" onClick={onLogout} aria-label="로그아웃">
        {session.user.email?.slice(0, 1).toUpperCase() ?? 'M'}
      </button>
    </header>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [signedUpEmail, setSignedUpEmail] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const action = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { error } = await action
    setLoading(false)
    if (error) {
      const friendlyMessage = error.message === 'Invalid login credentials'
        ? '계정이 없거나 비밀번호가 달라요. 처음이면 가입 탭에서 먼저 가입하세요.'
        : error.message
      setMessage(friendlyMessage)
    }
    else if (mode === 'signup') {
      setSignedUpEmail(email)
      setMessage('가입 완료. 메일함에서 Supabase 확인 메일을 누른 뒤 로그인하세요.')
    }
  }

  async function resendConfirmation() {
    const targetEmail = signedUpEmail || email
    if (!targetEmail) {
      setMessage('확인 메일을 받을 이메일을 입력하세요.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: targetEmail })
    setLoading(false)
    setMessage(error ? error.message : '확인 메일을 다시 보냈어요. 메일함과 스팸함을 확인하세요.')
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">자동 생활 예산 코치</p>
        <h1>무작정 아끼는 게 아니라, 원하는 삶을 위해 정리해요.</h1>
        <p>아이폰에서는 사진, CSV, 붙여넣기로 MVP를 바로 써볼 수 있습니다.</p>
      </section>
      <form className="panel login-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>로그인</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>가입</button>
        </div>
        <label>
          이메일
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            autoComplete="username email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          비밀번호
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />
        </label>
        {message && <p className="notice">{message}</p>}
        <p className="helper-text">한 번 로그인하면 Safari에 세션이 저장되어 다음 접속 때 자동으로 이어집니다.</p>
        <button className="primary" disabled={loading}>{loading ? '처리 중...' : mode === 'signin' ? '로그인' : '가입하기'}</button>
        {(signedUpEmail || message.includes('메일')) && (
          <button className="secondary" type="button" onClick={resendConfirmation} disabled={loading}>
            확인 메일 다시 보내기
          </button>
        )}
      </form>
    </main>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingSession(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loadingSession) return <div className="boot">불러오는 중...</div>
  if (!session) return <LoginScreen />

  return <AuthedApp session={session} />
}

function AuthedApp({ session }: { session: Session }) {
  const now = useMemo(() => toMonthParts(), [])
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summaries, setSummaries] = useState<MonthlySummary[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const refresh = useCallback(async () => {
    const userId = session.user.id
    const [systemCategories, userCategories, txRes, summaryRes, budgetRes, goalRes] = await Promise.all([
      supabase.from('categories').select('*').eq('is_system', true).order('name'),
      supabase.from('categories').select('*').eq('user_id', userId).order('name'),
      supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .order('transaction_at', { ascending: false })
        .limit(80),
      supabase
        .from('monthly_summary')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .eq('year', now.year)
        .eq('month', now.month),
      supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .eq('year', now.year)
        .eq('month', now.month),
      supabase
        .from('goals')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .eq('year', now.year)
        .eq('month', now.month)
        .eq('is_active', true),
    ])

    setCategories([...(systemCategories.data ?? []), ...(userCategories.data ?? [])] as Category[])
    setTransactions((txRes.data ?? []) as Transaction[])
    setSummaries((summaryRes.data ?? []) as MonthlySummary[])
    setBudgets((budgetRes.data ?? []) as Budget[])
    setGoals((goalRes.data ?? []) as Goal[])
  }, [now.month, now.year, session.user.id])

  useEffect(() => { refresh() }, [refresh])

  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const fallbackCategoryId = categories.find(c => c.name === '기타')?.id ?? categories[0]?.id ?? ''
  const pending = transactions.filter(tx => tx.status === 'pending_review')
  const totalExpense = summaries
    .filter(item => Number(item.total_amount) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.total_amount)), 0)
  const totalIncome = summaries
    .filter(item => Number(item.total_amount) > 0)
    .reduce((sum, item) => sum + Number(item.total_amount), 0)
  const budgetTotal = budgets.reduce((sum, budget) => sum + Number(budget.amount), 0)
  const budgetBase = budgetTotal || 1_500_000
  const burnRate = Math.min(100, Math.round((totalExpense / budgetBase) * 100))

  async function requireSessionToken() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('로그인이 필요합니다')
    return data.session.access_token
  }

  async function invokeSummary(transactionIds: string[]) {
    if (!transactionIds.length) return
    const token = await requireSessionToken()
    await supabase.functions.invoke('update-monthly-summary', {
      body: { userId: session.user.id, transactionIds },
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  async function markWeeklyConnection(source: 'csv' | 'paste' | 'ocr') {
    const start = new Date()
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const weekStartDate = start.toISOString().slice(0, 10)
    const weekEndDate = end.toISOString().slice(0, 10)
    const { data: current } = await supabase
      .from('weekly_connection_status')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()
    const connectedSources = Array.from(new Set([...(current?.connected_sources ?? []), source]))
    await supabase.from('weekly_connection_status').upsert({
      user_id: session.user.id,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      connected_sources: connectedSources,
      connected_count: (current?.connected_count ?? 0) + 1,
      report_accuracy: Math.min(95, 45 + connectedSources.length * 15 + ((current?.connected_count ?? 0) + 1) * 5),
      streak_count: current?.streak_count ?? 1,
      last_connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start_date' })
  }

  async function saveManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const merchant = String(form.get('merchant') ?? '').trim()
    const categoryId = String(form.get('category_id') || fallbackCategoryId)
    const amount = transactionSign(String(form.get('kind')) === 'income' ? 'income' : 'expense', Number(form.get('amount') ?? 0))
    const transactionAt = new Date(String(form.get('transaction_at') || defaultDateTimeLocal())).toISOString()
    if (!merchant || !amount || !categoryId) return

    setBusy(true)
    try {
      const dedupKey = await generateDedupKey({ userId: session.user.id, amount, merchant, transactionAt })
      const { data, error } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        merchant,
        category_id: categoryId,
        transaction_at: transactionAt,
        source: 'manual',
        status: 'reviewed',
        confidence: 1,
        dedup_key: dedupKey,
        memo: String(form.get('memo') ?? ''),
      }).select('id').single()
      if (error) throw error
      await invokeSummary([data.id])
      setToast('수동 지출을 저장했어요')
      event.currentTarget.reset()
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleReceipt(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const storagePath = `${session.user.id}/${Date.now()}_${file.name || 'receipt.jpg'}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(storagePath, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
      if (uploadError) throw uploadError
      const token = await requireSessionToken()
      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { storage_path: `receipts/${storagePath}` },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      setReceiptDraft(data as ReceiptDraft)
      await markWeeklyConnection('ocr')
      setToast('영수증을 읽었어요. 아래에서 확인해주세요.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '영수증 처리 실패')
    } finally {
      setBusy(false)
    }
  }

  async function confirmReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!receiptDraft) return
    const form = new FormData(event.currentTarget)
    const merchant = String(form.get('merchant') ?? '').trim()
    const categoryId = String(form.get('category_id') || fallbackCategoryId)
    const amount = -Math.abs(Number(form.get('amount') ?? 0))
    const transactionAt = new Date(String(form.get('transaction_at') || defaultDateTimeLocal())).toISOString()
    setBusy(true)
    try {
      const dedupKey = await generateDedupKey({ userId: session.user.id, amount, merchant, transactionAt })
      const { data, error } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        merchant,
        category_id: categoryId,
        transaction_at: transactionAt,
        source: 'ocr',
        status: 'reviewed',
        confidence: receiptDraft.confidence ?? 0.8,
        dedup_key: dedupKey,
      }).select('id').single()
      if (error) throw error
      await invokeSummary([data.id])
      setReceiptDraft(null)
      setToast('영수증 거래를 저장했어요')
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('csv') as File | null
    const bankCode = String(form.get('bankCode') || 'kb')
    if (!file || file.size === 0) return
    setBusy(true)
    try {
      const storagePath = `${session.user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('uploads').upload(storagePath, file, {
        contentType: 'text/csv',
        upsert: false,
      })
      if (uploadError) throw uploadError
      const { data: rawData, error: rawError } = await supabase.from('raw_data').insert({
        user_id: session.user.id,
        source: 'csv',
        file_path: storagePath,
        status: 'pending',
      }).select('id').single()
      if (rawError) throw rawError
      const token = await requireSessionToken()
      const { data, error } = await supabase.functions.invoke('parse-csv', {
        body: { rawDataId: rawData.id, bankCode, userId: session.user.id },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      await markWeeklyConnection('csv')
      setToast(`CSV 처리 완료: ${(data as { inserted?: number })?.inserted ?? 0}건`)
      event.currentTarget.reset()
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'CSV 업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  async function parsePaste(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = String(form.get('text') ?? '').trim()
    if (!text) return
    setBusy(true)
    try {
      const token = await requireSessionToken()
      const { error } = await supabase.functions.invoke('parse-text', {
        body: { text, source: 'paste', userId: session.user.id },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) throw error
      await markWeeklyConnection('paste')
      setToast('붙여넣기 거래를 저장했어요. 검수에서 확인해주세요.')
      event.currentTarget.reset()
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '붙여넣기 처리 실패')
    } finally {
      setBusy(false)
    }
  }

  async function reviewTransaction(tx: Transaction, categoryId: string) {
    setBusy(true)
    try {
      const { error } = await supabase.from('transactions').update({
        category_id: categoryId,
        status: 'reviewed',
        confidence: tx.confidence ?? 0.9,
      }).eq('id', tx.id).eq('user_id', session.user.id)
      if (error) throw error
      await invokeSummary([tx.id])
      setToast('검수 완료')
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '검수 실패')
    } finally {
      setBusy(false)
    }
  }

  async function approveAllHighConfidence() {
    const targets = pending.filter(tx => (tx.confidence ?? 0) >= 0.8 && (tx.category_id || categoryById.size))
    for (const tx of targets) {
      await reviewTransaction(tx, tx.category_id ?? fallbackCategoryId)
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const categoryId = String(form.get('category_id') || fallbackCategoryId)
    const amount = Number(form.get('amount') ?? 0)
    if (!categoryId || !amount) return
    setBusy(true)
    try {
      const { error } = await supabase.from('budgets').upsert({
        user_id: session.user.id,
        category_id: categoryId,
        amount,
        period: 'monthly',
        year: now.year,
        month: now.month,
      }, { onConflict: 'user_id,category_id,year,month' })
      if (error) throw error
      setToast('예산을 저장했어요')
      event.currentTarget.reset()
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '예산 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const targetAmount = Number(form.get('target_amount') ?? 0)
    const categoryId = String(form.get('category_id') || '')
    if (!title || !targetAmount) return
    setBusy(true)
    try {
      const { error } = await supabase.from('goals').upsert({
        user_id: session.user.id,
        category_id: categoryId || null,
        title,
        target_amount: targetAmount,
        period: 'monthly',
        year: now.year,
        month: now.month,
        is_active: true,
      }, { onConflict: 'user_id,category_id,year,month' })
      if (error) throw error
      setToast('목표를 저장했어요')
      event.currentTarget.reset()
      await refresh()
    } catch (error) {
      setToast(error instanceof Error ? error.message : '목표 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <Header session={session} onLogout={() => supabase.auth.signOut()} />
      {toast && <button className="toast" onClick={() => setToast('')}>{toast}</button>}
      {busy && <div className="busy">처리 중...</div>}

      <main className="content">
        {activeTab === 'home' && (
          <section className="stack">
            <div className="hero-panel">
              <p className="eyebrow">{now.month}월 소비 흐름</p>
              <div className="hero-row">
                <div>
                  <h2>{formatKRW(totalExpense)}원</h2>
                  <p>예산 {formatKRW(budgetBase)}원 중 {burnRate}% 사용</p>
                </div>
                <strong>{pending.length}건 검수</strong>
              </div>
              <div className="progress"><span style={{ width: `${burnRate}%` }} /></div>
            </div>

            <div className="panel">
              <h3>아이폰 연결 방식</h3>
              <p className="muted">iOS는 카드 알림 자동 읽기가 막혀 있어요. 대신 사진, CSV, 붙여넣기를 주 1회 연결하면 리포트 정확도가 올라갑니다.</p>
              <div className="quick-grid">
                <label className="quick-action">
                  <span>영수증 사진</span>
                  <input type="file" accept="image/*" capture="environment" onChange={e => handleReceipt(e.currentTarget.files?.[0] ?? null)} />
                </label>
                <button className="quick-action" onClick={() => setActiveTab('review')}>주간 검수</button>
              </div>
            </div>

            {receiptDraft && (
              <form className="panel form-grid" onSubmit={confirmReceipt}>
                <h3>영수증 확인</h3>
                <label>상호명<input name="merchant" defaultValue={receiptDraft.merchant ?? ''} required /></label>
                <label>금액<input name="amount" type="number" defaultValue={Math.abs(Number(receiptDraft.amount ?? 0))} required /></label>
                <label>날짜<input name="transaction_at" type="datetime-local" defaultValue={receiptDraft.transaction_at ? receiptDraft.transaction_at.slice(0, 16) : defaultDateTimeLocal()} required /></label>
                <CategorySelect categories={categories} fallbackCategoryId={fallbackCategoryId} />
                <button className="primary">저장</button>
              </form>
            )}

            <form className="panel form-grid" onSubmit={saveManual}>
              <h3>수동 입력</h3>
              <div className="segmented compact">
                <label><input type="radio" name="kind" value="expense" defaultChecked /> 지출</label>
                <label><input type="radio" name="kind" value="income" /> 수입</label>
              </div>
              <label>상호명<input name="merchant" placeholder="예: 올리브영" required /></label>
              <label>금액<input name="amount" type="number" inputMode="numeric" placeholder="10000" required /></label>
              <label>날짜<input name="transaction_at" type="datetime-local" defaultValue={defaultDateTimeLocal()} required /></label>
              <CategorySelect categories={categories} fallbackCategoryId={fallbackCategoryId} />
              <label>메모<input name="memo" placeholder="선택" /></label>
              <button className="primary">저장</button>
            </form>

            <form className="panel form-grid" onSubmit={uploadCsv}>
              <h3>CSV 업로드</h3>
              <label>은행/카드사
                <select name="bankCode">{BANKS.map(bank => <option key={bank.code} value={bank.code}>{bank.label}</option>)}</select>
              </label>
              <label>CSV 파일<input name="csv" type="file" accept=".csv,text/csv" required /></label>
              <button className="secondary">CSV 처리</button>
            </form>

            <form className="panel form-grid" onSubmit={parsePaste}>
              <h3>카드 알림 붙여넣기</h3>
              <label>알림 내용<textarea name="text" rows={4} placeholder="[KB국민카드] 스타벅스 6,300원 승인" required /></label>
              <button className="secondary">붙여넣기 처리</button>
            </form>
          </section>
        )}

        {activeTab === 'transactions' && <TransactionList transactions={transactions} />}
        {activeTab === 'review' && (
          <ReviewList
            pending={pending}
            categories={categories}
            fallbackCategoryId={fallbackCategoryId}
            onReview={reviewTransaction}
            onApproveAll={approveAllHighConfidence}
          />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard
            summaries={summaries}
            budgets={budgets}
            goals={goals}
            totalExpense={totalExpense}
            totalIncome={totalIncome}
            budgetBase={budgetBase}
            burnRate={burnRate}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsPanel
            categories={categories}
            fallbackCategoryId={fallbackCategoryId}
            budgets={budgets}
            goals={goals}
            onSaveBudget={saveBudget}
            onSaveGoal={saveGoal}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function CategorySelect({ categories, fallbackCategoryId }: { categories: Category[]; fallbackCategoryId: string }) {
  return (
    <label>카테고리
      <select name="category_id" defaultValue={fallbackCategoryId} required>
        {categories.map(category => (
          <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
        ))}
      </select>
    </label>
  )
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="stack">
      <div className="section-title"><h2>거래 목록</h2><p>최근 80건</p></div>
      {transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
      {!transactions.length && <div className="empty">아직 거래가 없습니다.</div>}
    </section>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isExpense = Number(tx.amount) < 0
  return (
    <article className="tx-row">
      <div className="tx-icon">{tx.categories?.icon ?? '·'}</div>
      <div className="tx-main">
        <strong>{tx.merchant}</strong>
        <span>{sourceLabel(tx.source)} · {new Date(tx.transaction_at).toLocaleDateString('ko-KR')} · {tx.status === 'pending_review' ? '검수 대기' : '완료'}</span>
      </div>
      <b className={isExpense ? 'expense' : 'income'}>{isExpense ? '-' : '+'}{formatKRW(Math.abs(Number(tx.amount)))}</b>
    </article>
  )
}

function ReviewList({
  pending,
  categories,
  fallbackCategoryId,
  onReview,
  onApproveAll,
}: {
  pending: Transaction[]
  categories: Category[]
  fallbackCategoryId: string
  onReview: (tx: Transaction, categoryId: string) => void
  onApproveAll: () => void
}) {
  return (
    <section className="stack">
      <div className="section-title">
        <h2>주간 검수</h2>
        <button className="secondary small" onClick={onApproveAll}>고신뢰 일괄 승인</button>
      </div>
      {pending.map(tx => (
        <article className="panel review-card" key={tx.id}>
          <div className="review-head">
            <div>
              <strong>{tx.merchant}</strong>
              <p>{formatKRW(Math.abs(Number(tx.amount)))}원 · 신뢰도 {Math.round((tx.confidence ?? 0) * 100)}%</p>
            </div>
            <span>{sourceLabel(tx.source)}</span>
          </div>
          <select defaultValue={tx.category_id ?? fallbackCategoryId} onChange={e => onReview(tx, e.currentTarget.value)}>
            {categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}
          </select>
          <button className="primary" onClick={() => onReview(tx, tx.category_id ?? fallbackCategoryId)}>승인</button>
        </article>
      ))}
      {!pending.length && <div className="empty">검수할 거래가 없습니다. 주말이 편해졌네요.</div>}
    </section>
  )
}

function Dashboard({
  summaries,
  budgets,
  goals,
  totalExpense,
  totalIncome,
  budgetBase,
  burnRate,
}: {
  summaries: MonthlySummary[]
  budgets: Budget[]
  goals: Goal[]
  totalExpense: number
  totalIncome: number
  budgetBase: number
  burnRate: number
}) {
  return (
    <section className="stack">
      <div className="hero-panel">
        <p className="eyebrow">월간 리포트</p>
        <h2>{formatKRW(totalExpense)}원 지출</h2>
        <p>수입 {formatKRW(totalIncome)}원 · 예산 {formatKRW(budgetBase)}원</p>
        <div className="progress"><span style={{ width: `${burnRate}%` }} /></div>
      </div>
      <div className="panel">
        <h3>카테고리별 지출</h3>
        {summaries.map(item => (
          <div className="metric-row" key={item.id}>
            <span>{item.categories?.icon ?? '·'} {item.categories?.name ?? '기타'}</span>
            <strong>{formatKRW(Math.abs(Number(item.total_amount)))}원</strong>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>예산 소진율</h3>
        {budgets.map(budget => {
          const used = summaries.find(s => s.category_id === budget.category_id)
          const rate = Math.min(100, Math.round((Math.abs(Number(used?.total_amount ?? 0)) / Number(budget.amount)) * 100))
          return (
            <div className="budget-row" key={budget.id}>
              <div><span>{budget.categories?.icon}</span> {budget.categories?.name}</div>
              <div className="progress"><span style={{ width: `${rate}%` }} /></div>
              <strong>{rate}%</strong>
            </div>
          )
        })}
      </div>
      <div className="panel">
        <h3>목표 진행</h3>
        {goals.map(goal => {
          const rate = Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100))
          return (
            <div className="goal-row" key={goal.id}>
              <div><strong>{goal.title}</strong><span>{formatKRW(Number(goal.current_amount))} / {formatKRW(Number(goal.target_amount))}원</span></div>
              <b>{rate}%</b>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function GoalsPanel({
  categories,
  fallbackCategoryId,
  budgets,
  goals,
  onSaveBudget,
  onSaveGoal,
}: {
  categories: Category[]
  fallbackCategoryId: string
  budgets: Budget[]
  goals: Goal[]
  onSaveBudget: (event: FormEvent<HTMLFormElement>) => void
  onSaveGoal: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="stack">
      <form className="panel form-grid" onSubmit={onSaveBudget}>
        <h3>월 예산 설정</h3>
        <CategorySelect categories={categories} fallbackCategoryId={fallbackCategoryId} />
        <label>예산 금액<input name="amount" type="number" inputMode="numeric" placeholder="300000" required /></label>
        <button className="primary">예산 저장</button>
      </form>
      <form className="panel form-grid" onSubmit={onSaveGoal}>
        <h3>이번 달 목표</h3>
        <label>목표 이름<input name="title" placeholder="올리브영 화장품 세트" required /></label>
        <label>목표 금액<input name="target_amount" type="number" inputMode="numeric" placeholder="100000" required /></label>
        <label>연결 카테고리
          <select name="category_id" defaultValue="">
            <option value="">전체 지출</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}
          </select>
        </label>
        <button className="primary">목표 저장</button>
      </form>
      <div className="panel">
        <h3>현재 설정</h3>
        {budgets.map(budget => <div className="metric-row" key={budget.id}><span>{budget.categories?.name}</span><strong>{formatKRW(Number(budget.amount))}원</strong></div>)}
        {goals.map(goal => <div className="metric-row" key={goal.id}><span>{goal.title}</span><strong>{formatKRW(Number(goal.target_amount))}원</strong></div>)}
      </div>
    </section>
  )
}

export default App
