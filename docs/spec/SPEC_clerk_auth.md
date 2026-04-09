# SPEC: Clerk 인증 기술 명세

**관련 문서**: [PRD_clerk_auth.md](../prd/PRD_clerk_auth.md) | [FLOW_clerk_auth.md](../flow/FLOW_clerk_auth.md)

## 문서 목적
- Clerk를 로그인 담당으로 사용하고, Supabase는 서비스용 사용자 정보 저장소로 사용하는 구현 기준을 정의한다.
- 구현자가 헷갈리기 쉬운 부분인 "중복 가입 검사 위치", "탈퇴 후 재가입 처리", "차단 계정 차단 위치"를 명확히 고정한다.

## 기술 스택
- 인증 제공자: Clerk
- 로그인 수단: Google OAuth, Email/Password
- 데이터 저장: Supabase
- 프론트엔드: Next.js 14 App Router + TypeScript + Tailwind CSS
- 패키지 매니저: pnpm
- 세션 관리: Clerk Session

## 이번 범위
- `/sign-in`, `/sign-up` 페이지 구성
- 보호 페이지 접근 제어
- Clerk 사용자와 Supabase `users` 테이블 동기화
- 탈퇴 계정 재가입 처리
- 차단 계정 서비스 접근 차단

## 범위 밖
- Kakao, Facebook 로그인
- Supabase Auth 사용
- 관리자용 차단 관리 화면
- 약관/추가 정보 입력 화면의 상세 구현
- Sentry, 모니터링 대시보드

## 프로젝트 구조

```text
saju/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── sign-up/[[...sign-up]]/page.tsx
│   ├── mypage/page.tsx
│   ├── payment/page.tsx
│   ├── subscription/page.tsx
│   └── api/
│       ├── webhooks/
│       │   └── clerk/route.ts
│       └── auth/
│           └── status/route.ts
├── components/
│   └── Navbar.tsx
├── lib/
│   ├── clerk.ts
│   ├── supabase.ts
│   └── auth/
│       ├── sync-clerk-user.ts
│       └── get-user-status.ts
├── middleware.ts
├── supabase/
│   └── migrations/
│       └── 001_create_users.sql
└── .env.local
```

## 큰 구조

### 역할 분리
- Clerk:
  - 로그인 화면 제공
  - 세션 쿠키 관리
  - Google / Email 인증 처리
- Supabase:
  - 우리 서비스에서 쓸 사용자 상태 저장
  - `active`, `withdrawn`, `blocked` 관리
  - 결제, 구독, 프로필 등 서비스 데이터와 연결

쉽게 말하면:
- Clerk는 "출입문 도어락"
- Supabase는 "회원 명단이 들어 있는 노트"

문을 열어주는 일은 Clerk가 하고, 이 사람이 우리 서비스에서 이용 가능한 상태인지 보는 일은 Supabase가 한다.

## 인증 흐름

### 1. 로그인/회원가입
1. 사용자가 로그인 또는 회원가입 버튼 클릭
2. `/sign-in` 또는 `/sign-up`으로 이동
3. Clerk가 Google 또는 Email 로그인 처리
4. 인증 성공 시 Clerk 세션 생성
5. 이후 서버에서 Supabase의 `users` 상태를 확인
6. `active`면 서비스 사용 허용
7. `blocked`면 서비스 접근 차단

### 2. 보호 페이지 접근
1. 사용자가 `/mypage`, `/payment`, `/subscription` 접근
2. `middleware.ts`에서 Clerk 세션 존재 여부 확인
3. 세션이 없으면 로그인 페이지로 이동
4. 세션이 있으면 페이지 접근 허용
5. 페이지 또는 서버 액션에서 Supabase `status`를 추가 확인
6. `blocked`면 접근 차단 화면 또는 안내 메시지 표시

중요:
- 미들웨어는 "로그인했는지"만 빠르게 보는 문지기다.
- `blocked` 여부는 Supabase를 조회하는 서버 코드에서 한 번 더 검사한다.

