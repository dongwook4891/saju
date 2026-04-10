# 사주 입력-인증-결제-결과 플로우 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생년월일/출생일시 입력부터 로그인 확인, 임시 결제, 임시 결과 조회까지의 최소 기능 플로우 구현

**Architecture:**
- 메인 페이지에서 생년월일/출생일시 입력 폼 추가
- React Context로 입력 상태 관리
- Clerk 인증 확인 후 결제/결과 페이지 라우팅
- middleware로 보호된 라우트 가드 구현

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Clerk Auth, React Context

---

## File Structure

### 새로 생성할 파일:
- `app/contexts/InputContext.tsx` - 생년월일/출생일시 입력 상태 관리
- `app/payment-temp/page.tsx` - 임시 결제 페이지
- `app/result-temp/page.tsx` - 임시 결과 페이지
- `middleware.ts` - 라우팅 가드

### 수정할 파일:
- `app/page.tsx` - 메인 페이지에 입력 폼 추가
- `app/layout.tsx` - InputContext Provider 추가

---

## Task 1: 입력 상태 관리 Context 생성

**Files:**
- Create: `app/contexts/InputContext.tsx`

- [ ] **Step 1: InputContext 파일 생성**

```typescript
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface BirthData {
  birthDate: string;
  birthTime: string;
}

interface InputContextType {
  birthData: BirthData;
  setBirthData: (data: BirthData) => void;
  resetBirthData: () => void;
}

const InputContext = createContext<InputContextType | undefined>(undefined);

export function InputProvider({ children }: { children: ReactNode }) {
  const [birthData, setBirthDataState] = useState<BirthData>({
    birthDate: "",
    birthTime: "",
  });

  const setBirthData = (data: BirthData) => {
    setBirthDataState(data);
  };

  const resetBirthData = () => {
    setBirthDataState({ birthDate: "", birthTime: "" });
  };

  return (
    <InputContext.Provider value={{ birthData, setBirthData, resetBirthData }}>
      {children}
    </InputContext.Provider>
  );
}

export function useInput() {
  const context = useContext(InputContext);
  if (context === undefined) {
    throw new Error("useInput must be used within an InputProvider");
  }
  return context;
}
```

- [ ] **Step 2: 브라우저에서 타입 에러 없이 빌드되는지 확인**

Run: `npm run build`
Expected: 빌드 성공, 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add app/contexts/InputContext.tsx
git commit -m "feat: add InputContext for birth data state management"
```

---

## Task 2: Layout에 InputProvider 추가

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: InputProvider import 및 추가**

기존 layout.tsx의 ClerkProvider 내부에 InputProvider 추가:

```typescript
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { InputProvider } from "./contexts/InputContext";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "사주 서비스",
  description: "AI 사주 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <InputProvider>
        <html lang="ko" className="h-full antialiased">
          <body className="min-h-full flex flex-col">
            <Navbar />
            {children}
          </body>
        </html>
      </InputProvider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: 개발 서버 실행 및 에러 확인**

Run: `npm run dev`
Expected: 개발 서버 정상 실행, 콘솔 에러 없음

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add InputProvider to root layout"
```

---

## Task 3: 메인 페이지 입력 폼 구현

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 메인 페이지에 입력 폼 추가**

기존 app/page.tsx를 다음과 같이 수정:

```typescript
"use client";

import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useInput } from "./contexts/InputContext";

