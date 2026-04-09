import { getSupabaseAdmin } from "@/lib/supabase";

export type UserStatus = "active" | "withdrawn" | "blocked" | "not_found";

export async function getUserStatus(clerkUserId: string): Promise<UserStatus> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("status")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error || !data) {
    // 작업 4(Webhook)가 완료되기 전에는 Supabase에 row가 없을 수 있음 → 통과 처리
    return "not_found";
  }

  return data.status as UserStatus;
}
