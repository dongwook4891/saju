-- 사주 결과 저장 테이블
CREATE TABLE IF NOT EXISTS saju_results (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_date           DATE        NOT NULL,                        -- Asia/Seoul 기준 날짜

  -- 오늘 결과
  today_summary         TEXT        NOT NULL,
  today_caution         TEXT        NOT NULL,
  today_tip             TEXT        NOT NULL,

  -- 내일 결과
  tomorrow_summary      TEXT        NOT NULL,
  tomorrow_caution      TEXT        NOT NULL,
  tomorrow_tip          TEXT        NOT NULL,

  -- 이번 달 결과
  month_summary         TEXT        NOT NULL,
  month_caution         TEXT        NOT NULL,
  month_tip             TEXT        NOT NULL,

  -- 올해 결과
  year_summary          TEXT        NOT NULL,
  year_caution          TEXT        NOT NULL,
  year_tip              TEXT        NOT NULL,

  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- 결과 생성 시간
  regenerate_count      INTEGER     NOT NULL DEFAULT 0,              -- 수동 재생성 횟수
  last_regenerated_at   TIMESTAMPTZ,                                 -- 마지막 수동 재생성 시간

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 사용자 + 날짜 기준 유니크 제약 (하루 1개 결과만 유지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saju_results_user_date ON saju_results(user_id, result_date);

-- 조회 성능 향상용 인덱스
CREATE INDEX IF NOT EXISTS idx_saju_results_user_id ON saju_results(user_id);
CREATE INDEX IF NOT EXISTS idx_saju_results_result_date ON saju_results(result_date);

COMMENT ON TABLE saju_results IS '사용자별 일일 사주 결과';
COMMENT ON COLUMN saju_results.result_date IS 'Asia/Seoul 기준 결과 날짜';
COMMENT ON COLUMN saju_results.regenerate_count IS '사용자가 직접 누른 다시 분석하기 횟수 (하루 1회 제한)';
COMMENT ON COLUMN saju_results.last_regenerated_at IS '마지막 수동 재생성 시간';