### 3. Clerk → Supabase 동기화
1. Clerk에서 `user.created`, `user.updated`, `user.deleted` 이벤트 전송
2. `/api/webhooks/clerk`에서 서명 검증
3. 이벤트 데이터를 Supabase `users` 테이블에 반영
4. 같은 이벤트가 여러 번 와도 결과가 꼬이지 않도록 idempotent 하게 처리

## 중요한 정책 결정

### 1. 이메일 중복 가입 정책
- 원칙: 동일 이메일은 하나의 서비스 계정만 허용한다.
- 단, 기존 계정 상태가 `withdrawn`이면 재가입을 허용한다.

### 2. 중복 가입 검사는 Webhook에서 최종 차단하지 않는다
이 부분이 가장 중요하다.

Webhook은 사용자가 이미 Clerk에서 가입을 마친 뒤에 도착한다.  
즉, Webhook에서 `400`을 돌려도 "Clerk 가입 자체"를 막을 수는 없다.

따라서 정책은 아래처럼 나눈다.

#### 실제 차단 위치
- 회원가입 시작 전 사전 검사 화면이 있다면 그 화면에서 먼저 검사
- 사전 검사가 없다면:
  - Clerk 가입은 일단 성공할 수 있다.
  - 하지만 우리 서비스의 첫 진입 시점에 Supabase 상태를 보고 이용을 막는다.

#### Webhook의 역할
- 이미 만들어진 Clerk 사용자를 Supabase와 맞춰 적는 것
- 가입 자체를 판정하는 최종 심판 역할은 하지 않는다

쉽게 말하면:
- Webhook은 "사후 정리 담당"
- 가입 차단은 "사전 안내 담당"

### 3. 탈퇴 계정 재가입 정책
- `withdrawn` 사용자는 동일 이메일로 재가입 가능
- 재가입 시 기존 `users` row를 재사용
- 기존 서비스 데이터 연결을 유지하기 위해 `users.id`는 유지
- 새 Clerk 계정으로 다시 연결하기 위해 `clerk_user_id`는 새 값으로 갱신 가능해야 함

### 4. 차단 계정 정책
- `blocked` 사용자는 로그인 자체는 Clerk에서 성공할 수 있다.
- 하지만 우리 서비스 페이지 접근과 API 사용은 막는다.
- 안내 문구: "이용이 제한된 계정입니다. 고객센터로 문의해주세요"

중요:
- Clerk 계정 삭제만으로 차단을 표현하지 않는다.
- 서비스 차단 기준은 Supabase `users.status = 'blocked'`이다.

## 데이터 모델

### users 테이블

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  name TEXT,
  gender TEXT,
  birth_date DATE,
  agreed_terms_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'blocked')),
  last_clerk_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

### 필드 설명
- `id`: 우리 서비스 내부에서 계속 사용하는 회원 번호
- `clerk_user_id`: 현재 연결된 Clerk 사용자 ID
- `email`: 중복 가입 판정 기준
- `auth_provider`: 마지막 로그인/가입 수단 추적용 값 (`google`, `email`)
- `status`:
  - `active`: 정상 사용 가능
  - `withdrawn`: 탈퇴 상태, 재가입 가능
  - `blocked`: 차단 상태, 재가입 및 서비스 사용 불가
- `last_clerk_event_at`: Clerk 이벤트 순서가 뒤집혀 와도 오래된 이벤트가 최신 값을 덮지 않도록 비교하는 용도

### 설계 이유
- `clerk_user_id`는 재가입 시 바뀔 수 있으므로 `NOT NULL`로 고정하지 않는다.
- 중복 가입 판단 기준은 `email`이다.
- 서비스 데이터 연결 기준은 `users.id`다.

쉽게 말하면:
- `users.id`는 학교 학번
- `clerk_user_id`는 지금 쓰는 출입카드 번호

출입카드는 다시 발급될 수 있지만, 학번은 유지된다.

## 구현 요구사항

### 1. Clerk Provider
`app/layout.tsx`에서 `ClerkProvider`로 앱 전체를 감싼다.

목적:
- 모든 화면에서 로그인 상태 접근 가능
- Clerk UI 컴포넌트 사용 가능
- 세션 자동 관리

### 2. 로그인 화면
- `/sign-in`: `<SignIn />`
- `/sign-up`: `<SignUp />`
- 로그인 완료 후 원래 페이지로 돌아갈 수 있도록 redirect 파라미터 유지

