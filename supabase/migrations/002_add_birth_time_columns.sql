-- 출생 시간, 분 컬럼 추가
-- birth_date는 이미 존재하므로 birth_hour, birth_minute만 추가

ALTER TABLE users
ADD COLUMN IF NOT EXISTS birth_hour INTEGER CHECK (birth_hour >= 0 AND birth_hour <= 23),
ADD COLUMN IF NOT EXISTS birth_minute INTEGER CHECK (birth_minute >= 0 AND birth_minute <= 59);

COMMENT ON COLUMN users.birth_hour IS '출생 시간 (0-23)';
COMMENT ON COLUMN users.birth_minute IS '출생 분 (0-59)';
