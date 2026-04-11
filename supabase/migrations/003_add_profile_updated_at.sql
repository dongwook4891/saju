-- 사주정보 수정 시간 추적용 컬럼 추가
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- 기존 레코드에 대해 updated_at 값으로 초기화
UPDATE users
SET profile_updated_at = updated_at
WHERE profile_updated_at IS NULL;

-- 사주정보 수정 시 자동으로 profile_updated_at 갱신하는 트리거 함수
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- birth_date, birth_hour, birth_minute 중 하나라도 변경되면 profile_updated_at 갱신
  IF (NEW.birth_date IS DISTINCT FROM OLD.birth_date) OR
     (NEW.birth_hour IS DISTINCT FROM OLD.birth_hour) OR
     (NEW.birth_minute IS DISTINCT FROM OLD.birth_minute) THEN
    NEW.profile_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_profile_updated_at ON users;
CREATE TRIGGER trigger_update_profile_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

COMMENT ON COLUMN users.profile_updated_at IS '사주정보(birth_date, birth_hour, birth_minute) 마지막 수정 시간';
