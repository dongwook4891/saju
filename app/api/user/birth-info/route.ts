import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

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

    // Clerk에서 이메일 가져오기
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // UPSERT: row가 없으면 INSERT, 있으면 UPDATE
    const { error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          clerk_user_id: userId,
          email: email,
          birth_date: birthDate,
          birth_hour: hour,
          birth_minute: minute,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clerk_user_id",
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error("[API] birth-info UPSERT 실패:", error);
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

    const supabaseAdmin = getSupabaseAdmin();

    // 현재 로그인 사용자의 정보 조회
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("birth_date, birth_hour, birth_minute")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (error) {
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
