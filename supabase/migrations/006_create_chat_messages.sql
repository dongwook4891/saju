-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id          UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  role                  TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content               TEXT        NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 조회 성능 향상용 인덱스 (채팅방별 시간순 정렬)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(chat_room_id, created_at);

COMMENT ON TABLE chat_messages IS '채팅 메시지 저장';
COMMENT ON COLUMN chat_messages.role IS 'user: 사용자 메시지, assistant: AI 답변';