export default function Home() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { birthData, setBirthData } = useInput();

  const [birthDate, setBirthDate] = useState(birthData.birthDate);
  const [birthTime, setBirthTime] = useState(birthData.birthTime);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 입력값 검증
    if (!birthDate || !birthTime) {
      setError("생년월일과 출생일시를 모두 입력해주세요.");
      return;
    }

    setError("");

    // 상태 저장
    setBirthData({ birthDate, birthTime });

    // 로그인 상태 확인
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // 로그인 상태면 결제 페이지로 이동
    router.push("/payment-temp");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">사주 서비스</h1>
          <p className="text-gray-500">생년월일과 출생일시를 입력하세요</p>
        </div>

        {!isSignedIn && (
          <div className="flex gap-3 justify-center">
            <SignInButton mode="redirect">
              <button className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
                로그인
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                회원가입
              </button>
            </SignUpButton>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">
              생년월일
            </label>
            <input
              type="date"
              id="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="birthTime" className="block text-sm font-medium text-gray-700 mb-1">
              출생일시
            </label>
            <input
              type="time"
              id="birthTime"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            사주 보기
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 브라우저에서 기능 확인**

1. http://localhost:3000 접속
2. 생년월일 입력 필드 확인
3. 출생일시 입력 필드 확인
4. 빈 값으로 제출 시 오류 메시지 확인
5. 값 입력 후 제출 시 로그인 페이지로 이동 확인 (미로그인 상태)

Expected: 모든 기능 정상 동작

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add birth date and time input form to main page"
```

---

## Task 4: 임시 결제 페이지 구현

**Files:**
- Create: `app/payment-temp/page.tsx`

- [ ] **Step 1: 결제 페이지 파일 생성**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useInput } from "../contexts/InputContext";

export default function PaymentTempPage() {
  const router = useRouter();
  const { resetBirthData } = useInput();

  const handleComplete = () => {
    router.push("/result-temp");
  };

  const handleGoHome = () => {
    resetBirthData();
    router.push("/");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">결제 안내</h1>
          <p className="text-gray-600">
            이것은 임시 결제 화면입니다.
            <br />
            실제 결제는 이루어지지 않습니다.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleComplete}
            className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            결제완료
          </button>
          <button
            onClick={handleGoHome}
            className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            홈으로
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 브라우저에서 페이지 접근 확인**

1. 메인 페이지에서 입력 후 제출
2. 로그인 완료
3. /payment-temp 페이지 정상 표시 확인
4. "결제완료" 버튼 확인
5. "홈으로" 버튼 확인

Expected: 페이지 정상 렌더링

- [ ] **Step 3: Commit**

```bash
git add app/payment-temp/page.tsx
git commit -m "feat: add temporary payment page"
```

---

## Task 5: 임시 결과 페이지 구현

**Files:**
- Create: `app/result-temp/page.tsx`

- [ ] **Step 1: 결과 페이지 파일 생성**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useInput } from "../contexts/InputContext";

export default function ResultTempPage() {
  const router = useRouter();
  const { resetBirthData } = useInput();

  const handleGoHome = () => {
    resetBirthData();
    router.push("/");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">사주 결과</h1>
          <p className="text-gray-600 leading-relaxed">
            당신의 오늘, 내일, 이번 달, 올해의 사주는 이렇습니다.
          </p>
        </div>

        <button
          onClick={handleGoHome}
          className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          홈으로
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 브라우저에서 페이지 접근 확인**

1. 결제 페이지에서 "결제완료" 클릭
2. /result-temp 페이지 정상 표시 확인
3. 안내 메시지 확인
4. "홈으로" 버튼 확인

Expected: 페이지 정상 렌더링

- [ ] **Step 3: Commit**

```bash
git add app/result-temp/page.tsx
git commit -m "feat: add temporary result page"
```

---

## Task 6: 라우팅 가드 Middleware 구현

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Middleware 파일 생성**

프로젝트 루트에 middleware.ts 생성:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/payment-temp(.*)",
  "/result-temp(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 보호된 라우트이고 로그인하지 않은 경우
  if (isProtectedRoute(req) && !userId) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: 브라우저에서 라우팅 가드 테스트**

1. 로그아웃 상태에서 http://localhost:3000/payment-temp 직접 접근
2. /sign-in으로 리다이렉트되는지 확인
3. 로그아웃 상태에서 http://localhost:3000/result-temp 직접 접근
4. /sign-in으로 리다이렉트되는지 확인
5. 로그인 후 /payment-temp 접근 시 정상 표시 확인

Expected: 미로그인 시 로그인 페이지로 리다이렉트, 로그인 후 정상 접근

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware for protected routes"
```

---

## Task 7: 전체 플로우 통합 테스트

**Files:**
- None (manual testing)

- [ ] **Step 1: 입력 검증 테스트**

1. 메인 페이지에서 빈 폼 제출
2. 오류 메시지 "생년월일과 출생일시를 모두 입력해주세요." 표시 확인
3. 생년월일만 입력하고 제출
4. 동일한 오류 메시지 확인

Expected: 입력값 검증 정상 동작

- [ ] **Step 2: 로그인 플로우 테스트**

1. 로그아웃 상태에서 메인 페이지 접속
2. 생년월일 "1990-01-01", 출생일시 "10:00" 입력
3. "사주 보기" 클릭
4. /sign-in 페이지로 이동 확인
5. 로그인 완료
6. /payment-temp 페이지로 이동 확인

Expected: 미로그인 사용자는 로그인 후 결제 페이지로 이동

- [ ] **Step 3: 결제-결과 플로우 테스트**

1. 로그인 상태에서 메인 페이지 접속
2. 생년월일, 출생일시 입력
3. "사주 보기" 클릭
4. /payment-temp 페이지 표시 확인
5. "결제완료" 클릭
6. /result-temp 페이지 표시 확인
7. 안내 메시지 "당신의 오늘, 내일, 이번 달, 올해의 사주는 이렇습니다." 확인

Expected: 결제-결과 플로우 정상 동작

- [ ] **Step 4: 홈으로 버튼 테스트**

1. 결제 페이지에서 "홈으로" 클릭
2. 메인 페이지로 이동 확인
3. 입력 필드가 빈 값으로 초기화되었는지 확인
4. 다시 입력 후 결과 페이지까지 이동
5. 결과 페이지에서 "홈으로" 클릭
6. 메인 페이지로 이동 및 입력 필드 초기화 확인

Expected: 홈으로 이동 시 입력 상태 초기화

- [ ] **Step 5: 보호된 라우트 직접 접근 테스트**

1. 로그아웃
2. 브라우저 주소창에 http://localhost:3000/payment-temp 직접 입력
3. /sign-in으로 리다이렉트 확인
4. 브라우저 주소창에 http://localhost:3000/result-temp 직접 입력
5. /sign-in으로 리다이렉트 확인

Expected: 미로그인 상태에서 보호된 라우트 직접 접근 시 로그인 페이지로 리다이렉트

- [ ] **Step 6: 문서 충돌 확인**

1. docs/prd/PRD_saju_auth_payment_result.md 재확인
2. docs/flow/FLOW_saju_auth_payment_result.md 재확인
3. docs/spec/SPEC_saju_auth_payment_result.md 재확인
4. 구현 내용이 문서와 충돌하지 않는지 확인

Expected: 모든 요구사항 충족, 문서와 충돌 없음

- [ ] **Step 7: 최종 빌드 테스트**

Run: `npm run build`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 8: 최종 Commit**

```bash
git add -A
git commit -m "test: verify complete auth-payment-result flow"
```

---

## Completion Checklist

모든 태스크 완료 후 다음 사항 확인:

- [ ] 메인화면에서 생년월일과 출생일시를 입력하고 제출할 수 있다
- [ ] 입력값이 비어 있으면 제출되지 않고 오류 문구가 보인다
- [ ] 미로그인 상태에서 제출하면 로그인 화면으로 이동한다
- [ ] 로그인 완료 후 임시 결제 화면으로 정상 이동한다
- [ ] 임시 결제 화면에서 결제완료 클릭 시 임시 결과 화면으로 이동한다
- [ ] 임시 결제 화면과 임시 결과 화면의 홈으로 버튼이 메인화면으로 이동시키고 입력 상태를 초기화한다
- [ ] 미로그인 사용자가 결제화면 또는 결과화면 URL로 직접 접근하면 로그인 화면으로 이동한다
- [ ] 구현 결과가 PRD, FLOW, SPEC 문서와 충돌하지 않는다

---

## Notes

- 실제 결제 API 연동 없음
- 실제 사주 계산 로직 없음
- 사용자별 결과 저장 없음
- 백엔드 DB 저장 없음
- 최소 기능 구현에 집중
