-- users 테이블 생성
-- Clerk는 로그인 담당, Supabase users는 서비스 상태 저장 담당

CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id        TEXT        UNIQUE,                          -- 현재 연결된 Clerk ID (재가입 시 바뀔 수 있음)
  email                TEXT        UNIQUE NOT NULL,                 -- 중복 가입 판정 기준
  auth_provider        TEXT        NOT NULL DEFAULT 'email',        -- 'google' | 'email'
  name                 TEXT,
  gender               TEXT,
  birth_date           DATE,
  agreed_terms_at      TIMESTAMPTZ,
  status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'withdrawn', 'blocked')),
  last_clerk_event_at  TIMESTAMPTZ,                                 -- 이벤트 순서 꼬임 방지용
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users(status);
