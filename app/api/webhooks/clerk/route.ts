import { headers } from "next/headers";
import { Webhook } from "svix";
import {
  handleUserCreated,
  handleUserUpdated,
  handleUserDeleted,
} from "@/lib/auth/sync-clerk-user";

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook] CLERK_WEBHOOK_SECRET 환경변수 없음");
    return new Response("서버 설정 오류", { status: 500 });
  }

  // Svix 서명 검증에 필요한 헤더 추출
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[Webhook] Svix 헤더 없음 - 위조 요청 의심");
    return new Response("잘못된 요청", { status: 400 });
  }

  const body = await req.text();

  // 서명 검증
  let event: { type: string; data: Record<string, unknown>; timestamp?: number };
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    console.warn("[Webhook] 서명 검증 실패");
    return new Response("서명 검증 실패", { status: 401 });
  }

  // 이벤트 발생 시각 (순서 꼬임 방지용)
  const eventAt = event.timestamp
    ? new Date(event.timestamp * 1000)
    : new Date();

  // 이벤트 타입별 처리
  switch (event.type) {
    case "user.created":
      await handleUserCreated(
        event.data as unknown as Parameters<typeof handleUserCreated>[0],
        eventAt
      );
      break;

    case "user.updated":
      await handleUserUpdated(
        event.data as unknown as Parameters<typeof handleUserUpdated>[0],
        eventAt
      );
      break;

    case "user.deleted":
      await handleUserDeleted(
        (event.data as { id: string }).id,
        eventAt
      );
      break;

    default:
      // 구독하지 않은 이벤트는 조용히 200 반환
      break;
  }

  return new Response("OK", { status: 200 });
}
