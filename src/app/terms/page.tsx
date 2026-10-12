import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용 안내 | 우리의 영어공부",
};

export default function TermsPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl content-start gap-6 px-5 py-10 text-[var(--ink)] sm:px-8">
      <Link className="text-sm font-bold text-[var(--accent)] underline" href="/">학습장으로 돌아가기</Link>
      <h1 className="font-serif text-3xl font-extrabold">이용 안내</h1>
      <section className="grid gap-3 text-sm leading-7 text-[var(--muted-strong)]">
        <h2 id="third-party-content" className="text-lg font-extrabold text-[var(--ink)]">제3자 영상·예문 콘텐츠</h2>
        <p>YouGlish, YouTube, PlayPhrase.me 및 Fraze.it의 검색 결과와 영상은 각 제공자가 제공하며 해당 서비스의 약관과 저작권이 적용됩니다. 이 앱은 외부 콘텐츠를 학습 참고용으로 표시하거나 원 제공 사이트로 연결합니다.</p>
        <p>YouGlish 영상·자막을 복사하거나 재배포하지 마세요. Fraze.it API 응답은 개인·비상업적 학습 참고로만 표시하며 앱 데이터베이스에 저장하거나 캐시하지 않습니다. PlayPhrase 검색은 원 사이트에서 엽니다.</p>
        <p>이 앱의 YouGlish 위젯은 비상업적 교육 이용을 전제로 합니다. 상업적 사용이나 앱 내 콘텐츠 재사용 권한은 각 제공자에게 별도 확인해야 합니다.</p>
        <p><a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube 이용약관</a> · <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google 개인정보처리방침</a> · <a className="underline" href="https://fraze.it/api.jsp" target="_blank" rel="noreferrer">Fraze.it API 조건</a></p>
      </section>
      <Link className="text-sm font-bold text-[var(--accent)] underline" href="/privacy">개인정보 안내</Link>
    </main>
  );
}