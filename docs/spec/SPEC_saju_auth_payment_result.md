# SPEC_OOO

## 화면
### 1) 메인
- 우상단: 로그인/회원가입 버튼
- 중앙: 생년월일 input, 출생일시 input, 제출 버튼
- 검증 실패 시 인라인 오류 문구

### 2) 로그인
- 로그인 성공 시 /payment-temp 이동

### 3) 임시 결제
- 문구: 실제 결제 없음
- 버튼: 결제완료, 홈으로
- 결제완료 → /result-temp
- 홈으로 → /

### 4) 임시 결과
- 메시지: “당신의 오늘, 내일, 이번 달, 올해의 사주는 이렇습니다.”
- 버튼: 홈으로 → /

## 라우팅/가드
- /payment-temp, /result-temp 는 로그인 사용자만 접근
- 미로그인 접근 시 /login 이동

## 데이터/상태
- birthDate, birthTime
- 홈 이동 시 입력 상태 초기화
- 실제 저장 없음

## 참고
제품 목적: ../prd/PRD_saju_auth_payment_result.md
화면 흐름: ../flow/FLOW_saju_auth_payment_result.md