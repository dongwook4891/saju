import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { getCurrentUserEmail, getUserWithReconnect } from "@/lib/user-utils";

// 생년월일/출생일시 저장
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { birthDate, birthHour, birthMinute } = body;

    // 3개 값이 모두 있는지 확인
    if (!birthDate || birthHour === undefined || birthMinute === undefined) {
      return NextResponse.json(
        { error: "All fields (birthDate, birthHour, birthMinute) are required" },
        { status: 400 }
      );
    }

    // 값 검증
    const hour = parseInt(birthHour, 10);
    const minute = parseInt(birthMinute, 10);

    if (isNaN(hour) || hour < 0 || hour > 23) {
      return NextResponse.json(
        { error: "Invalid hour (0-23)" },
        { status: 400 }
      );
    }

    if (isNaN(minute) || minute < 0 || minute > 59) {
      return NextResponse.json(
        { error: "Invalid minute (0-59)" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const email = await getCurrentUserEmail(userId);

    if (!email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: existingByClerkId, error: findByClerkError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (findByClerkError) {
      console.error("[API] birth-info clerk_user_id 조회 실패:", findByClerkError);
      return NextResponse.json(
        { error: "Failed to find user info" },
        { status: 500 }
      );
    }

    if (existingByClerkId) {
      const { error } = await supabaseAdmin
        .from("users")
        .update({
          email,
          birth_date: birthDate,
          birth_hour: hour,
          birth_minute: minute,
          updated_at: now,
        })
        .eq("id", existingByClerkId.id);

      if (error) {
        console.error("[API] birth-info clerk_user_id update 실패:", error);
        return NextResponse.json(
          { error: "Failed to save birth info" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    const { data: existingByEmail, error: findByEmailError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (findByEmailError) {
      console.error("[API] birth-info email 조회 실패:", findByEmailError);
      return NextResponse.json(
        { error: "Failed to find user info" },
        { status: 500 }
      );
    }

    if (existingByEmail) {
      // 같은 이메일의 기존 row가 있으면 새 Clerk ID를 다시 연결해서 중복 이메일 충돌을 막는다.
      const { error } = await supabaseAdmin
        .from("users")
        .update({
          clerk_user_id: userId,
          email,
          birth_date: birthDate,
          birth_hour: hour,
          birth_minute: minute,
          status: "active", // 재가입 시 상태를 active로 복구
          updated_at: now,
        })
        .eq("id", existingByEmail.id);

      if (error) {
        console.error("[API] birth-info email reconnect 실패:", error);
        return NextResponse.json(
          { error: "Failed to save birth info" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, reconnectedByEmail: true });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .insert(
        {
          clerk_user_id: userId,
          email,
          birth_date: birthDate,
          birth_hour: hour,
          birth_minute: minute,
          status: "active",
          updated_at: now,
        }
      );

    if (error) {
      console.error("[API] birth-info INSERT 실패:", error);
      return NextResponse.json(
        { error: "Failed to save birth info" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] birth-info POST 예외:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 생년월일/출생일시 조회
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 현재 로그인 사용자의 정보 조회 - 이메일 fallback 지원
    let data;
    try {
      data = await getUserWithReconnect(userId, {
        select: "id, clerk_user_id, birth_date, birth_hour, birth_minute",
      });
    } catch (error) {
      console.error("[API] birth-info GET 실패:", error);
      return NextResponse.json(
        { error: "Failed to fetch birth info" },
        { status: 500 }
      );
    }

    // 데이터가 없거나 값이 null이면 빈 객체 반환
    if (!data || !data.birth_date || data.birth_hour === null || data.birth_minute === null) {
      return NextResponse.json({ birthDate: null, birthHour: null, birthMinute: null });
    }

    return NextResponse.json({
      birthDate: data.birth_date,
      birthHour: data.birth_hour,
      birthMinute: data.birth_minute,
    });
  } catch (error) {
    console.error("[API] birth-info GET 예외:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
