# Clerk 인증 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clerk 기반 로그인/회원가입 시스템 구축 및 Supabase 사용자 동기화

**Architecture:** Clerk가 인증을 담당하고 Next.js middleware로 페이지를 보호하며, Webhook을 통해 Supabase users 테이블과 동기화. idempotent 처리로 이벤트 순서 문제 해결.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Clerk, Supabase, pnpm

---

## File Structure

**New Files:**
- `package.json` - 프로젝트 메타데이터 및 의존성
- `tsconfig.json` - TypeScript 설정
- `tailwind.config.ts` - Tailwind CSS 설정
- `next.config.js` - Next.js 설정
- `.env.local` - 환경 변수 (Git 제외)
- `.gitignore` - Git 무시 파일 목록
- `middleware.ts` - 페이지 보호 미들웨어
- `app/layout.tsx` - 루트 레이아웃 (ClerkProvider)
- `app/page.tsx` - 메인 페이지
- `app/sign-in/[[...sign-in]]/page.tsx` - 로그인 페이지
- `app/sign-up/[[...sign-up]]/page.tsx` - 회원가입 페이지
- `app/mypage/page.tsx` - 보호 페이지 예시 1
- `app/payment/page.tsx` - 보호 페이지 예시 2
- `app/subscription/page.tsx` - 보호 페이지 예시 3
- `app/api/webhooks/clerk/route.ts` - Clerk Webhook 핸들러
- `components/Navbar.tsx` - 상단 네비게이션
- `lib/supabase.ts` - Supabase 클라이언트
- `lib/auth/sync-clerk-user.ts` - Clerk 사용자 동기화 헬퍼
- `lib/auth/get-user-status.ts` - 사용자 상태 조회 헬퍼
- `supabase/migrations/001_create_users.sql` - users 테이블 생성

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `next.config.js`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

프롬프트 응답:
- Would you like to use TypeScript? → Yes
- Would you like to use ESLint? → Yes
- Would you like to use Tailwind CSS? → Yes
- Would you like to use `src/` directory? → No
- Would you like to use App Router? → Yes
- Would you like to customize the default import alias? → No

- [ ] **Step 2: 프로젝트 구조 확인**

```bash
ls -la
```

Expected: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js`, `app/` 디렉토리 존재

- [ ] **Step 3: 개발 서버 실행 테스트**

```bash
pnpm dev
```

Expected: http://localhost:3000에서 Next.js 기본 페이지 표시

브라우저에서 확인 후 Ctrl+C로 중지

- [ ] **Step 4: Git 초기화**

```bash
git init
git add .
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"
```

---

## Task 2: Supabase 마이그레이션 파일 작성

**Files:**
- Create: `supabase/migrations/001_create_users.sql`

- [ ] **Step 1: supabase 디렉토리 생성**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: users 테이블 마이그레이션 작성**

`supabase/migrations/001_create_users.sql`:

```sql
-- users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 코멘트 추가
COMMENT ON TABLE users IS '서비스 사용자 정보 (Clerk와 동기화)';
COMMENT ON COLUMN users.clerk_user_id IS '현재 연결된 Clerk 사용자 ID (재가입 시 변경 가능)';
COMMENT ON COLUMN users.email IS '중복 가입 판정 기준';
COMMENT ON COLUMN users.status IS 'active: 정상, withdrawn: 탈퇴(재가입 가능), blocked: 차단(재가입 불가)';
COMMENT ON COLUMN users.last_clerk_event_at IS 'Clerk 이벤트 순서 보장용 타임스탬프';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_create_users.sql
git commit -m "feat: add users table migration"
```

---

## Task 3: 환경 변수 설정

**Files:**
- Create: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: .env.local 파일 생성**

`.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

- [ ] **Step 2: .gitignore 확인**

`.gitignore`에 `.env.local`이 포함되어 있는지 확인:

```bash
grep -q "\.env\.local" .gitignore && echo "Already ignored" || echo ".env.local" >> .gitignore
```

