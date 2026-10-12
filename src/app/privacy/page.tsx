import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 안내 | 우리의 영어공부",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl content-start gap-6 px-5 py-10 text-[var(--ink)] sm:px-8">
      <Link className="text-sm font-bold text-[var(--accent)] underline" href="/">학습장으로 돌아가기</Link>
      <h1 className="font-serif text-3xl font-extrabold">개인정보 안내</h1>
      <section className="grid gap-3 text-sm leading-7 text-[var(--muted-strong)]">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">외부 서비스 사용</h2>
        <p>단어나 문장 검색을 요청하면 검색어가 사용자가 선택한 제3자 검색 서비스로 전달됩니다. YouGlish 위젯과 YouTube 플레이어는 해당 서비스가 연결 정보를 처리하고 쿠키 또는 기기 정보를 사용할 수 있습니다. PlayPhrase.me는 사용자가 선택하면 새 탭에서 열립니다.</p>
        <p>Fraze.it 예문은 화면에만 일시 표시되며 StudyLang 데이터베이스에 저장하지 않습니다. 번역을 요청하면 입력 문장이 DeepL에 전달됩니다. 사용자가 저장을 선택한 학습 항목은 Supabase에 저장됩니다.</p>
        <p>브라우저의 `studylang_user` 값은 콜리/뱁찌 프로필 선택에 쓰이며 로그인 인증이 아닙니다. 외부 서비스의 데이터 처리는 각 제공자의 정책을 따릅니다.</p>
        <p><a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google 개인정보처리방침</a> · <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube 이용약관</a> · <Link className="underline" href="/terms#third-party-content">제3자 콘텐츠 이용 안내</Link></p>
      </section>
    </main>
  );
}