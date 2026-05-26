-- 시스템 기본 카테고리: 동일 이름 존재 시 skip (멱등성 보장)
INSERT INTO categories (name, icon, color, is_system)
SELECT * FROM (VALUES
  ('식비',   '🍽️', '#EF4444', TRUE),
  ('교통',   '🚌', '#3B82F6', TRUE),
  ('의료',   '🏥', '#10B981', TRUE),
  ('쇼핑',   '🛍️', '#8B5CF6', TRUE),
  ('구독',   '📱', '#F59E0B', TRUE),
  ('이체',   '💸', '#6B7280', TRUE),
  ('기타',   '📌', '#9CA3AF', TRUE)
) AS v(name, icon, color, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.name = v.name AND categories.is_system = TRUE
);

-- 은행별 CSV 파서 설정
-- csv_config 필드 설명:
-- encoding: CSV 파일 인코딩 (euc-kr | utf-8)
-- date_col: 날짜 컬럼명, date_format: date-fns 파싱 포맷
-- amount_col: 출금/이용 컬럼명, income_col: 입금 컬럼명 (카드사는 null)
-- merchant_col: 가맹점/적요 컬럼명
INSERT INTO bank_parsers (bank_name, bank_code, csv_config) VALUES
(
  '국민은행', 'kb',
  '{"encoding":"euc-kr","date_col":"거래일시","date_format":"yyyy.MM.dd HH:mm:ss","amount_col":"출금액","income_col":"입금액","merchant_col":"적요"}'
),
(
  '신한은행', 'shinhan',
  '{"encoding":"euc-kr","date_col":"거래일자","date_format":"yyyy/MM/dd","amount_col":"출금금액","income_col":"입금금액","merchant_col":"거래내용"}'
),
(
  '삼성카드', 'samsung',
  '{"encoding":"utf-8","date_col":"이용일","date_format":"yyyy.MM.dd","amount_col":"이용금액","income_col":null,"merchant_col":"가맹점명"}'
),
(
  '현대카드', 'hyundai',
  '{"encoding":"utf-8","date_col":"이용일","date_format":"yyyy-MM-dd","amount_col":"이용금액","income_col":null,"merchant_col":"이용가맹점"}'
)
ON CONFLICT (bank_code) DO NOTHING;
