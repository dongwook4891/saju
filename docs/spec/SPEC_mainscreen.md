# docs/spec/SPEC_mainscreen.md

# SPEC_mainscreen

## 데이터
- user_profile.birth_date
- user_profile.birth_hour
- user_profile.birth_minute

각 값은 현재 로그인 계정의 고유 프로필에 저장한다.

## 임시 저장
- 로그인 전 입력값은 sessionStorage에 저장한다.
- 저장 키는 메인화면 입력값 전용으로 분리한다.
- 인증 성공 후 저장 완료 시 임시값을 제거한다.

## 저장 시점
- 로그인 성공 직후
- 회원가입 성공 직후
- 조건: birth_date, birth_hour, birth_minute가 모두 존재할 때만 저장 시도

## 조회 시점
- 로그인 상태의 메인화면 진입 시
- 필요 시 로그인 상태 전환 직후 1회 추가 조회

## UI 규칙
- 저장값 있음: placeholder가 아니라 input의 실제 값(value)으로 표시
- 저장값 없음: 디폴트 플레이스홀더 표시
- 비로그인 상태: 디폴트 플레이스홀더 표시

## 검증/예외
- 잘못된 계정에 저장 금지
- null/empty/부분 입력값은 저장 금지
- 저장 실패 시 인증 세션 롤백 금지
- 저장 실패 시 사용자 노출 에러 UI 없음, 내부 로그만 기록
- 조회 실패 시 기본 플레이스홀더 fallback

## 비범위
- 사주 결과 계산 로직
- 사용자 수정 화면 상세 설계
- 관리자 기능
- 알림/토스트/배너 UI 추가

## 참조
- prd: ../prd/PRD_mainscreen.md
- flow: ../flow/FLOW_mainscreen.md
- task: ../../TASK.md