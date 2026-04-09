# FLOW: Clerk 인증 플로우

**관련 문서**: [PRD_clerk_auth.md](../prd/PRD_clerk_auth.md) | [SPEC_clerk_auth.md](../spec/SPEC_clerk_auth.md)

## 문서 목적
- 사용자가 로그인, 회원가입, 보호 페이지 접근을 할 때 어떤 순서로 움직이는지 정리한다.
- 특히 "중복 가입", "탈퇴 후 재가입", "차단 계정"이 어디에서 처리되는지 흐름으로 명확히 보여준다.

## 큰 흐름 한 줄 요약
```text
사용자 인증은 Clerk가 담당
→ 서비스 이용 가능 여부는 Supabase users.status가 담당
```

쉽게 말하면:
- Clerk는 문을 열어주는 도어락
- Supabase는 들어와도 되는지 확인하는 출입 명단

## 1. 신규 가입 (기본 흐름)

```text
사용자
→ [회원가입 버튼 클릭]
→ /sign-up 이동
→ Clerk 회원가입 화면 표시
→ Google 또는 Email 선택
→ Clerk 가입 완료
→ Clerk 세션 생성
→ 서버가 Supabase users 상태 확인
→ Webhook이 users 테이블 동기화
→ 상태가 active면 서비스 이용 시작
→ 원래 가려던 페이지로 복귀
```

## 2. 기존 사용자 로그인

```text
사용자
→ [로그인 버튼 클릭]
→ /sign-in 이동
→ Clerk 로그인 화면 표시
→ Google 또는 Email 선택
→ Clerk 로그인 완료
→ Clerk 세션 생성
→ 서버가 Supabase users 상태 확인
→ 상태가 active면 로그인 완료
→ 원래 페이지로 복귀
```

## 3. 보호 페이지 접근

```text
비로그인 사용자
→ /mypage 또는 /payment 또는 /subscription 접근
→ middleware.ts에서 Clerk 세션 확인
→ 세션 없음
→ /sign-in 으로 이동
→ 로그인 완료
→ 원래 페이지로 복귀
```

```text
로그인된 사용자
→ 보호 페이지 접근
→ middleware.ts 통과
→ 서버에서 Supabase users.status 확인
→ active: 페이지 표시
→ withdrawn 또는 blocked: 접근 차단 화면 표시
```

중요:
- 미들웨어는 "로그인했는지"만 확인한다.
- `withdrawn`, `blocked` 판정은 서버에서 Supabase를 보고 결정한다.

## 4. 결제 전 인증

```text
비회원
→ [결제하기] 클릭
→ 결제 페이지 또는 로그인 유도 화면
→ /sign-in 이동
→ Clerk 로그인 완료
→ 원래 결제 페이지로 복귀
→ 서버가 users.status 확인
→ active면 결제 진행
→ blocked면 결제 차단
```

## 5. Clerk → Supabase 동기화 흐름

```text
Clerk에서 user.created / user.updated / user.deleted 발생
→ /api/webhooks/clerk 호출
→ Svix 서명 검증
→ 기본 이메일 추출
→ 기존 users row 조회
→ 이벤트 시간이 더 최신인지 확인
→ 최신 이벤트만 Supabase에 반영
```

중요:
- Webhook은 "가입 자체를 막는 곳"이 아니다.
- Webhook은 이미 일어난 Clerk 변경사항을 우리 서비스 데이터에 맞춰 적는 곳이다.

## 예외 흐름

### A. 같은 이메일로 이미 active 계정이 있는 경우

```text
사용자
→ 회원가입 시도
→ Clerk 가입이 먼저 성공할 수 있음
→ Webhook 또는 첫 서비스 진입 시 기존 active 계정 확인
→ 새 users row 생성 금지
→ "이미 가입된 계정입니다. 기존 방법으로 로그인해주세요" 안내
→ 서비스 이용 차단
```

설명:
- 이전 문서처럼 Webhook에서 400을 돌려도 Clerk 가입 자체가 취소되지는 않는다.
- 그래서 실제 서비스 차단은 "첫 진입 시 상태 확인"으로 마무리해야 한다.

### B. 같은 이메일의 withdrawn 계정 재가입

```text
탈퇴한 사용자
→ 같은 이메일로 다시 회원가입
→ Clerk 가입 완료
→ Webhook에서 기존 withdrawn row 확인
→ 기존 users row 재사용
→ clerk_user_id를 새 값으로 갱신
→ status를 active로 변경
→ 서비스 이용 재개
```

설명:
- 회원 번호 `users.id`는 유지된다.
- 출입카드 번호 `clerk_user_id`만 새 것으로 갈아끼운다고 생각하면 된다.

### C. blocked 계정 로그인

```text
차단된 사용자
→ Clerk 로그인 성공
→ 보호 페이지 또는 API 진입
→ 서버가 Supabase users.status 조회
→ status = blocked 확인
→ 서비스 접근 차단
→ "이용이 제한된 계정입니다. 고객센터로 문의해주세요" 안내
```

설명:
- Clerk 로그인 성공과 서비스 이용 가능은 같은 뜻이 아니다.
- 로그인은 되었더라도 우리 서비스는 막을 수 있다.

### D. Clerk 성공, Supabase 동기화 실패

```text
Clerk 인증 완료
→ Webhook 또는 서버 동기화 시도
→ Supabase 저장 실패
→ 자동 재시도 3회
→ 계속 실패
→ 에러 로그 기록
→ 사용자 첫 진입 시 일시적 오류 안내
```

### E. 세션 만료 상태에서 보호 페이지 접근

```text
로그인된 사용자가 시간이 지나 세션 만료
→ 보호 페이지 접근
→ middleware.ts가 세션 없음 감지
→ /sign-in 이동
→ 로그인 완료
→ 원래 URL로 복귀
```

### F. 오래된 Webhook 이벤트가 나중에 도착

```text
새 user.updated 이벤트 먼저 처리
→ 잠시 후 더 오래된 user.created 또는 user.updated 도착
→ last_clerk_event_at 비교
→ 오래된 이벤트는 무시
→ 최신 데이터 유지
```

설명:
- 늦게 도착한 옛날 편지가 공책 내용을 다시 덮어쓰면 안 된다.

## 화면 기준 요약

### 로그인 화면에서 하는 일
```text
Clerk 로그인/회원가입 UI 표시
→ 인증 완료 후 원래 페이지로 보내기
```

### 미들웨어에서 하는 일
```text
로그인했는지 빠르게 확인
→ 비로그인이면 로그인 화면으로 보내기
```

### 서버에서 하는 일
```text
Supabase users.status 확인
→ active만 통과
→ withdrawn / blocked는 차단
```

### Webhook에서 하는 일
```text
Clerk 변경사항을 Supabase users 테이블에 반영
→ 중복 생성 방지
→ 탈퇴 재가입 복구
→ 오래된 이벤트 무시
```

## 완료 기준
- 비로그인 사용자는 보호 페이지에서 로그인 화면으로 이동한다.
- 로그인 후 원래 페이지로 정상 복귀한다.
- active 사용자는 서비스에 정상 진입한다.
- withdrawn 사용자는 재가입 후 다시 active가 된다.
- blocked 사용자는 로그인 후에도 서비스 접근이 차단된다.
- 오래된 Webhook 이벤트가 최신 사용자 정보를 덮어쓰지 않는다.
