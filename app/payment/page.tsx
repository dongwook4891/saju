import { auth } from "@clerk/nextjs/server";
import { getUserStatus } from "@/lib/auth/get-user-status";
import { redirect } from "next/navigation";

export default async function PaymentPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const status = await getUserStatus(userId);

  if (status === "blocked") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-red-600">이용이 제한된 계정입니다</h1>
        <p className="text-gray-600">고객센터로 문의해주세요.</p>
      </main>
    );
  }

  if (status === "withdrawn") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-700">탈퇴한 계정입니다</h1>
        <p className="text-gray-600">재가입을 원하신다면 회원가입을 진행해주세요.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-gray-900">결제</h1>
      <p className="text-gray-500">로그인한 사용자만 볼 수 있는 페이지입니다.</p>
    </main>
  );
}
