import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { generateChatResponse } from "@/lib/gemini";
import { getUserWithReconnect } from "@/lib/user-utils";
import type { SajuFullResult } from "@/lib/types";

/**
 * 채팅 메시지 전송 API
 * - 사용자 메시지 저장
 * - AI 답변 생성 및 저장
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, message } = body;

    if (!roomId || !message) {
      return NextResponse.json({ error: "roomId and message are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. 사용자 정보 조회 - 이메일 fallback 지원
    let userData;
    try {
      userData = await getUserWithReconnect(userId, { select: "id" });
    } catch (userError) {
      console.error("[API] User fetch error:", userError);
      return NextResponse.json({ error: "Failed to fetch user info" }, { status: 500 });
    }

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. 채팅방 및 사주 결과 조회
    const { data: roomData, error: roomError } = await supabase
      .from("chat_rooms")
      .select("id, saju_result_id")
      .eq("id", roomId)
      .eq("user_id", userData.id)
      .maybeSingle();

    if (roomError || !roomData) {
      console.error("[API] Room fetch error:", roomError);
      return NextResponse.json({ error: "Room not found or access denied" }, { status: 404 });
    }

    // 3. 사주 결과 조회 (AI 답변 컨텍스트용)
    const { data: resultData, error: resultError } = await supabase
      .from("saju_results")
      .select("*")
      .eq("id", roomData.saju_result_id)
      .maybeSingle();

    if (resultError || !resultData) {
      console.error("[API] Result fetch error:", resultError);
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // 4. 기존 채팅 히스토리 조회
    const { data: historyData, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_room_id", roomId)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("[API] History fetch error:", historyError);
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }

    const chatHistory = historyData || [];

    // 5. 사주 결과 컨텍스트 구성
    const sajuContext: SajuFullResult = {
      today: {
        summary: resultData.today_summary,
        caution: resultData.today_caution,
        oneLineTip: resultData.today_tip,
      },
      tomorrow: {
        summary: resultData.tomorrow_summary,
        caution: resultData.tomorrow_caution,
        oneLineTip: resultData.tomorrow_tip,
      },
      month: {
        summary: resultData.month_summary,
        caution: resultData.month_caution,
        oneLineTip: resultData.month_tip,
      },
      year: {
        summary: resultData.year_summary,
        caution: resultData.year_caution,
        oneLineTip: resultData.year_tip,
      },
    };

    // 6. 사용자 메시지 저장
    const { data: userMessage, error: userMsgError } = await supabase
      .from("chat_messages")
      .insert({
        chat_room_id: roomId,
        role: "user",
        content: message,
      })
      .select()
      .single();

    if (userMsgError || !userMessage) {
      console.error("[API] User message save error:", userMsgError);
      return NextResponse.json({ error: "Failed to save user message" }, { status: 500 });
    }

    // 7. AI 답변 생성
    let aiResponse;
    try {
      aiResponse = await generateChatResponse(sajuContext, chatHistory, message);
    } catch (aiError) {
      console.error("[API] AI response generation failed:", aiError);

      // AI 생성 실패 시 사용자 메시지 롤백
      await supabase
        .from("chat_messages")
        .delete()
        .eq("id", userMessage.id);

      return NextResponse.json({ error: "Failed to generate AI response", code: "AI_FAILED" }, { status: 500 });
    }

    // 8. AI 메시지 저장
    const { data: aiMessage, error: aiMsgError } = await supabase
      .from("chat_messages")
      .insert({
        chat_room_id: roomId,
        role: "assistant",
        content: aiResponse,
      })
      .select()
      .single();

    if (aiMsgError || !aiMessage) {
      console.error("[API] AI message save error:", aiMsgError);

      // AI 메시지 저장 실패 시 사용자 메시지 롤백
      await supabase
        .from("chat_messages")
        .delete()
        .eq("id", userMessage.id);

      return NextResponse.json({ error: "Failed to save AI message" }, { status: 500 });
    }

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        chatRoomId: userMessage.chat_room_id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.created_at,
      },
      aiMessage: {
        id: aiMessage.id,
        chatRoomId: aiMessage.chat_room_id,
        role: aiMessage.role,
        content: aiMessage.content,
        createdAt: aiMessage.created_at,
      },
    });
  } catch (error) {
    console.error("[API] Chat send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
