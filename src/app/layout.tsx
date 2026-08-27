import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "우리의 영어공부 | StudyLang",
  description: "콜리와 뱁찌의 영어 단어와 문장 패턴 학습장",
  openGraph: {
    title: "우리의 영어공부",
    description: "콜리와 뱁찌의 영어 단어와 문장 패턴 학습장",
    siteName: "우리의 영어공부",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "우리의 영어공부",
    description: "콜리와 뱁찌의 영어 단어와 문장 패턴 학습장",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
