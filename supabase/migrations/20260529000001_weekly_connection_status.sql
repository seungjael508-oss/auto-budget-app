-- weekly_connection_status: iPhone 주간 연결 / Android 자동 수집 품질 추적
CREATE TABLE weekly_connection_status (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date   DATE NOT NULL,
  week_end_date     DATE NOT NULL,
  connected_sources TEXT[] NOT NULL DEFAULT '{}',
  connected_count   INT NOT NULL DEFAULT 0,
  report_accuracy   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (report_accuracy >= 0 AND report_accuracy <= 100),
  streak_count      INT NOT NULL DEFAULT 0,
  last_connected_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

ALTER TABLE weekly_connection_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_connection_status_owner" ON weekly_connection_status
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER weekly_connection_status_updated_at
  BEFORE UPDATE ON weekly_connection_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_weekly_connection_user_week
  ON weekly_connection_status(user_id, week_start_date DESC);

-- paste 입력도 정규 거래 source로 허용한다.
ALTER TABLE transactions DROP CONSTRAINT transactions_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('csv','share_intent','paste','notification','ocr','manual'));
