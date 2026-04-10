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
