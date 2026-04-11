"use client";

import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useInput } from "./contexts/InputContext";

const PENDING_BIRTH_DATE_KEY = "pendingBirthDate";
const PENDING_BIRTH_TIME_KEY = "pendingBirthTime";
const POST_AUTH_REDIRECT_KEY = "postAuthRedirect";
const PAYMENT_REDIRECT_PATH = "/payment-temp";

export default function Home() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const { birthData, setBirthData, resetBirthData } = useInput();

  const [birthDate, setBirthDate] = useState(birthData.birthDate);
  const [birthTime, setBirthTime] = useState(birthData.birthTime);
  const [birthDateError, setBirthDateError] = useState("");
  const [birthTimeError, setBirthTimeError] = useState("");
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const timePickerRef = useRef<HTMLInputElement>(null);

  // 오늘 날짜 (YYYY-MM-DD 형식)
  const today = new Date().toISOString().split('T')[0];

  // 생년월일 검증 함수
  const validateBirthDate = (value: string): string => {
    if (!value) {
      return "생년월일을 입력해주세요.";
    }

    // 형식 검증 (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(value)) {
      return "생년월일 형식을 다시 확인해주세요.";
    }

    // 존재하는 날짜인지 검증
    const inputDate = new Date(value);
    if (isNaN(inputDate.getTime())) {
      return "실제 존재하는 날짜를 입력해주세요.";
    }

    // 입력한 날짜와 Date 객체로 변환한 날짜가 일치하는지 확인 (예: 2023-02-30 같은 존재하지 않는 날짜)
    const [year, month, day] = value.split('-').map(Number);
    if (
      inputDate.getFullYear() !== year ||
      inputDate.getMonth() !== month - 1 ||
      inputDate.getDate() !== day
    ) {
      return "실제 존재하는 날짜를 입력해주세요.";
    }

    // 미래 날짜 검증
    const todayDate = new Date(today);
    if (inputDate > todayDate) {
      return "실제 존재하는 날짜를 입력해주세요.";
    }

    return "";
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBirthDate(value);
    // 입력 중에는 에러 클리어만
    setBirthDateError("");
  };

  const handleBirthDateBlur = () => {
    const error = validateBirthDate(birthDate);
    setBirthDateError(error);
  };

  // 출생일시 검증 함수
  const validateBirthTime = (value: string): string => {
    if (!value) {
      return "출생일시를 입력해주세요.";
    }

    // 숫자와 콜론만 허용 (HH:MM 형식)
    const allowedPattern = /^[\d:]*$/;
    if (!allowedPattern.test(value)) {
      return "출생일시는 숫자로만 입력해주세요.";
    }

    // 형식 검증 (HH:MM)
    const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timePattern.test(value)) {
      return "출생일시는 00:00~23:59 형식으로 입력해주세요.";
    }

    // 범위 검증 (이미 timePattern에서 검증되지만 명시적으로)
    const [hourStr, minuteStr] = value.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return "출생일시는 00:00부터 23:59 사이로 입력해주세요.";
    }

    return "";
  };

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
    // 입력 중에는 에러 클리어만
    setBirthTimeError("");
  };

  const handleTimePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthTime(e.target.value);
    setBirthTimeError("");
  };

  const handleBirthTimeBlur = () => {
    const error = validateBirthTime(birthTime);
    setBirthTimeError(error);
  };

  const openTimePicker = () => {
    timePickerRef.current?.showPicker();
  };

  const savePendingInputsToSession = (date: string, time: string) => {
    if (date) {
      sessionStorage.setItem(PENDING_BIRTH_DATE_KEY, date);
    } else {
      sessionStorage.removeItem(PENDING_BIRTH_DATE_KEY);
    }

    if (time) {
      sessionStorage.setItem(PENDING_BIRTH_TIME_KEY, time);
    } else {
      sessionStorage.removeItem(PENDING_BIRTH_TIME_KEY);
    }
  };

  const prepareAuthRedirect = () => {
    savePendingInputsToSession(birthDate, birthTime);

    // 두 필드 모두 유효할 때만 결제 페이지로 리다이렉트
    if (!validateBirthDate(birthDate) && !validateBirthTime(birthTime)) {
      sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, PAYMENT_REDIRECT_PATH);
    } else {
      sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    }
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
          setBirthData({ birthDate: data.birthDate, birthTime: formattedTime });
        }
      }
    } catch (error) {
      console.error("Failed to fetch birth info:", error);
    }
  };

  // sessionStorage의 임시 입력값을 DB에 저장
  const savePendingBirthInfo = async () => {
    try {
      const pendingDate = sessionStorage.getItem(PENDING_BIRTH_DATE_KEY);
      const pendingTime = sessionStorage.getItem(PENDING_BIRTH_TIME_KEY);

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
            sessionStorage.removeItem(PENDING_BIRTH_DATE_KEY);
            sessionStorage.removeItem(PENDING_BIRTH_TIME_KEY);
            setBirthData({ birthDate: pendingDate, birthTime: pendingTime });
            return true;
          }

          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to save pending birth info:", error);
      return false;
    }
  };

  // 로그인 상태 변경 감지 및 처리
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isSignedIn && userId) {
      // 로그인 상태

      // 사용자가 바뀌었는지 확인
      if (lastUserId && lastUserId !== userId) {
        // 다른 사용자로 로그인: 이전 값 완전히 초기화
        sessionStorage.removeItem(PENDING_BIRTH_DATE_KEY);
        sessionStorage.removeItem(PENDING_BIRTH_TIME_KEY);
        sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
        resetBirthData();
        setBirthDate("");
        setBirthTime("");
      }

      setLastUserId(userId);

      // sessionStorage 저장 시도 + DB 조회
      const shouldRedirectToPayment =
        sessionStorage.getItem(POST_AUTH_REDIRECT_KEY) === PAYMENT_REDIRECT_PATH;

      savePendingBirthInfo().then((isSaved) => {
        fetchBirthInfo().then(() => {
          if (shouldRedirectToPayment && isSaved) {
            sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
            router.replace(PAYMENT_REDIRECT_PATH);
          }
        });
      });
    } else if (!isSignedIn) {
      // 로그아웃 상태: 모든 상태 초기화
      sessionStorage.removeItem(PENDING_BIRTH_DATE_KEY);
      sessionStorage.removeItem(PENDING_BIRTH_TIME_KEY);
      sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
      resetBirthData();
      setBirthDate("");
      setBirthTime("");
      setLastUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router, userId]);

  // 입력값 변경 시 sessionStorage에 임시 저장 (비로그인 상태에서만)
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      savePendingInputsToSession(birthDate, birthTime);
    }
  }, [birthDate, birthTime, isLoaded, isSignedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 입력값 검증
    const dateError = validateBirthDate(birthDate);
    const timeError = validateBirthTime(birthTime);

    setBirthDateError(dateError);
    setBirthTimeError(timeError);

    // 하나라도 에러가 있으면 진행 차단
    if (dateError || timeError) {
      return;
    }

    // 상태 저장
    setBirthData({ birthDate, birthTime });

    // 로그인 상태 확인
    if (!isSignedIn) {
      // 비로그인: sessionStorage에 저장 후 로그인 페이지로
      savePendingInputsToSession(birthDate, birthTime);
      sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, PAYMENT_REDIRECT_PATH);
      router.push("/sign-in");
      return;
    }

    // 로그인 상태: DB에 바로 저장
    const [hourStr, minuteStr] = birthTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    try {
      const response = await fetch("/api/user/birth-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate: birthDate,
          birthHour: hour,
          birthMinute: minute,
        }),
      });

      if (!response.ok) {
        setBirthTimeError("저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
    } catch (error) {
      console.error("Failed to save birth info:", error);
      setBirthTimeError("저장에 실패했습니다. 다시 시도해주세요.");
      return;
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
              <button
                onClick={prepareAuthRedirect}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                로그인
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button
                onClick={prepareAuthRedirect}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
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
              max={today}
              onChange={handleBirthDateChange}
              onBlur={handleBirthDateBlur}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 placeholder:text-gray-500 ${
                birthDateError
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-black"
              }`}
            />
            {birthDateError && (
              <p className="mt-1 text-sm text-red-600">{birthDateError}</p>
            )}
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
                onBlur={handleBirthTimeBlur}
                placeholder="00:00"
                maxLength={5}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 placeholder:text-gray-500 ${
                  birthTimeError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-black"
                }`}
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
            {birthTimeError && (
              <p className="mt-1 text-sm text-red-600">{birthTimeError}</p>
            )}
          </div>

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
