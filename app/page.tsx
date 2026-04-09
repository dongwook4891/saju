"use client";

import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { isSignedIn } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-900">사주 서비스</h1>
      <p className="text-gray-500">로그인하고 나만의 사주를 확인해보세요.</p>

      {!isSignedIn ? (
        <div className="flex gap-3">
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
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-700">로그인 되었습니다.</p>
          <UserButton />
          <Link
            href="/mypage"
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            마이페이지
          </Link>
        </div>
      )}
    </main>
  );
}
