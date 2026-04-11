import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * 채팅 메시지 조회 API
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

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

    // 2. 채팅방 권한 확인
    const { data: roomData, error: roomError } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("user_id", userData.id)
      .maybeSingle();

    if (roomError || !roomData) {
      console.error("[API] Room fetch error:", roomError);
      return NextResponse.json({ error: "Room not found or access denied" }, { status: 404 });
    }

    // 3. 메시지 조회 (시간순 정렬)
    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_room_id", roomId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("[API] Messages fetch error:", messagesError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        chatRoomId: msg.chat_room_id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
      })),
    });
  } catch (error) {
    console.error("[API] Chat messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
