# TASK.md 

## 이번 작업의 목표
Clerk을 활용한 로그인/회원가입의 구현

## 참조 문서
- docs/prd/PRD_clerk_auth.md
- docs/flow/FLOW_clerk_auth.md
- docs/spec/SPEC_clerk_auth.md

작업 범위 (이것만)
    * 로그인/회원가입 기본 화면
    * /sign-in, /sign-up 페이지를 Clerk UI로 구성한다
    * 로그인 수단은 Google + Email/Password만 제공한다
    * 로그인 완료 후 원래 가려던 페이지로 복귀되도록 redirect를 유지한다
    * 보호 페이지 접근 제어
    * 보호 경로: /mypage/*, /payment/*, /subscription/*
    * 비로그인 사용자는 보호 페이지 접근 시 /sign-in으로 이동한다
    * 로그인만으로 끝내지 않고, 보호 페이지 진입 시 서버에서 Supabase users.status를 확인해 active만 통과시킨다
    * Clerk ↔ Supabase 동기화(Webhook)
    * Webhook 엔드포인트(/api/webhooks/clerk)에서 user.created/updated/deleted를 처리해 Supabase users를 동기화한다
    * Webhook은 서명 검증을 통과한 요청만 처리한다
        * Webhook은 중복 수신/순서 뒤바뀜이 있을 수 있으므로,
        * 같은 이벤트가 여러 번 와도 결과가 같게 처리(idempotent)
        * last_clerk_event_at 기준으로 오래된 이벤트는 무시
    * 핵심 정책 적용
        * 이메일 중복 정책:
        * 같은 이메일의 active 또는 blocked가 이미 있으면 새 users row 생성 금지
        * 사용자는 “이미 가입된 계정입니다. 기존 방법으로 로그인해주세요”로 안내하고 서비스 이용을 막는다
        * withdrawn(탈퇴) 재가입:
        * 같은 이메일의 withdrawn이면 재가입 허용
        * 재가입 시 기존 users row를 재사용하고, status를 active로 바꾸며, 필요 시 clerk_user_id를 새 값으로 갱신한다
        * blocked(차단) 정책:
        * Clerk 로그인 성공과 무관하게 우리 서비스 접근은 차단하고 안내 문구를 보여준다
    * 문서에 있는 에러/안내 문구 수준의 UX
    * OAuth 오류, 세션 만료, 동기화 실패, 정책 충돌(중복) 등은 문서의 방향대로 사용자가 다음 행동을 알 수 있게 안내한다

하지 말 것
* 로그인 수단 추가 금지: Kakao/Facebook 추가 구현 금지
* Supabase Auth 도입 금지: 인증은 Clerk만 사용
* 계정 연결 기능 금지: merge/link(계정 합치기) 구현하지 않기
* 관리자 기능 금지: 차단 관리 화면 같은 운영 도구 만들지 않기
* 약관/추가정보 화면 상세 구현 금지: 이번 작업에서는 “흐름 상 존재”까지만, 상세 UI/저장 규칙 확장하지 않기
* 모니터링/알림 도구 추가 금지: Sentry/대시보드/관리자 이메일 발송 등은 이번 범위 제외
* 문서에 없는 정책 임의 추가 금지: 애매하면 먼저 질문하고 결정 후 반영

완료 기준
    * 로그인/회원가입
    * Google 로그인과 Email/Password 로그인·회원가입이 실제로 동작한다
    * Kakao/Facebook이 화면 어디에도 노출되지 않는다
    * redirect(원래 화면 복귀)
    * 로그인 후 사용자가 원래 보려던 페이지(보호 페이지/결제 흐름 포함)로 정상 복귀한다
    * 보호 페이지 동작
    * 비로그인 사용자는 /mypage, /payment, /subscription 접근 시 /sign-in으로 이동한다
        * 로그인 사용자라도 서버에서 Supabase users.status를 확인해:
        * active는 통과
        * withdrawn/blocked는 접근이 차단되고 안내가 나온다
    * Webhook 동기화
    * user.created/updated/deleted 이벤트가 Supabase users에 정책대로 반영된다
    * user.deleted는 row 삭제가 아니라 status='withdrawn'로 변경된다
        * Webhook이 여러 번 오거나 순서가 바뀌어도 데이터가 깨지지 않는다:
        * idempotent 처리
        * last_clerk_event_at 기준으로 오래된 이벤트 무시
    * 정책 검증
    * 같은 이메일의 active 또는 blocked가 존재하면 새 가입은 서비스 이용으로 이어지지 않는다(안내 후 차단)
    * 같은 이메일의 withdrawn는 재가입 후 status가 active로 복구되고, clerk_user_id가 새 값으로 갱신될 수 있다
    * 문서 일치
    * 결과가 docs/prd/PRD_clerk_auth.md, docs/flow/FLOW_clerk_auth.md, docs/spec/SPEC_clerk_auth.md와 모순되지 않는다
