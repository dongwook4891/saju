import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Clerk에서 현재 사용자의 이메일 조회
 */
export async function getCurrentUserEmail(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    null
  );
}

interface GetUserOptions {
  select?: string;
}

/**
 * 사용자 조회 with 이메일 fallback & 재연결
 *
 * 1. clerk_user_id로 조회
 * 2. 없으면 이메일로 조회
 * 3. 이메일 매치가 있으면 clerk_user_id 재연결
 *
 * @param userId - Clerk user ID
 * @param options.select - Supabase select 필드 (기본값: "id")
 * @returns 사용자 데이터 또는 null
 */
export async function getUserWithReconnect<T = any>(
  userId: string,
  options: GetUserOptions = {}
): Promise<T | null> {
  const supabase = getSupabaseAdmin();
  const selectFields = options.select || "id";

  // 1. clerk_user_id로 조회
  let { data, error } = await supabase
    .from("users")
    .select(selectFields)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // 2. 없으면 이메일로 조회
  if (!data) {
    const email = await getCurrentUserEmail(userId);

    if (email) {
      const { data: emailMatchedUser, error: emailMatchError } = await supabase
        .from("users")
        .select(selectFields)
        .eq("email", email)
        .maybeSingle();

      if (emailMatchError) {
        throw emailMatchError;
      }

      if (emailMatchedUser) {
        data = emailMatchedUser;

        // 3. clerk_user_id가 다르면 재연결
        if ((emailMatchedUser as any).clerk_user_id !== userId) {
          const { error: reconnectError } = await supabase
            .from("users")
            .update({
              clerk_user_id: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (emailMatchedUser as any).id);

          if (reconnectError) {
            console.error("[getUserWithReconnect] Reconnect failed:", reconnectError);
          }
        }
      }
    }
  }

  return data as T | null;
}