Expected: "Already ignored" (Next.js 기본 .gitignore에 이미 포함됨)

- [ ] **Step 3: Commit**

```bash
git add .env.local .gitignore
git commit -m "chore: add environment variables template"
```

**Note:** 실제 API 키는 사용자가 직접 입력해야 함

---

## Task 4: Clerk 패키지 설치 및 설정

**Files:**
- Modify: `package.json`
- Create: `middleware.ts`

- [ ] **Step 1: Clerk 패키지 설치**

```bash
pnpm add @clerk/nextjs
```

Expected: `@clerk/nextjs`가 package.json dependencies에 추가됨

- [ ] **Step 2: 설치 확인**

```bash
pnpm list @clerk/nextjs
```

Expected: 버전 정보 표시

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: install Clerk SDK"
```

---

## Task 5: 미들웨어 설정 (페이지 보호)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: 미들웨어 파일 작성**

`middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 보호할 경로 정의
const isProtectedRoute = createRouteMatcher([
  "/mypage(.*)",
  "/payment(.*)",
  "/subscription(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 보호된 경로는 인증 필요
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // API routes, _next, static files 제외
    "/((?!_next|.*\\..*).*)",
    "/",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add authentication middleware for protected routes"
```

---

## Task 6: 루트 레이아웃 (ClerkProvider)

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: 기존 layout.tsx 읽기**

```bash
cat app/layout.tsx
```

- [ ] **Step 2: ClerkProvider로 감싸기**

`app/layout.tsx`:

```typescript
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "사주 서비스",
  description: "사주명리 웹서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="ko">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: 개발 서버 실행 테스트**

```bash
pnpm dev
```

Expected: 에러 없이 실행됨 (환경 변수가 설정되어 있어야 함)

Ctrl+C로 중지

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wrap app with ClerkProvider"
```

---

## Task 7: 로그인 페이지

**Files:**
- Create: `app/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p app/sign-in/\[\[...sign-in\]\]
```

- [ ] **Step 2: 로그인 페이지 작성**

`app/sign-in/[[...sign-in]]/page.tsx`:

```typescript
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 http://localhost:3000/sign-in 접속

Expected: Clerk 로그인 화면 표시

Ctrl+C로 중지

- [ ] **Step 4: Commit**

```bash
git add app/sign-in
git commit -m "feat: add sign-in page with Clerk component"
```

---

## Task 8: 회원가입 페이지

**Files:**
- Create: `app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p app/sign-up/\[\[...sign-up\]\]
```

- [ ] **Step 2: 회원가입 페이지 작성**

`app/sign-up/[[...sign-up]]/page.tsx`:

```typescript
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 http://localhost:3000/sign-up 접속

Expected: Clerk 회원가입 화면 표시

Ctrl+C로 중지

- [ ] **Step 4: Commit**

```bash
git add app/sign-up
git commit -m "feat: add sign-up page with Clerk component"
```

---

## Task 9: Supabase 클라이언트

**Files:**
- Modify: `package.json`
- Create: `lib/supabase.ts`

- [ ] **Step 1: Supabase 패키지 설치**

```bash
pnpm add @supabase/supabase-js
```

Expected: `@supabase/supabase-js`가 package.json에 추가됨

- [ ] **Step 2: lib 디렉토리 생성**

```bash
mkdir -p lib
```

- [ ] **Step 3: Supabase 클라이언트 작성**

`lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

// 브라우저용 클라이언트 (anon key 사용)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 서버용 클라이언트 (service role key 사용)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 사용자 타입 정의
export type User = {
  id: string;
  clerk_user_id: string | null;
  email: string;
  auth_provider: string;
  name: string | null;
  gender: string | null;
  birth_date: string | null;
  agreed_terms_at: string | null;
  status: "active" | "withdrawn" | "blocked";
  last_clerk_event_at: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml lib/supabase.ts
git commit -m "feat: add Supabase client and type definitions"
```

---

## Task 10: Clerk 사용자 동기화 헬퍼

**Files:**
- Create: `lib/auth/sync-clerk-user.ts`

- [ ] **Step 1: auth 디렉토리 생성**

```bash
mkdir -p lib/auth
```

- [ ] **Step 2: 동기화 헬퍼 작성**

`lib/auth/sync-clerk-user.ts`:

```typescript
import { supabaseAdmin, type User } from "@/lib/supabase";

type ClerkUserData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  authProvider: "google" | "email";
  eventTimestamp: string;
};

export async function syncClerkUser(
  eventType: "created" | "updated",
  userData: ClerkUserData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, email, firstName, username, authProvider, eventTimestamp } =
      userData;

    // 기존 사용자 조회 (이메일 기준)
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    // 이벤트가 오래된 것이면 무시
    if (
      existingUser &&
      existingUser.last_clerk_event_at &&
      new Date(existingUser.last_clerk_event_at) >= new Date(eventTimestamp)
    ) {
      console.log("Ignoring old event for user:", email);
      return { success: true };
    }

    // 재가입 가능 여부 확인
    if (existingUser && existingUser.status === "withdrawn") {
      // 재가입: 기존 row 업데이트
      const { error } = await supabaseAdmin
        .from("users")
        .update({
          clerk_user_id: id,
          auth_provider: authProvider,
          name: firstName || username,
          status: "active",
          last_clerk_event_at: eventTimestamp,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) throw error;
      return { success: true };
    }

    // 중복 가입 차단 (active 또는 blocked)
    if (existingUser && existingUser.status !== "withdrawn") {
      console.error("Email already registered:", email, "status:", existingUser.status);
      return {
        success: false,
        error: `이미 ${existingUser.auth_provider}로 가입된 계정입니다. 해당 방법으로 로그인해주세요`,
      };
    }

    // 신규 가입: 새 row 생성
    const { error } = await supabaseAdmin.from("users").upsert(
      {
        clerk_user_id: id,
        email,
        auth_provider: authProvider,
        name: firstName || username,
        status: "active",
        last_clerk_event_at: eventTimestamp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error syncing Clerk user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function markUserWithdrawn(
  clerkUserId: string,
  eventTimestamp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기존 사용자 조회
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .single();

    // 이벤트가 오래된 것이면 무시
    if (
      existingUser &&
      existingUser.last_clerk_event_at &&
      new Date(existingUser.last_clerk_event_at) >= new Date(eventTimestamp)
    ) {
      console.log("Ignoring old delete event for user:", clerkUserId);
      return { success: true };
    }

    // 탈퇴 처리 (row 삭제하지 않음)
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        status: "withdrawn",
        clerk_user_id: null, // 재가입 시 깨끗하게 재사용
        last_clerk_event_at: eventTimestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", clerkUserId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error marking user as withdrawn:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth/sync-clerk-user.ts
git commit -m "feat: add Clerk user sync helper functions"
```

---

## Task 11: 사용자 상태 조회 헬퍼

**Files:**
- Create: `lib/auth/get-user-status.ts`

- [ ] **Step 1: 상태 조회 헬퍼 작성**

`lib/auth/get-user-status.ts`:

```typescript
import { supabase, type User } from "@/lib/supabase";

export async function getUserStatus(
  clerkUserId: string
): Promise<{ user: User | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (error) {
      // 사용자를 찾지 못한 경우
      if (error.code === "PGRST116") {
        return { user: null };
      }
      throw error;
    }

    return { user: data as User };
  } catch (error) {
    console.error("Error getting user status:", error);
    return {
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function isUserBlocked(user: User | null): boolean {
  return user?.status === "blocked";
}

export function isUserWithdrawn(user: User | null): boolean {
  return user?.status === "withdrawn";
}

export function isUserActive(user: User | null): boolean {
  return user?.status === "active";
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/get-user-status.ts
git commit -m "feat: add user status helper functions"
```

---

## Task 12: Webhook 엔드포인트

**Files:**
- Modify: `package.json`
- Create: `app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: svix 패키지 설치**

```bash
pnpm add svix
```

Expected: `svix`가 package.json에 추가됨

- [ ] **Step 2: webhook 디렉토리 생성**

```bash
mkdir -p app/api/webhooks/clerk
```

- [ ] **Step 3: Webhook 라우트 작성**

`app/api/webhooks/clerk/route.ts`:

```typescript
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { syncClerkUser, markUserWithdrawn } from "@/lib/auth/sync-clerk-user";

export async function POST(req: Request) {
  // Webhook secret 확인
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set");
  }

  // 헤더 가져오기
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // 헤더 검증
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  // Body 가져오기
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Svix 인스턴스 생성
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // 서명 검증
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Webhook signature verification failed", err);
    return new Response("Error: Webhook signature verification failed", {
      status: 401,
    });
  }

  // 이벤트 타입 확인
  const eventType = evt.type;
  console.log(`Webhook event received: ${eventType}`);

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      // 이메일 추출
      const primaryEmail = evt.data.email_addresses?.find(
        (email) => email.id === evt.data.primary_email_address_id
      );

      if (!primaryEmail) {
        console.error("No primary email found for user:", evt.data.id);
        return new Response("Error: No primary email", { status: 400 });
      }

      // auth_provider 결정
      const hasGoogleAccount = evt.data.external_accounts?.some(
        (account) => account.provider === "google"
      );
      const authProvider = hasGoogleAccount ? "google" : "email";

      // 사용자 동기화
      const result = await syncClerkUser(
        eventType === "user.created" ? "created" : "updated",
        {
          id: evt.data.id,
          email: primaryEmail.email_address,
          firstName: evt.data.first_name,
          lastName: evt.data.last_name,
          username: evt.data.username,
          authProvider,
          eventTimestamp: new Date(evt.data.updated_at || evt.data.created_at).toISOString(),
        }
      );

      if (!result.success) {
        console.error("Failed to sync user:", result.error);
        // 중복 가입 등의 경우 로그만 남기고 200 반환 (Clerk에서 재시도하지 않도록)
        return new Response(JSON.stringify({ error: result.error }), {
          status: 200,
        });
      }
    } else if (eventType === "user.deleted") {
      // 탈퇴 처리
      const result = await markUserWithdrawn(
        evt.data.id!,
        new Date().toISOString()
      );

      if (!result.success) {
        console.error("Failed to mark user as withdrawn:", result.error);
        return new Response(JSON.stringify({ error: result.error }), {
          status: 500,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml app/api/webhooks/clerk/route.ts
git commit -m "feat: add Clerk webhook endpoint for user sync"
```

---

## Task 13: 네비게이션 바

**Files:**
- Create: `components/Navbar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: components 디렉토리 생성**

```bash
mkdir -p components
```

- [ ] **Step 2: Navbar 컴포넌트 작성**

`components/Navbar.tsx`:

```typescript
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">
              사주 서비스
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <SignedIn>
              {/* 로그인 상태 */}
              <Link
                href="/mypage"
                className="text-gray-700 hover:text-gray-900"
              >
                마이페이지
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            <SignedOut>
              {/* 비로그인 상태 */}
              <Link
                href="/sign-in"
                className="text-gray-700 hover:text-gray-900"
              >
                로그인
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                회원가입
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: 레이아웃에 Navbar 추가**

`app/layout.tsx`:

```typescript
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "사주 서비스",
  description: "사주명리 웹서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="ko">
        <body className={inter.className}>
          <Navbar />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 4: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 접속

Expected: 상단에 네비게이션 바 표시, 비로그인 상태에서 "로그인", "회원가입" 버튼 보임

Ctrl+C로 중지

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx app/layout.tsx
git commit -m "feat: add navigation bar with auth buttons"
```

---

## Task 14: 메인 페이지 개선

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 메인 페이지 작성**

`app/page.tsx`:

```typescript
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function HomePage() {
  const user = await currentUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          사주명리 서비스에 오신 것을 환영합니다
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          {user
            ? `안녕하세요, ${user.firstName || user.username || "회원"}님!`
            : "로그인하여 더 많은 기능을 이용하세요"}
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/mypage"
            className="rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            마이페이지 가기
          </Link>
          <Link
            href="/payment"
            className="rounded-md bg-green-600 px-6 py-3 text-white hover:bg-green-700"
          >
            결제하기
          </Link>
          <Link
            href="/subscription"
            className="rounded-md bg-purple-600 px-6 py-3 text-white hover:bg-purple-700"
          >
            구독 관리
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 접속

Expected: 환영 메시지와 버튼들 표시

Ctrl+C로 중지

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: improve home page with welcome message and links"
```

---

## Task 15: 보호 페이지 - 마이페이지

**Files:**
- Create: `app/mypage/page.tsx`

- [ ] **Step 1: mypage 디렉토리 생성**

```bash
mkdir -p app/mypage
```

- [ ] **Step 2: 마이페이지 작성**

`app/mypage/page.tsx`:

```typescript
import { currentUser } from "@clerk/nextjs/server";
import { getUserStatus, isUserBlocked, isUserWithdrawn } from "@/lib/auth/get-user-status";
import Link from "next/link";

export default async function MyPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <Link href="/sign-in" className="mt-4 inline-block text-blue-600">
          로그인하기
        </Link>
      </div>
    );
  }

  // Supabase 사용자 상태 확인
  const { user: dbUser, error } = await getUserStatus(user.id);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">오류가 발생했습니다</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  if (isUserBlocked(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">
          이용이 제한된 계정입니다
        </h1>
        <p className="mt-2 text-gray-600">
          고객센터로 문의해주세요: support@example.com
        </p>
      </div>
    );
  }

  if (isUserWithdrawn(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">탈퇴한 계정입니다</h1>
        <p className="mt-2 text-gray-600">
          다시 가입하시려면 회원가입을 진행해주세요
        </p>
        <Link
          href="/sign-up"
          className="mt-4 inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          회원가입하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">마이페이지</h1>

      <div className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold">회원 정보</h2>
        <dl className="mt-4 space-y-2">
          <div>
            <dt className="font-medium text-gray-600">이름:</dt>
            <dd>{user.firstName || user.username || "미설정"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">이메일:</dt>
            <dd>{user.emailAddresses[0]?.emailAddress}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">로그인 방식:</dt>
            <dd>{dbUser?.auth_provider || "미확인"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">계정 상태:</dt>
            <dd className="text-green-600">{dbUser?.status || "확인 중"}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>보호된 페이지 테스트: 이 페이지는 로그인한 사용자만 접근할 수 있습니다.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 비로그인 상태 테스트**

```bash
pnpm dev
```

브라우저에서 비로그인 상태로 http://localhost:3000/mypage 접속

Expected: /sign-in으로 자동 리다이렉트

- [ ] **Step 4: 로그인 후 테스트**

로그인 후 http://localhost:3000/mypage 접속

Expected: 마이페이지 내용 표시

Ctrl+C로 중지

- [ ] **Step 5: Commit**

```bash
git add app/mypage/page.tsx
git commit -m "feat: add mypage with user status checking"
```

---

## Task 16: 보호 페이지 - 결제

**Files:**
- Create: `app/payment/page.tsx`

- [ ] **Step 1: payment 디렉토리 생성**

```bash
mkdir -p app/payment
```

- [ ] **Step 2: 결제 페이지 작성**

`app/payment/page.tsx`:

```typescript
import { currentUser } from "@clerk/nextjs/server";
import { getUserStatus, isUserBlocked, isUserWithdrawn } from "@/lib/auth/get-user-status";
import Link from "next/link";

export default async function PaymentPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <Link href="/sign-in" className="mt-4 inline-block text-blue-600">
          로그인하기
        </Link>
      </div>
    );
  }

  // Supabase 사용자 상태 확인
  const { user: dbUser, error } = await getUserStatus(user.id);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">오류가 발생했습니다</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  if (isUserBlocked(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">
          이용이 제한된 계정입니다
        </h1>
        <p className="mt-2 text-gray-600">
          고객센터로 문의해주세요: support@example.com
        </p>
      </div>
    );
  }

  if (isUserWithdrawn(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">탈퇴한 계정입니다</h1>
        <p className="mt-2 text-gray-600">
          다시 가입하시려면 회원가입을 진행해주세요
        </p>
        <Link
          href="/sign-up"
          className="mt-4 inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          회원가입하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">결제하기</h1>

      <div className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold">결제 정보</h2>
        <p className="mt-4 text-gray-600">
          여기에 결제 관련 기능이 들어갑니다. (2차 개발 범위)
        </p>
        <div className="mt-6 rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            ✅ 보호 페이지 테스트 성공: 로그인한 사용자만 이 페이지에 접근할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 비로그인 상태로 http://localhost:3000/payment 접속

Expected: /sign-in으로 자동 리다이렉트

로그인 후 접속 시 결제 페이지 표시

Ctrl+C로 중지

- [ ] **Step 4: Commit**

```bash
git add app/payment/page.tsx
git commit -m "feat: add payment page with user status checking"
```

---

## Task 17: 보호 페이지 - 구독

**Files:**
- Create: `app/subscription/page.tsx`

- [ ] **Step 1: subscription 디렉토리 생성**

```bash
mkdir -p app/subscription
```

- [ ] **Step 2: 구독 페이지 작성**

`app/subscription/page.tsx`:

```typescript
import { currentUser } from "@clerk/nextjs/server";
import { getUserStatus, isUserBlocked, isUserWithdrawn } from "@/lib/auth/get-user-status";
import Link from "next/link";

export default async function SubscriptionPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <Link href="/sign-in" className="mt-4 inline-block text-blue-600">
          로그인하기
        </Link>
      </div>
    );
  }

  // Supabase 사용자 상태 확인
  const { user: dbUser, error } = await getUserStatus(user.id);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">오류가 발생했습니다</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  if (isUserBlocked(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">
          이용이 제한된 계정입니다
        </h1>
        <p className="mt-2 text-gray-600">
          고객센터로 문의해주세요: support@example.com
        </p>
      </div>
    );
  }

  if (isUserWithdrawn(dbUser)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">탈퇴한 계정입니다</h1>
        <p className="mt-2 text-gray-600">
          다시 가입하시려면 회원가입을 진행해주세요
        </p>
        <Link
          href="/sign-up"
          className="mt-4 inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          회원가입하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">구독 관리</h1>

      <div className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-xl font-semibold">구독 정보</h2>
        <p className="mt-4 text-gray-600">
          여기에 구독 관련 기능이 들어갑니다. (2차 개발 범위)
        </p>
        <div className="mt-6 rounded-md bg-purple-50 p-4">
          <p className="text-sm text-purple-800">
            ✅ 보호 페이지 테스트 성공: 로그인한 사용자만 이 페이지에 접근할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 테스트**

```bash
pnpm dev
```

브라우저에서 비로그인 상태로 http://localhost:3000/subscription 접속

Expected: /sign-in으로 자동 리다이렉트

로그인 후 접속 시 구독 페이지 표시

Ctrl+C로 중지

- [ ] **Step 4: Commit**

```bash
git add app/subscription/page.tsx
git commit -m "feat: add subscription page with user status checking"
```

---

## Task 18: README 작성

**Files:**
- Create: `README.md`

- [ ] **Step 1: README 작성**

`README.md`:

```markdown
# 사주 서비스

Clerk 인증 시스템과 Supabase를 사용한 사주명리 웹서비스

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **인증**: Clerk (Google OAuth + Email/Password)
- **데이터베이스**: Supabase (PostgreSQL)
- **패키지 매니저**: pnpm

## 시작하기

### 1. 의존성 설치

\`\`\`bash
pnpm install
\`\`\`

### 2. 환경 변수 설정

\`.env.local\` 파일에 다음 값을 입력하세요:

\`\`\`env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
\`\`\`

### 3. Supabase 마이그레이션 실행

Supabase Dashboard에서 SQL Editor를 열고 \`supabase/migrations/001_create_users.sql\` 파일의 내용을 실행하세요.

### 4. Clerk 설정

1. [Clerk Dashboard](https://dashboard.clerk.com)에 로그인
2. Google OAuth 활성화
3. Email/Password 활성화
4. Webhook URL 설정: \`https://your-domain/api/webhooks/clerk\`
5. Webhook 이벤트 활성화: \`user.created\`, \`user.updated\`, \`user.deleted\`

### 5. 개발 서버 실행

\`\`\`bash
pnpm dev
\`\`\`

브라우저에서 http://localhost:3000을 열어보세요.

## 주요 기능

- ✅ Google / Email 로그인/회원가입
- ✅ 페이지 보호 (로그인 필요)
- ✅ Clerk ↔ Supabase 사용자 동기화
- ✅ 탈퇴 계정 재가입 지원
- ✅ 차단 계정 접근 제한

## 보호된 페이지

- `/mypage` - 마이페이지
- `/payment` - 결제
- `/subscription` - 구독 관리

비로그인 상태로 접근 시 자동으로 로그인 페이지로 이동합니다.

## 프로젝트 구조

\`\`\`
saju/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # ClerkProvider
│   ├── page.tsx           # 메인 페이지
│   ├── sign-in/           # 로그인
│   ├── sign-up/           # 회원가입
│   ├── mypage/            # 보호 페이지 1
│   ├── payment/           # 보호 페이지 2
│   ├── subscription/      # 보호 페이지 3
│   └── api/webhooks/clerk # Webhook
├── components/            # React 컴포넌트
├── lib/                   # 유틸리티 함수
│   ├── supabase.ts       # Supabase 클라이언트
│   └── auth/             # 인증 헬퍼
├── middleware.ts          # 페이지 보호
└── supabase/migrations/  # DB 마이그레이션
\`\`\`

## 문서

- [PRD](docs/prd/PRD_clerk_auth.md)
- [FLOW](docs/flow/FLOW_clerk_auth.md)
- [SPEC](docs/spec/SPEC_clerk_auth.md)
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add README.md
git commit -m "docs: add README with setup instructions"
\`\`\`

---

## Self-Review Checklist

### Spec Coverage

✅ **기술 스택** - Task 1, 4, 9 (Next.js, Clerk, Supabase)
✅ **프로젝트 구조** - Task 1 (디렉토리 생성)
✅ **인증 아키텍처** - Task 5, 6, 7, 8 (ClerkProvider, 로그인/회원가입)
✅ **데이터 모델** - Task 2 (users 테이블)
✅ **Clerk-Supabase 동기화** - Task 10, 11, 12 (헬퍼, Webhook)
✅ **인증 미들웨어** - Task 5 (middleware.ts)
✅ **보호 페이지** - Task 15, 16, 17 (mypage, payment, subscription)
✅ **에러 처리** - Task 10, 12, 15 (동기화 실패, 상태 체크)
✅ **보안** - Task 3, 12 (환경 변수, 서명 검증)
✅ **네비게이션** - Task 13 (Navbar)

### Placeholder Scan

✅ No TBD, TODO, or "implement later"
✅ All code blocks contain actual implementation
✅ All error handling is explicit
✅ All test steps have expected output

### Type Consistency

✅ User type defined in lib/supabase.ts
✅ ClerkUserData type in sync-clerk-user.ts
✅ Consistent use of status: "active" | "withdrawn" | "blocked"
✅ Consistent use of auth_provider: "google" | "email"

---

## Execution Ready

Plan complete and saved to `docs/superpowers/plans/2026-04-09-clerk-auth-implementation.md`.
