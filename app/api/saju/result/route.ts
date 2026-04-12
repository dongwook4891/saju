import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { getKSTToday } from "@/lib/date-utils";
import { generateSajuResult } from "@/lib/gemini";
import { getUserWithReconnect } from "@/lib/user-utils";
import type { BirthInfo } from "@/lib/types";

/**
 * 사주 결과 조회 API
 * - 당일 저장 결과가 있으면 반환
 * - 없거나 사주정보가 수정되었으면 새로 생성
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const today = getKSTToday();

    // 1. 사용자 정보 조회 (사주정보 포함) - 이메일 fallback 지원
    let userData;
    try {
      userData = await getUserWithReconnect(userId, {
        select: "id, birth_date, birth_hour, birth_minute, profile_updated_at",
      });
    } catch (userError) {
      console.error("[API] User fetch error:", userError);
      return NextResponse.json({ error: "Failed to fetch user info" }, { status: 500 });
    }

    // 2. 사주정보 검증
    if (!userData) {
      return NextResponse.json({ error: "User not found", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    if (!userData.birth_date || userData.birth_hour === null || userData.birth_minute === null) {
      return NextResponse.json({ error: "Birth info not found", code: "EMPTY_PROFILE" }, { status: 404 });
    }

    // 3. 생년월일 형식 검증
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(userData.birth_date)) {
      return NextResponse.json({ error: "Invalid birth date format", code: "INVALID_PROFILE" }, { status: 400 });
    }

    // 4. 출생시간 범위 검증
    if (userData.birth_hour < 0 || userData.birth_hour > 23 || userData.birth_minute < 0 || userData.birth_minute > 59) {
      return NextResponse.json({ error: "Invalid birth time", code: "INVALID_PROFILE" }, { status: 400 });
    }

    // 5. 당일 저장 결과 조회
    const { data: savedResult, error: resultError } = await supabase
      .from("saju_results")
      .select("*")
      .eq("user_id", userData.id)
      .eq("result_date", today)
      .maybeSingle();

    if (resultError && resultError.code !== "PGRST116") {
      console.error("[API] Result fetch error:", resultError);
      return NextResponse.json({ error: "Failed to fetch result" }, { status: 500 });
    }

    // 6. 저장 결과가 있고, 사주정보 수정 이후가 아니면 재사용
    if (savedResult) {
      const profileUpdatedAt = new Date(userData.profile_updated_at || 0);
      const resultGeneratedAt = new Date(savedResult.generated_at);

      if (profileUpdatedAt <= resultGeneratedAt) {
        // 저장 결과 재사용
        return NextResponse.json({
          result: {
            today: {
              summary: savedResult.today_summary,
              caution: savedResult.today_caution,
              oneLineTip: savedResult.today_tip,
            },
            tomorrow: {
              summary: savedResult.tomorrow_summary,
              caution: savedResult.tomorrow_caution,
              oneLineTip: savedResult.tomorrow_tip,
            },
            month: {
              summary: savedResult.month_summary,
              caution: savedResult.month_caution,
              oneLineTip: savedResult.month_tip,
            },
            year: {
              summary: savedResult.year_summary,
              caution: savedResult.year_caution,
              oneLineTip: savedResult.year_tip,
            },
          },
          generatedAt: savedResult.generated_at,
          isFromCache: true,
        });
      }
    }

    // 7. 새 결과 생성
    const birthInfo: BirthInfo = {
      birthDate: userData.birth_date,
      birthHour: userData.birth_hour,
      birthMinute: userData.birth_minute,
    };

    let geminiResult;
    try {
      geminiResult = await generateSajuResult(birthInfo);
    } catch (geminiError) {
      console.error("[API] Gemini generation failed:", geminiError);

      // Gemini 실패 시 기존 결과가 있으면 반환
      if (savedResult) {
        return NextResponse.json({
          result: {
            today: {
              summary: savedResult.today_summary,
              caution: savedResult.today_caution,
              oneLineTip: savedResult.today_tip,
            },
            tomorrow: {
              summary: savedResult.tomorrow_summary,
              caution: savedResult.tomorrow_caution,
              oneLineTip: savedResult.tomorrow_tip,
            },
            month: {
              summary: savedResult.month_summary,
              caution: savedResult.month_caution,
              oneLineTip: savedResult.month_tip,
            },
            year: {
              summary: savedResult.year_summary,
              caution: savedResult.year_caution,
              oneLineTip: savedResult.year_tip,
            },
          },
          generatedAt: savedResult.generated_at,
          isFromCache: true,
          warning: "Failed to generate new result, showing cached result",
        });
      }

      return NextResponse.json({ error: "Failed to generate result", code: "GENERATION_FAILED" }, { status: 500 });
    }

    // 8. 결과 저장 (UPSERT)
    const { error: saveError } = await supabase
      .from("saju_results")
      .upsert(
        {
          user_id: userData.id,
          result_date: today,
          today_summary: geminiResult.today.summary,
          today_caution: geminiResult.today.caution,
          today_tip: geminiResult.today.oneLineTip,
          tomorrow_summary: geminiResult.tomorrow.summary,
          tomorrow_caution: geminiResult.tomorrow.caution,
          tomorrow_tip: geminiResult.tomorrow.oneLineTip,
          month_summary: geminiResult.month.summary,
          month_caution: geminiResult.month.caution,
          month_tip: geminiResult.month.oneLineTip,
          year_summary: geminiResult.year.summary,
          year_caution: geminiResult.year.caution,
          year_tip: geminiResult.year.oneLineTip,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,result_date",
        }
      );

    if (saveError) {
      console.error("[API] Result save error:", saveError);
      return NextResponse.json({ error: "Failed to save result", code: "SAVE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({
      result: geminiResult,
      generatedAt: new Date().toISOString(),
      isFromCache: false,
    });
  } catch (error) {
    console.error("[API] Saju result error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
