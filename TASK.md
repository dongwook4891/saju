# TASK.md 

## 이번 작업의 목표
Clerk을 활용한 로그인/회원가입의 구현

## 참조 문서
- docs/prd/PRD_clerk_auth.md
- docs/flow/FLOW_clerk_auth.md
- docs/spec/SPEC_clerk_auth.md

## 작업을 4개로 쪼갠다
- 작업 1~4를 순서대로 진행한다.
- 한 번에 하나만 진행하고, 다음 작업은 별도 승인 후 시작한다.

---

## 작업 1: 로그인/회원가입 화면 연결 + 로그인 후 복귀(redirect)

### 작업 범위 (이것만)
- `/sign-in`, `/sign-up` 페이지를 Clerk UI로 구성한다.
- 로그인 수단은 **Google + Email/Password**만 제공한다.
- 로그인 완료 후 원래 가려던 페이지로 복귀되도록 redirect를 유지한다.

### 하지 말 것
- 보호 페이지 접근 제어(미들웨어)까지 확장하지 않기
- Supabase `users` 동기화(Webhook/서버 저장) 구현하지 않기
- `users.status(active/withdrawn/blocked)` 정책 차단 구현하지 않기
- Kakao/Facebook 로그인 추가 금지

### 완료 기준
- Google 로그인과 Email/Password 로그인·회원가입이 실제로 동작한다.
- Kakao/Facebook이 화면 어디에도 노출되지 않는다.
- 로그인 후 사용자가 원래 보려던 페이지로 정상 복귀한다.

---

## 작업 2: 보호 페이지에서 “로그인 여부”만 차단 (미들웨어)

### 작업 범위 (이것만)
- 보호 경로(`/mypage/*`, `/payment/*`, `/subscription/*`)에 대해
  - 비로그인 사용자는 `/sign-in`으로 이동시킨다.
- redirect를 유지해 로그인 후 원래 페이지로 복귀시킨다.

### 하지 말 것
- Supabase `users.status`를 보고 `blocked/withdrawn` 차단까지 하지 않기 (작업 3에서)
- Webhook 및 Supabase `users` 동기화 구현하지 않기 (작업 4에서)

### 완료 기준
- 비로그인 사용자는 보호 페이지 접근 시 `/sign-in`으로 이동한다.
- 로그인 완료 후 원래 페이지로 정상 복귀한다.

---

## 작업 3: 서버에서 `users.status` 확인해 active만 통과

### 작업 범위 (이것만)
- 로그인된 사용자가 보호 페이지/중요 API를 사용할 때 서버에서 Supabase `users.status`를 확인한다.
- `active`만 통과시키고, `withdrawn`/`blocked`는 접근 차단 + 안내를 보여준다.

### 하지 말 것
- Webhook 기반의 자동 동기화 구현하지 않기 (작업 4에서)
- 계정 연결(merge/link) 기능 구현하지 않기
- 관리자 차단 관리 화면 만들지 않기

### 완료 기준
- 로그인 사용자라도 서버에서 `users.status`를 확인한다.
- `active`는 통과한다.
- `withdrawn`/`blocked`는 접근이 차단되고 안내가 나온다.

---

## 작업 4: Clerk → Supabase 동기화(Webhook) + 중복/재가입/순서 꼬임 처리

### 작업 범위 (이것만)
- Webhook 엔드포인트(`/api/webhooks/clerk`)에서 `user.created/updated/deleted`를 처리해 Supabase `users`를 동기화한다.
- Webhook은 서명 검증을 통과한 요청만 처리한다.
- Webhook은 중복 수신/순서 뒤바뀜이 있을 수 있으므로 아래를 만족한다:
  - 같은 이벤트가 여러 번 와도 결과가 같게 처리(idempotent)
  - `last_clerk_event_at` 기준으로 오래된 이벤트는 무시
- 정책 반영:
  - 같은 이메일의 `active` 또는 `blocked`가 이미 있으면 새 users row 생성 금지 + 운영 로그
  - 같은 이메일의 `withdrawn`이면 재가입 허용(기존 row 재사용, `status=active`, `clerk_user_id` 갱신 가능)
  - `user.deleted`는 row 삭제가 아니라 `status='withdrawn'`로 변경(권장: `clerk_user_id`는 NULL)

### 하지 말 것
- Supabase Auth 도입 금지: 인증은 Clerk만 사용
- 계정 연결(merge/link) 기능 구현 금지
- 관리자 기능(차단 관리 화면 등) 구현 금지
- 약관/추가정보 화면 상세 구현 금지
- 모니터링/알림 도구(Sentry/대시보드/관리자 이메일) 추가 금지
- 문서에 없는 정책 임의 추가 금지

### 완료 기준
- `user.created/updated/deleted` 이벤트가 Supabase `users`에 정책대로 반영된다.
- `user.deleted`는 row 삭제가 아니라 `status='withdrawn'`로 변경된다.
- Webhook이 여러 번 오거나 순서가 바뀌어도 데이터가 깨지지 않는다:
  - idempotent 처리
  - `last_clerk_event_at` 기준으로 오래된 이벤트 무시
- 같은 이메일의 `active` 또는 `blocked`가 존재하면 새 가입은 서비스 이용으로 이어지지 않는다(안내 후 차단).
- 같은 이메일의 `withdrawn`는 재가입 후 `status`가 `active`로 복구되고, `clerk_user_id`가 새 값으로 갱신될 수 있다.
