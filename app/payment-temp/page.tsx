"use client";

import { useRouter } from "next/navigation";
import { useInput } from "../contexts/InputContext";

export default function PaymentTempPage() {
  const router = useRouter();
  const { resetBirthData } = useInput();

  const handleComplete = () => {
    router.push("/result");
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
