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
