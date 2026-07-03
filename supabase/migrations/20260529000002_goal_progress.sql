-- goals.current_amount: 승인/검수 완료 거래 기준 목표 진행액
ALTER TABLE goals
  ADD COLUMN current_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
