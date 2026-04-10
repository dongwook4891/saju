import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { InputProvider } from "./contexts/InputContext";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "사주 서비스",
  description: "AI 사주 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <InputProvider>
        <html lang="ko" className="h-full antialiased">
          <body className="min-h-full flex flex-col">
            <Navbar />
            {children}
          </body>
        </html>
      </InputProvider>
    </ClerkProvider>
  );
}
