-- raw_data: 모든 입력 원본 보존 (파싱 실패해도 복구 가능)
CREATE TABLE raw_data (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- manual: 앱에서 직접 입력한 경우도 원본 보존
  source        TEXT NOT NULL CHECK (source IN ('csv','share_intent','paste','notification','ocr','manual')),
  raw_content   TEXT,
  file_path     TEXT,  -- Supabase Storage URL
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parsed','failed')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- categories: 시스템 기본값 + 사용자 커스텀
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = 시스템 기본값
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '💰',
  color      TEXT NOT NULL DEFAULT '#6B7280',
  parent_id  UUID REFERENCES categories(id),
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- bank_parsers: 은행별 CSV 파서 설정
CREATE TABLE bank_parsers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name  TEXT NOT NULL,
  bank_code  TEXT NOT NULL UNIQUE,
  csv_config JSONB NOT NULL
);

-- transactions: 정규화된 거래 내역
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_data_id    UUID REFERENCES raw_data(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  merchant       TEXT NOT NULL,
  category_id    UUID REFERENCES categories(id),
  ai_category    TEXT,
  confidence     NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  transaction_at TIMESTAMPTZ NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('csv','share_intent','notification','ocr','manual')),
  status         TEXT NOT NULL DEFAULT 'pending_review'
                   CHECK (status IN ('auto_approved','pending_review','reviewed')),
  dedup_key      TEXT NOT NULL UNIQUE,
  memo           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_category_hints: 사용자 수정 패턴 학습 (Claude 비용 절감)
CREATE TABLE user_category_hints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant    TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  hit_count   INT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, merchant)
);

-- budgets: 카테고리별 월 예산 (MVP 포함)
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount      NUMERIC(12,2) NOT NULL,
  period      TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly')),
  year        INT NOT NULL,
  month       INT NOT NULL CHECK (month >= 1 AND month <= 12),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id, year, month)
);

-- goals: 절약 목표 최소버전 (MVP 포함)
CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id),  -- NULL = 전체 지출 목표
  title         TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  period        TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly')),
  year          INT NOT NULL,
  month         INT NOT NULL CHECK (month >= 1 AND month <= 12),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id, year, month)
);

-- monthly_summary: 대시보드 전용 읽기 모델
CREATE TABLE monthly_summary (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year         INT NOT NULL,
  month        INT NOT NULL CHECK (month >= 1 AND month <= 12),
  category_id  UUID NOT NULL REFERENCES categories(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tx_count     INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month, category_id)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hints_updated_at
  BEFORE UPDATE ON user_category_hints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER monthly_summary_updated_at
  BEFORE UPDATE ON monthly_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 조회 성능 인덱스
CREATE INDEX idx_transactions_user_status ON transactions(user_id, status);
CREATE INDEX idx_transactions_user_date   ON transactions(user_id, transaction_at DESC);
CREATE INDEX idx_monthly_summary_user     ON monthly_summary(user_id, year, month);
CREATE INDEX idx_budgets_user_period      ON budgets(user_id, year, month);
CREATE INDEX idx_goals_user_active        ON goals(user_id, is_active, year, month);
