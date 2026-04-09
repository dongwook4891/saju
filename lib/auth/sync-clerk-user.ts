import { getSupabaseAdmin } from "@/lib/supabase";

// Clerk Webhook payload에서 공통으로 쓰는 타입 정의
interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification: { status: string } | null;
}

interface ClerkExternalAccount {
  provider: string;
}

interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  external_accounts: ClerkExternalAccount[];
  first_name: string | null;
  last_name: string | null;
}

// Clerk payload에서 primary email 추출
function extractEmail(payload: ClerkUserPayload): string | null {
  // primary email 우선
  if (payload.primary_email_address_id) {
    const primary = payload.email_addresses.find(
      (e) => e.id === payload.primary_email_address_id
    );
    if (primary) return primary.email_address;
  }
  // primary 없으면 첫 번째 verified email
  const verified = payload.email_addresses.find(
    (e) => e.verification?.status === "verified"
  );
  return verified?.email_address ?? null;
}

// Clerk payload에서 auth_provider 추출 (Google 연결 여부 기준)
function extractAuthProvider(payload: ClerkUserPayload): string {
  const hasGoogle = payload.external_accounts.some((a) =>
    a.provider.includes("google")
  );
  return hasGoogle ? "google" : "email";
}

// Clerk payload에서 이름 추출
function extractName(payload: ClerkUserPayload): string | null {
  const parts = [payload.first_name, payload.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

// ─── user.created 처리 ───────────────────────────────────────────────────────
export async function handleUserCreated(
  payload: ClerkUserPayload,
  eventAt: Date
) {
  const supabaseAdmin = getSupabaseAdmin();
  const email = extractEmail(payload);
  if (!email) {
    console.error("[Webhook] user.created: 이메일 없음, 처리 중단", {
      clerkUserId: payload.id,
    });
    return;
  }

  const authProvider = extractAuthProvider(payload);
  const name = extractName(payload);

  // 같은 이메일의 기존 row 조회
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, status, last_clerk_event_at")
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    // 신규 가입: row 생성
    const { error } = await supabaseAdmin.from("users").insert({
      clerk_user_id: payload.id,
      email,
      auth_provider: authProvider,
      name,
      status: "active",
      last_clerk_event_at: eventAt.toISOString(),
    });
    if (error) console.error("[Webhook] user.created insert 실패", error);
    else console.log("[Webhook] user.created: 신규 row 생성", { email });
    return;
  }

  if (existing.status === "withdrawn") {
    // 탈퇴 후 재가입: 기존 row 재사용
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        clerk_user_id: payload.id,
        email,
        auth_provider: authProvider,
        name,
        status: "active",
        updated_at: new Date().toISOString(),
        last_clerk_event_at: eventAt.toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.error("[Webhook] user.created 재가입 update 실패", error);
    else console.log("[Webhook] user.created: 탈퇴 계정 재가입 처리", { email });
    return;
  }

  // active 또는 blocked: 이메일 중복 → row 생성 금지, 로그만 남김
  console.error(
    "[Webhook] user.created: 이미 존재하는 이메일 (중복 가입 시도)",
    { email, existingStatus: existing.status, newClerkUserId: payload.id }
  );
}

// ─── user.updated 처리 ───────────────────────────────────────────────────────
export async function handleUserUpdated(
  payload: ClerkUserPayload,
  eventAt: Date
) {
  const supabaseAdmin = getSupabaseAdmin();
  const email = extractEmail(payload);
  if (!email) {
    console.error("[Webhook] user.updated: 이메일 없음, 처리 중단", {
      clerkUserId: payload.id,
    });
    return;
  }

  const authProvider = extractAuthProvider(payload);
  const name = extractName(payload);

  // clerk_user_id 또는 email로 기존 row 조회
  let { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, last_clerk_event_at")
    .eq("clerk_user_id", payload.id)
    .maybeSingle();

  if (!existing) {
    // clerk_user_id로 못 찾으면 email로 재시도
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, last_clerk_event_at")
      .eq("email", email)
      .maybeSingle();
    existing = data;
  }

  if (!existing) {
    // user.created 누락 대비: 보수적으로 신규 생성
    const { error } = await supabaseAdmin.from("users").insert({
      clerk_user_id: payload.id,
      email,
      auth_provider: authProvider,
      name,
      status: "active",
      last_clerk_event_at: eventAt.toISOString(),
    });
    if (error) console.error("[Webhook] user.updated fallback insert 실패", error);
    else console.log("[Webhook] user.updated: row 없어 신규 생성", { email });
    return;
  }

  // 이벤트 순서 꼬임 방지: 오래된 이벤트는 무시
  if (
    existing.last_clerk_event_at &&
    new Date(existing.last_clerk_event_at) > eventAt
  ) {
    console.log("[Webhook] user.updated: 오래된 이벤트 무시", {
      email,
      existingAt: existing.last_clerk_event_at,
      incomingAt: eventAt.toISOString(),
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      email,
      auth_provider: authProvider,
      name,
      updated_at: new Date().toISOString(),
      last_clerk_event_at: eventAt.toISOString(),
    })
    .eq("id", existing.id);

  if (error) console.error("[Webhook] user.updated update 실패", error);
  else console.log("[Webhook] user.updated: 갱신 완료", { email });
}

// ─── user.deleted 처리 ───────────────────────────────────────────────────────
export async function handleUserDeleted(
  clerkUserId: string,
  eventAt: Date
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, last_clerk_event_at")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (!existing) {
    console.log("[Webhook] user.deleted: 해당 clerk_user_id row 없음, 무시", {
      clerkUserId,
    });
    return;
  }

  // 이벤트 순서 꼬임 방지
  if (
    existing.last_clerk_event_at &&
    new Date(existing.last_clerk_event_at) > eventAt
  ) {
    console.log("[Webhook] user.deleted: 오래된 이벤트 무시", {
      clerkUserId,
      existingAt: existing.last_clerk_event_at,
      incomingAt: eventAt.toISOString(),
    });
    return;
  }

  // row 삭제하지 않고 withdrawn으로 변경, clerk_user_id는 NULL
  const { error } = await supabaseAdmin
    .from("users")
    .update({
      status: "withdrawn",
      clerk_user_id: null,
      updated_at: new Date().toISOString(),
      last_clerk_event_at: eventAt.toISOString(),
    })
    .eq("id", existing.id);

  if (error) console.error("[Webhook] user.deleted update 실패", error);
  else console.log("[Webhook] user.deleted: withdrawn 처리 완료", { clerkUserId });
}
