"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

type LoadingState = "loading" | "ready" | "error" | "no_result";

interface ChatRoom {
  id: string;
  userId: string;
  roomDate: string;
  sajuResultId: string;
  createdAt: string;
}

export default function ChatPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [roomId, setRoomId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 채팅방 조회/생성
  const fetchOrCreateRoom = async () => {
    try {
      setLoadingState("loading");
      const response = await fetch("/api/chat/room");

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.code === "NO_RESULT") {
          setLoadingState("no_result");
          return;
        }

        throw new Error(errorData.error || "Failed to fetch room");
      }

      const data: { room: ChatRoom; isNew: boolean } = await response.json();
      setRoomId(data.room.id);

      // 메시지 조회
      await fetchMessages(data.room.id);
      setLoadingState("ready");
    } catch (error) {
      console.error("Failed to fetch room:", error);
      setLoadingState("error");
    }
  };

  // 메시지 목록 조회
  const fetchMessages = async (id: string) => {
    try {
      const response = await fetch(`/api/chat/messages?roomId=${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data: { messages: ChatMessage[] } = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  // 메시지 전송
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data: {
        userMessage: ChatMessage;
        aiMessage: ChatMessage;
      } = await response.json();

      setMessages((prev) => [...prev, data.userMessage, data.aiMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("메시지 전송에 실패했습니다. 다시 시도해주세요.");
      setInputMessage(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  // 초기 로딩
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    fetchOrCreateRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router]);

  // 당일 결과 없음 - result 화면으로 이동
  useEffect(() => {
    if (loadingState === "no_result") {
      alert("오늘의 사주 결과가 없습니다. 먼저 결과를 확인해주세요.");
      router.replace("/result");
    }
  }, [loadingState, router]);

  // 로딩 중
  if (!isLoaded || loadingState === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">채팅방 준비 중</h1>
          <p className="text-gray-500">잠시만 기다려주세요...</p>
        </div>
      </main>
    );
  }

  // 오류 상태
  if (loadingState === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">오류 발생</h1>
            <p className="text-gray-500">채팅방을 불러오는 중 오류가 발생했습니다.</p>
          </div>
          <button
            onClick={fetchOrCreateRoom}
            className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  // 채팅 화면
  if (loadingState === "ready") {
    return (
      <main className="flex min-h-screen flex-col bg-gray-50">
        <div className="w-full max-w-4xl mx-auto flex flex-col h-screen">
          {/* 헤더 */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">사주 상담</h1>
              <button
                onClick={() => router.push("/result")}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                결과 보기
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              오늘의 사주 결과를 바탕으로 질문해보세요
            </p>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>아직 대화 내역이 없습니다.</p>
                <p className="text-sm mt-2">궁금한 점을 물어보세요!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.role === "user" ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <div className="bg-white border-t border-gray-200 p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isSending}
                placeholder="궁금한 점을 물어보세요..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? "전송 중..." : "전송"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
