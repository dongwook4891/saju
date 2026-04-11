"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SajuFullResult } from "@/lib/types";

type LoadingState = "loading" | "ready" | "error" | "empty_profile" | "invalid_profile";

interface ResultResponse {
  result: SajuFullResult;
  generatedAt: string;
  isFromCache: boolean;
  warning?: string;
}

export default function ResultPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [result, setResult] = useState<SajuFullResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // 결과 조회
  const fetchResult = async () => {
    try {
      setLoadingState("loading");
      const response = await fetch("/api/saju/result");

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.code === "USER_NOT_FOUND" || errorData.code === "EMPTY_PROFILE") {
          setLoadingState("empty_profile");
          return;
        }

        if (errorData.code === "INVALID_PROFILE") {
          setLoadingState("invalid_profile");
          return;
        }

        if (errorData.code === "GENERATION_FAILED") {
          setLoadingState("error");
          setErrorMessage("결과 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }

        throw new Error(errorData.error || "Failed to fetch result");
      }

      const data: ResultResponse = await response.json();
      setResult(data.result);
      setGeneratedAt(data.generatedAt);
      setIsFromCache(data.isFromCache);
      setLoadingState("ready");

      if (data.warning) {
        console.warn(data.warning);
      }
    } catch (error) {
      console.error("Failed to fetch result:", error);
      setLoadingState("error");
      setErrorMessage("결과를 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 다시 분석하기
  const handleRegenerate = async () => {
    if (isRegenerating) return;

    const confirmed = confirm("다시 분석하기는 하루 1회만 가능합니다. 계속하시겠습니까?");
    if (!confirmed) return;

    try {
      setIsRegenerating(true);
      const response = await fetch("/api/saju/regenerate", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.code === "LIMIT_REACHED") {
          alert("오늘 이미 다시 분석하기를 사용하셨습니다. 내일 다시 시도해주세요.");
          return;
        }

        throw new Error(errorData.error || "Failed to regenerate");
      }

      const data: ResultResponse = await response.json();
      setResult(data.result);
      setGeneratedAt(data.generatedAt);
      setIsFromCache(false);
      alert("새로운 결과가 생성되었습니다!");
    } catch (error) {
      console.error("Failed to regenerate:", error);
      alert("다시 분석하기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // 질문하기
  const handleGoToChat = () => {
    router.push("/chat");
  };

  // 로그인 확인 및 결과 조회
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    fetchResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router]);

  // 사주정보 없음 - 입력 화면으로 이동
  useEffect(() => {
    if (loadingState === "empty_profile") {
      alert("사주 정보가 없습니다. 먼저 정보를 입력해주세요.");
      router.replace("/");
    }
  }, [loadingState, router]);

  // 사주정보 형식 오류 - 입력 화면으로 이동 (수정용)
  useEffect(() => {
    if (loadingState === "invalid_profile") {
      alert("사주 정보 형식이 올바르지 않습니다. 다시 입력해주세요.");
      router.replace("/");
    }
  }, [loadingState, router]);

  // 로딩 중
  if (!isLoaded || loadingState === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-4xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">사주 분석 중</h1>
            <p className="text-gray-500">잠시만 기다려주세요...</p>
          </div>

          {/* 스켈레톤 UI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // 오류 상태
  if (loadingState === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">오류 발생</h1>
            <p className="text-gray-500">{errorMessage}</p>
          </div>
          <button
            onClick={fetchResult}
            className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  // 결과 표시
  if (loadingState === "ready" && result) {
    const periods = [
      { key: "today", title: "오늘", data: result.today },
      { key: "tomorrow", title: "내일", data: result.tomorrow },
      { key: "month", title: "이번 달", data: result.month },
      { key: "year", title: "올해", data: result.year },
    ];

    return (
      <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4 py-8">
        <div className="w-full max-w-4xl space-y-6">
          {/* 헤더 */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">사주 운세</h1>
            <p className="text-gray-500 text-sm">
              {new Date(generatedAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {isFromCache && " (저장된 결과)"}
            </p>
          </div>

          {/* 결과 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periods.map((period) => (
              <div
                key={period.key}
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4"
              >
                <h2 className="text-xl font-bold text-gray-900">{period.title}</h2>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">총평</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{period.data.summary}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">주의점</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{period.data.caution}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">한 줄 조언</h3>
                    <p className="text-gray-600 text-sm font-medium">{period.data.oneLineTip}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGoToChat}
              className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              질문하기
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? "분석 중..." : "다시 분석하기"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
