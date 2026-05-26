-- 전체 테이블 RLS 활성화
ALTER TABLE raw_data             ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_hints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;

-- raw_data, transactions, hints, budgets, goals, summary: 본인만
CREATE POLICY "raw_data_owner"    ON raw_data FOR ALL USING (user_id = auth.uid());
CREATE POLICY "transactions_owner" ON transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "hints_owner"       ON user_category_hints FOR ALL USING (user_id = auth.uid());
CREATE POLICY "budgets_owner"     ON budgets FOR ALL USING (user_id = auth.uid());
CREATE POLICY "goals_owner"       ON goals FOR ALL USING (user_id = auth.uid());
CREATE POLICY "summary_owner"     ON monthly_summary FOR ALL USING (user_id = auth.uid());

-- categories: 시스템 카테고리는 전체 읽기, 사용자 커스텀은 본인만
CREATE POLICY "categories_system_read" ON categories FOR SELECT
  USING (is_system = TRUE OR user_id = auth.uid());

CREATE POLICY "categories_user_insert" ON categories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "categories_user_update" ON categories FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "categories_user_delete" ON categories FOR DELETE
  USING (user_id = auth.uid());
