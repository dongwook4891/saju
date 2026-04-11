# SPEC_resultscreen

## 문서 목적
result 화면과 기본 채팅 기능의 구현 규칙, 상태값, 데이터 정책, Gemini 응답 형식, UI 동작을 정의한다.

## 기능 범위
- 사주정보 조회
- AI 결과 생성 및 저장
- 저장 결과 재사용
- result 화면 렌더링
- 다시 분석하기
- 질문하기 버튼을 통한 채팅 화면 이동
- 채팅 메시지 송수신 및 저장
- 하루 1개 채팅방 정책

## 날짜 기준
- 기준 시간대: Asia/Seoul
- 오늘 / 내일 / 이번 달 / 올해 계산 기준: Asia/Seoul
- 결과 저장 기준일: Asia/Seoul
- 채팅방 생성 기준일: Asia/Seoul
- 재생성 제한 기준일: Asia/Seoul

## 입력 스펙
### 필드
- birthDate
- birthTime

### 형식
- birthDate: YYYY-MM-DD
- birthTime: HH:mm 또는 null

### 규칙
- birthDate는 필수
- birthTime은 선택
- birthTime이 없으면 시간 미상으로 처리
- birthDate 형식 오류 시 결과 생성 불가
- birthTime 형식 오류 시 결과 생성 불가

## 사주정보 상태 판정 규칙
- 사주정보 레코드가 없으면 `empty_profile`
- 사주정보 레코드는 있으나 필수값이 비거나 형식이 잘못되면 `invalid_profile`
- `empty_profile` 인 경우 입력 화면으로 이동
- `invalid_profile` 인 경우 수정 화면으로 이동

## 결과 생성 정책
- 같은 사용자에게 같은 날짜 기준 결과는 1개만 유지한다.
- 같은 날 result 재진입 시 저장 결과를 재사용한다.
- 당일 저장 결과가 없을 때만 Gemini를 호출한다.
- 사용자가 직접 누르는 다시 분석하기는 하루 1회만 허용한다.
- 초기 생성 실패 후 재시도는 하루 1회 제한에 포함하지 않는다.

## 결과 무효화 정책
- 사주정보 수정 여부는 `profile_updated_at > result_generated_at` 로 판단한다.
- 조건이 참이면 기존 결과는 최신 입력값 기준 결과로 간주하지 않는다.
- 수정 후 result 재진입 시 새 결과를 생성한다.

## 출력 스펙
### 출력 범위
- today
- tomorrow
- month
- year

### 기간 의미
- today: 기준일 하루의 흐름
- tomorrow: 기준일 다음 날의 흐름
- month: 기준일이 포함된 현재 월의 전체 흐름
- year: 기준일이 포함된 현재 연도의 전체 흐름

### 기간별 필수 필드
- summary
- caution
- oneLineTip

### 화면 표시명
- summary: 총평
- caution: 주의점
- oneLineTip: 한 줄 조언

### 텍스트 길이 가이드
- summary: 2~4문장 또는 120~250자 내외
- caution: 1~2문장 또는 60~120자 내외
- oneLineTip: 1문장 또는 20~60자 내외

## Gemini 응답 스펙
### 응답 형식
- Gemini 응답은 JSON이어야 한다.
- 프론트는 JSON 기반으로 카드 UI를 렌더링한다.

### 필수 JSON 구조
```json
{
  "today": {
    "summary": "string",
    "caution": "string",
    "oneLineTip": "string"
  },
  "tomorrow": {
    "summary": "string",
    "caution": "string",
    "oneLineTip": "string"
  },
  "month": {
    "summary": "string",
    "caution": "string",
    "oneLineTip": "string"
  },
  "year": {
    "summary": "string",
    "caution": "string",
    "oneLineTip": "string"
  }
}