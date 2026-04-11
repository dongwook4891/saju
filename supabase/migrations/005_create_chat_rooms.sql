-- 채팅방 테이블
CREATE TABLE IF NOT EXISTS chat_rooms (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_date             DATE        NOT NULL,                        -- Asia/Seoul 기준 날짜
  saju_result_id        UUID        NOT NULL REFERENCES saju_results(id) ON DELETE CASCADE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 사용자 + 날짜 기준 유니크 제약 (하루 1개 채팅방만 유지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_user_date ON chat_rooms(user_id, room_date);

-- 조회 성능 향상용 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_rooms_user_id ON chat_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_saju_result_id ON chat_rooms(saju_result_id);

COMMENT ON TABLE chat_rooms IS '사용자별 일일 채팅방 (사주 결과 기반 대화)';
COMMENT ON COLUMN chat_rooms.room_date IS 'Asia/Seoul 기준 채팅방 날짜';
COMMENT ON COLUMN chat_rooms.saju_result_id IS '해당 날짜의 사주 결과 (컨텍스트로 사용)';
