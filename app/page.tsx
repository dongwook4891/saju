"use client";

import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useInput } from "./contexts/InputContext";

export default function Home() {
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const { birthData, setBirthData, resetBirthData } = useInput();

  const [birthDate, setBirthDate] = useState(birthData.birthDate);
  const [birthTime, setBirthTime] = useState(birthData.birthTime);
  const [error, setError] = useState("");
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const timePickerRef = useRef<HTMLInputElement>(null);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자만 추출
    const numbers = value.replace(/\D/g, '');

    // HH:MM 형식으로 포맷팅
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 2);
      if (numbers.length > 2) {
        formatted += ':' + numbers.substring(2, 4);
      }
    }

    setBirthTime(formatted);
  };

  const handleTimePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthTime(e.target.value);
  };

  const openTimePicker = () => {
    timePickerRef.current?.showPicker();
  };

  // DB에서 저장된 생년월일/출생일시 조회
  const fetchBirthInfo = async () => {
    try {
      const response = await fetch("/api/user/birth-info");
      if (response.ok) {
        const data = await response.json();
        if (data.birthDate && data.birthHour !== null && data.birthMinute !== null) {
          setBirthDate(data.birthDate);
          const formattedTime = `${String(data.birthHour).padStart(2, "0")}:${String(data.birthMinute).padStart(2, "0")}`;
          setBirthTime(formattedTime);
        }
      }
    } catch (error) {
      console.error("Failed to fetch birth info:", error);
    }
  };

  // sessionStorage의 임시 입력값을 DB에 저장
  const savePendingBirthInfo = async () => {
    try {
      const pendingDate = sessionStorage.getItem("pendingBirthDate");
      const pendingTime = sessionStorage.getItem("pendingBirthTime");

      // 3개 값이 모두 있을 때만 저장
      if (pendingDate && pendingTime && pendingTime.includes(":")) {
        const [hourStr, minuteStr] = pendingTime.split(":");
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        if (!isNaN(hour) && !isNaN(minute)) {
          const response = await fetch("/api/user/birth-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              birthDate: pendingDate,
              birthHour: hour,
              birthMinute: minute,
            }),
          });

          if (response.ok) {
            // 저장 성공 후 sessionStorage 정리
            sessionStorage.removeItem("pendingBirthDate");
            sessionStorage.removeItem("pendingBirthTime");
          }
        }
      }
    } catch (error) {
      console.error("Failed to save pending birth info:", error);
    }
  };

  // 로그인 상태 변경 감지 및 처리
  useEffect(() => {
    if (isSignedIn && userId) {
      // 로그인 상태

      // 사용자가 바뀌었는지 확인
      if (lastUserId && lastUserId !== userId) {
        // 다른 사용자로 로그인: 이전 값 완전히 초기화
        sessionStorage.removeItem("pendingBirthDate");
        sessionStorage.removeItem("pendingBirthTime");
        resetBirthData();
        setBirthDate("");
        setBirthTime("");
      }

      setLastUserId(userId);

      // sessionStorage 저장 시도 + DB 조회
      savePendingBirthInfo().then(() => {
        fetchBirthInfo();
      });
    } else if (!isSignedIn) {
      // 로그아웃 상태: 모든 상태 초기화
      sessionStorage.removeItem("pendingBirthDate");
      sessionStorage.removeItem("pendingBirthTime");
      resetBirthData();
      setBirthDate("");
      setBirthTime("");
      setLastUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId]);

  // 입력값 변경 시 sessionStorage에 임시 저장 (비로그인 상태에서만)
  useEffect(() => {
    if (!isSignedIn) {
      if (birthDate) {
        sessionStorage.setItem("pendingBirthDate", birthDate);
      }
      if (birthTime) {
        sessionStorage.setItem("pendingBirthTime", birthTime);
      }
    }
  }, [birthDate, birthTime, isSignedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      // 비로그인: sessionStorage에 저장 후 로그인 페이지로
      sessionStorage.setItem("pendingBirthDate", birthDate);
      sessionStorage.setItem("pendingBirthTime", birthTime);
      router.push("/sign-in");
      return;
    }

    // 로그인 상태: DB에 바로 저장
    if (birthTime.includes(":")) {
      const [hourStr, minuteStr] = birthTime.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (!isNaN(hour) && !isNaN(minute)) {
        try {
          await fetch("/api/user/birth-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              birthDate: birthDate,
              birthHour: hour,
              birthMinute: minute,
            }),
          });
        } catch (error) {
          console.error("Failed to save birth info:", error);
        }
      }
    }

    // 결제 페이지로 이동
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <label htmlFor="birthTime" className="block text-sm font-medium text-gray-700 mb-1">
              출생일시
            </label>
            <div className="relative">
              <input
                type="text"
                id="birthTime"
                value={birthTime}
                onChange={handleTimeChange}
                placeholder="00:00"
                maxLength={5}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={openTimePicker}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-lg"
                aria-label="시간 선택"
              >
                🕐
              </button>
              <input
                ref={timePickerRef}
                type="time"
                value={birthTime}
                onChange={handleTimePickerChange}
                className="sr-only"
                tabIndex={-1}
              />
            </div>
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
