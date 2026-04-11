import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { getKSTToday, isSameKSTDate } from "@/lib/date-utils";
import { generateSajuResult } from "@/lib/gemini";
import type { BirthInfo } from "@/lib/types";

/**
 * 다시 분석하기 API
 * - 하루 1회 제한
 * - 초기 생성 실패 후 재시도는 제한에 포함하지 않음
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const today = getKSTToday();

    // 1. 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, birth_date, birth_hour, birth_minute")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (userError || !userData) {
      console.error("[API] User fetch error:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!userData.birth_date || userData.birth_hour === null || userData.birth_minute === null) {
      return NextResponse.json({ error: "Birth info not found" }, { status: 404 });
    }

    // 2. 당일 결과 조회
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

    // 3. 재생성 횟수 확인
    if (savedResult && savedResult.last_regenerated_at) {
      const lastRegenerated = new Date(savedResult.last_regenerated_at);
      const isToday = isSameKSTDate(lastRegenerated, new Date());

      if (isToday && savedResult.regenerate_count >= 1) {
        return NextResponse.json(
          {
            error: "Daily regeneration limit reached",
            code: "LIMIT_REACHED",
            remainingCount: 0,
          },
          { status: 429 }
        );
      }
    }

    // 4. 새 결과 생성
    const birthInfo: BirthInfo = {
      birthDate: userData.birth_date,
      birthHour: userData.birth_hour,
      birthMinute: userData.birth_minute,
    };

    let geminiResult;
    try {
      geminiResult = await generateSajuResult(birthInfo);
    } catch (geminiError) {
      console.error("[API] Gemini regeneration failed:", geminiError);
      return NextResponse.json({ error: "Failed to regenerate result", code: "GENERATION_FAILED" }, { status: 500 });
    }

    // 5. 결과 저장 및 재생성 횟수 증가
    const newRegenerateCount = savedResult ? savedResult.regenerate_count + 1 : 1;
    const now = new Date().toISOString();

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
          generated_at: now,
          regenerate_count: newRegenerateCount,
          last_regenerated_at: now,
          updated_at: now,
        },
        {
          onConflict: "user_id,result_date",
        }
      );

    if (saveError) {
      console.error("[API] Result save error:", saveError);
      return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
    }

    return NextResponse.json({
      result: geminiResult,
      generatedAt: now,
      regenerateCount: newRegenerateCount,
      remainingCount: 1 - newRegenerateCount,
    });
  } catch (error) {
    console.error("[API] Saju regenerate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