### 3. 미들웨어

#### 보호 대상
- `/mypage/:path*`
- `/payment/:path*`
- `/subscription/:path*`

#### 공개 경로
- `/`
- `/sign-in(.*)`
- `/sign-up(.*)`
- `/api/webhooks/clerk`

#### 핵심 규칙
- Webhook 경로는 반드시 공개 경로로 둔다.
- 미들웨어는 세션만 검사한다.
- `blocked` 판정은 미들웨어에서 하지 않는다.

예시 코드 방향:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/mypage(.*)",
  "/payment(.*)",
  "/subscription(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
```

### 4. Supabase 동기화 Webhook

Webhook 엔드포인트:
- `/api/webhooks/clerk`

처리 이벤트:
- `user.created`
- `user.updated`
- `user.deleted`

#### 공통 처리 순서
1. Svix 서명 검증
2. 이벤트 타입 확인
3. 기본 이메일 추출
4. 이벤트 시각 추출
5. 기존 `users` row 조회
6. 오래된 이벤트면 무시
7. 최신 이벤트만 반영

#### 이메일 추출 규칙
- Clerk의 primary email 기준으로 저장
- primary email이 없으면 첫 번째 verified email 사용
- 둘 다 없으면 에러 로그를 남기고 처리 중단

#### auth_provider 저장 규칙
문서에서 `event.data.oauth_provider` 같은 단일 값에 의존하지 않는다.

저장 규칙:
- 외부 OAuth 계정 중 Google 연결이 있으면 `google`
- 아니면 `email`

즉, 구현 시 Clerk payload 안의 연결 계정 정보를 보고 계산한다.

### 5. 이벤트별 처리 규칙

#### A. `user.created`
- 같은 이메일의 기존 row가 없으면 새 row 생성
- 같은 이메일의 기존 row가 있고 `status='withdrawn'`이면:
  - 기존 row 재사용
  - `clerk_user_id`를 새 Clerk ID로 갱신
  - `status='active'`로 변경
- 같은 이메일의 기존 row가 있고 `status='active'` 또는 `status='blocked'`이면:
  - 새 row를 만들지 않음
  - 에러 로그 남김
  - 필요 시 운영 알림 전송

중요:
- 여기서 `400`으로 가입 자체를 되돌릴 수 있다고 가정하지 않는다.
- 이미 생긴 Clerk 계정과 서비스 정책이 충돌한 상태이므로, 이후 서비스 진입 시 차단/안내가 필요하다.

#### B. `user.updated`
- `clerk_user_id` 또는 `email`로 기존 row 조회
- 없으면:
  - `user.created`가 누락된 경우를 대비해 보수적으로 생성 가능
  - 단, 이메일 기준 중복 정책은 그대로 적용
- 있으면:
  - `email`, `name`, `auth_provider`, `updated_at`, `last_clerk_event_at` 갱신

#### C. `user.deleted`
- row를 삭제하지 않음
- `status='withdrawn'`로 변경
- `updated_at`, `last_clerk_event_at` 갱신
- `clerk_user_id`는 `NULL`로 비우는 것을 권장

이유:
- 같은 이메일이 다시 가입할 때 기존 row를 깨끗하게 재사용하기 쉽다.

## 이벤트 순서 꼬임 방지

Webhook은 순서가 뒤집혀 도착할 수 있다.  
그래서 `updated_at`만 믿으면 안 된다.

반드시 아래 규칙을 둔다.
- Clerk 이벤트 시각을 `last_clerk_event_at`에 저장
- 새 이벤트 시간이 기존 값보다 같거나 최신일 때만 반영
- 더 오래된 이벤트는 로그만 남기고 무시

쉽게 말하면:
- 늦게 도착한 옛날 편지는 읽기만 하고, 공책 내용은 다시 쓰지 않는다.

## 서버에서 계정 상태 확인

### 필요한 이유
Clerk는 로그인 성공 여부를 관리하지만,  
우리 서비스의 `blocked` 상태까지 알지는 못한다.

그래서 보호 페이지나 중요한 API에서는 아래 순서가 필요하다.

1. Clerk 세션 확인
2. 세션의 `userId`로 Supabase `users` 조회
3. `status` 확인
4. `active`만 통과
5. `withdrawn`, `blocked`는 차단

### 권장 구현 위치
- 보호 페이지의 서버 컴포넌트
- 서버 액션
- Route Handler

### 차단 규칙
- `blocked`: 고객센터 안내 후 접근 차단
- `withdrawn`: 재가입 또는 복구 안내 후 접근 차단

## 에러 처리

### 1. Webhook 서명 검증 실패
- 사용자 메시지: 없음
- 서버 처리: `401 Unauthorized`
- 로그: 경고 로그 남김

### 2. Supabase 동기화 실패
- 사용자 메시지: 직접 노출하지 않음
- 서버 처리:
  - 최대 3회 재시도
  - 지수 백오프 적용
  - 실패 시 `500`
  - 에러 로그 기록

### 3. 이메일 정책 충돌
- 상황:
  - 이미 `active` 또는 `blocked` 상태의 같은 이메일이 존재
  - 그런데 Clerk에서 새 사용자가 생성됨
- 서버 처리:
  - Supabase 새 row 생성 금지
  - 운영 로그 남김
  - 사용자 첫 진입 시 "이미 가입된 방식으로 로그인" 또는 "이용이 제한된 계정" 안내

### 4. 세션 만료
- 사용자 메시지: 로그인 페이지로 이동
- 서버 처리: 원래 URL을 유지해 로그인 후 복귀

## 보안
- 프로덕션에서 HTTPS 필수
- `CLERK_WEBHOOK_SECRET` 서버 전용 보관
- `SUPABASE_SERVICE_ROLE_KEY`는 Webhook/서버 코드에서만 사용
- 브라우저에는 service role key를 절대 노출하지 않음
- `.env.local` 커밋 금지
- Webhook 엔드포인트는 서명 검증 실패 시 즉시 종료

## 테스트 전략

### 1. 로그인 수단 검증
- Google 로그인 동작 확인
- Email/Password 로그인 동작 확인
- Facebook/Kakao가 보이지 않는지 확인

### 2. 보호 페이지 검증
- 비로그인 상태에서 `/mypage` 접근 시 로그인으로 이동
- 비로그인 상태에서 `/payment` 접근 시 로그인으로 이동
- 로그인 후 원래 페이지로 돌아오는지 확인

### 3. Webhook 동기화 검증
- `user.created` 후 `users` row 생성 확인
- `user.updated` 후 이름/이메일 변경 반영 확인
- `user.deleted` 후 `status='withdrawn'` 확인
- 같은 이벤트를 여러 번 보내도 row가 하나만 유지되는지 확인

### 4. 정책 검증
- 같은 이메일의 `active` 계정이 있을 때 새 Clerk 가입이 서비스 이용으로 이어지지 않는지 확인
- 같은 이메일의 `withdrawn` 계정은 재가입 후 기존 row가 `active`로 복구되는지 확인
- `blocked` 계정은 로그인 후에도 보호 페이지 접근이 막히는지 확인

### 5. 이벤트 순서 검증
- `user.updated`가 먼저 와도 데이터가 깨지지 않는지 확인
- 더 오래된 이벤트가 나중에 와도 최신 데이터가 유지되는지 확인

## 구현 메모
- PRD의 "신규 가입은 막고"는 UX 목표로 이해한다.
- 실제 기술 구현에서는 Webhook만으로 가입 자체를 되돌릴 수 없으므로, 사전 검사 화면 또는 로그인 후 서비스 차단 로직으로 보완해야 한다.
- FLOW 문서의 "이메일 중복 감지" 단계도 실제 구현에서는 "사전 검사 또는 서비스 진입 시 정책 확인"으로 해석해야 한다.

## 완료 기준
- Clerk 로그인은 정상 동작한다.
- Webhook은 서명 검증 후 Supabase를 안정적으로 동기화한다.
- `withdrawn`은 재가입 가능하다.
- `blocked`는 로그인 후에도 서비스 접근이 차단된다.
- 오래된 Webhook 이벤트가 최신 데이터를 덮어쓰지 않는다.
