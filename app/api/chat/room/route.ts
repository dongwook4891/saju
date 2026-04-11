import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { getKSTToday } from "@/lib/date-utils";

/**
 * 채팅방 조회/생성 API
 * - 당일 result 결과가 있는지 먼저 확인
 * - 하루 1개 채팅방 유지
 */
export async function GET() {
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
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (userError || !userData) {
      console.error("[API] User fetch error:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. 당일 result 결과 확인
    const { data: resultData, error: resultError } = await supabase
      .from("saju_results")
      .select("id")
      .eq("user_id", userData.id)
      .eq("result_date", today)
      .maybeSingle();

    if (resultError && resultError.code !== "PGRST116") {
      console.error("[API] Result fetch error:", resultError);
      return NextResponse.json({ error: "Failed to fetch result" }, { status: 500 });
    }

    if (!resultData) {
      return NextResponse.json(
        { error: "No result found for today", code: "NO_RESULT" },
        { status: 404 }
      );
    }

    // 3. 당일 채팅방 조회
    const { data: roomData, error: roomError } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("user_id", userData.id)
      .eq("room_date", today)
      .maybeSingle();

    if (roomError && roomError.code !== "PGRST116") {
      console.error("[API] Room fetch error:", roomError);
      return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
    }

    // 4. 채팅방이 있으면 반환
    if (roomData) {
      return NextResponse.json({
        room: {
          id: roomData.id,
          userId: roomData.user_id,
          roomDate: roomData.room_date,
          sajuResultId: roomData.saju_result_id,
          createdAt: roomData.created_at,
        },
        isNew: false,
      });
    }

    // 5. 채팅방 없으면 생성
    const { data: newRoom, error: createError } = await supabase
      .from("chat_rooms")
      .insert({
        user_id: userData.id,
        room_date: today,
        saju_result_id: resultData.id,
      })
      .select()
      .single();

    if (createError || !newRoom) {
      console.error("[API] Room creation error:", createError);
      return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
    }

    return NextResponse.json({
      room: {
        id: newRoom.id,
        userId: newRoom.user_id,
        roomDate: newRoom.room_date,
        sajuResultId: newRoom.saju_result_id,
        createdAt: newRoom.created_at,
      },
      isNew: true,
    });
  } catch (error) {
    console.error("[API] Chat room error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
