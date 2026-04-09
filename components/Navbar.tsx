"use client";

import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { isSignedIn } = useAuth();

  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-gray-900">
          사주 서비스
        </Link>
        <div>
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="redirect">
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                로그인
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
