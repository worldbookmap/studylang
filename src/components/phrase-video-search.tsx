"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

type YouGlishEvent = {
  totalResult?: number;
};

type YouGlishWidgetInstance = {
  fetch: (query: string, language: string, accent?: string) => void;
  close: () => void;
};

declare global {
  interface Window {
    YG?: {
      Widget: new (
        container: HTMLElement | string,
        options: {
          width: number;
          components: number;
          autoStart: 0;
          events: { onFetchDone: (event: YouGlishEvent) => void };
        },
      ) => YouGlishWidgetInstance;
    };
    onYouglishAPIReady?: () => void;
  }
}

export function YouGlishSearchWidget({ query }: { query: string }) {
  const widgetId = `youglish-${useId().replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<YouGlishWidgetInstance | null>(null);
  const queryRef = useRef(query);
  const [isReady, setIsReady] = useState(false);
  const [noResultsFor, setNoResultsFor] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  useLayoutEffect(() => {
    let isActive = true;
    const previousReadyCallback = window.onYouglishAPIReady;

    const initializeWidget = () => {
      if (!isActive || !containerRef.current || !window.YG?.Widget || widgetRef.current) return;

      const width = Math.max(320, Math.min(containerRef.current.clientWidth, 720));
      widgetRef.current = new window.YG.Widget(widgetId, {
        width,
        components: 9,
        autoStart: 0,
        events: {
          onFetchDone: (event) => setNoResultsFor(event.totalResult === 0 ? queryRef.current : null),
        },
      });
      setIsReady(true);
    };

    window.onYouglishAPIReady = initializeWidget;

    if (window.YG?.Widget) {
      initializeWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-youglish-widget]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://youglish.com/public/emb/widget.js";
        script.async = true;
        script.dataset.youglishWidget = "true";
        script.onerror = () => setHasLoadError(true);
        document.head.appendChild(script);
      }
    }

    return () => {
      isActive = false;
      if (window.onYouglishAPIReady === initializeWidget) {
        window.onYouglishAPIReady = previousReadyCallback;
      }
      widgetRef.current?.close();
      widgetRef.current = null;
    };
  }, [widgetId]);

  useEffect(() => {
    queryRef.current = query;
    if (!isReady || !query.trim()) return;
    widgetRef.current?.fetch(query.trim(), "english");
  }, [isReady, query]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold">YouGlish 영상 검색</h3>
        <a
          className="text-xs font-bold text-[var(--accent)] underline"
          href={`https://youglish.com/pronounce/${encodeURIComponent(query.trim())}/english/all`}
          target="_blank"
          rel="noreferrer"
        >
          YouGlish에서 열기
        </a>
      </div>
      <div
        aria-label="YouGlish 검색 결과 동영상"
        className="min-h-[380px] min-w-0 overflow-x-auto rounded-md border border-[var(--line)] bg-white"
        id={widgetId}
        ref={containerRef}
      />
      {hasLoadError && <p role="status" className="text-xs text-[var(--muted-strong)]">YouGlish 위젯을 불러오지 못했습니다. 새 탭에서 열어 주세요.</p>}
      {noResultsFor === query && <p role="status" className="text-xs text-[var(--muted-strong)]">YouGlish에서 검색 결과를 찾지 못했습니다.</p>}
      <p className="text-xs text-[var(--muted)]">
        Powered by YouGlish.com · <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube 이용약관</a> · <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google 개인정보처리방침</a> · <Link className="underline" href="/terms#third-party-content">서비스 안내</Link>
      </p>
    </div>
  );
}

export function PlayPhraseSearchLink({ query }: { query: string }) {
  const url = `https://www.playphrase.me/#/search?q=${encodeURIComponent(query.trim())}`;

  return (
    <a
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-extrabold text-[var(--muted-strong)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      PlayPhrase에서 영상 예문 열기
    </a>
  );
}