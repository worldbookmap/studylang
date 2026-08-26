"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faBookOpen,
  faCalendarDays,
  faCheck,
  faDice,
  faLayerGroup,
  faMagnifyingGlass,
  faPenNib,
  faPlus,
  faRotateRight,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Bell, BookText, CalendarDays, ListChecks, Sparkles } from "lucide-react";
import { AnimatedGradientText, MagicSurface } from "@/components/magic-ui/magic-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, isSameLocalDay, todayKey } from "@/lib/utils";
import { EntryInput, StudyEntry, StudyEntryType } from "@/lib/types";

type ActiveView = "input" | "quiz" | "calendar" | "list";

type FormState = {
  type: StudyEntryType;
  english: string;
  korean: string;
  pronunciation: string;
  example: string;
  tags: string;
};

const emptyForm: FormState = {
  type: "word",
  english: "",
  korean: "",
  pronunciation: "",
  example: "",
  tags: "",
};

const navItems: { id: ActiveView; label: string; icon: typeof BookText }[] = [
  { id: "input", label: "입력", icon: BookText },
  { id: "quiz", label: "랜덤퀴즈", icon: Sparkles },
  { id: "calendar", label: "공부달력", icon: CalendarDays },
  { id: "list", label: "전체목록", icon: ListChecks },
];

function normalizeTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getRandomEntry(entries: StudyEntry[], currentId?: string) {
  if (entries.length === 0) {
    return undefined;
  }

  const pool = entries.length > 1 ? entries.filter((entry) => entry.id !== currentId) : entries;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getMonthDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: lastDate }, (_, index) => new Date(year, month, index + 1));
}

export default function Home() {
  const [isBooting, setIsBooting] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("input");
  const [entries, setEntries] = useState<StudyEntry[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [quizEntry, setQuizEntry] = useState<StudyEntry>();
  const [showAnswer, setShowAnswer] = useState(false);
  const [status, setStatus] = useState("GitHub 저장소에서 학습장을 여는 중입니다.");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isWordLookupLoading, setIsWordLookupLoading] = useState(false);
  const [notificationReady, setNotificationReady] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSentKey, setReminderSentKey] = useState("");

  const todaysEntries = useMemo(
    () => entries.filter((entry) => isSameLocalDay(entry.createdAt) || isSameLocalDay(entry.reviewedAt)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    if (!lowerQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      [entry.english, entry.korean, entry.pronunciation, entry.example, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery),
    );
  }, [entries, query]);

  const calendarCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((acc, entry) => {
      const key = todayKey(new Date(entry.reviewedAt ?? entry.createdAt));
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [entries]);

  const currentQuizEntry = useMemo(() => {
    if (entries.length === 0) {
      return undefined;
    }

    return entries.find((entry) => entry.id === quizEntry?.id) ?? entries[0];
  }, [entries, quizEntry]);

  useEffect(() => {
    let mounted = true;

    async function loadEntries() {
      try {
        const [response] = await Promise.all([
          fetch("/api/entries", { cache: "no-store" }),
          new Promise((resolve) => setTimeout(resolve, 900)),
        ]);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "학습 데이터를 불러오지 못했습니다.");
        }

        if (mounted) {
          setEntries(payload.entries ?? []);
          setStatus("GitHub JSON 학습장이 연결되었습니다.");
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "학습 데이터를 불러오지 못했습니다.");
          setStatus("환경변수를 설정하면 GitHub 저장소에 저장됩니다.");
        }
      } finally {
        if (mounted) {
          setIsBooting(false);
        }
      }
    }

    loadEntries();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const checkReminder = () => {
      const now = new Date();
      const key = todayKey(now);

      if (now.getHours() !== 19 || reminderSentKey === key || todaysEntries.length === 0) {
        return;
      }

      setReminderOpen(true);
      setReminderSentKey(key);

      if (Notification.permission === "granted") {
        new Notification("StudyLang 7시 리마인드", {
          body: `오늘 추가하거나 복습한 ${todaysEntries.length}개 표현을 다시 볼 시간입니다.`,
        });
      }
    };

    checkReminder();
    const intervalId = window.setInterval(checkReminder, 60_000);

    return () => window.clearInterval(intervalId);
  }, [reminderSentKey, todaysEntries]);

  async function refreshEntries(nextEntries?: StudyEntry[]) {
    if (nextEntries) {
      setEntries(nextEntries);
      return;
    }

    const response = await fetch("/api/entries", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "학습 데이터를 다시 불러오지 못했습니다.");
    }

    setEntries(payload.entries ?? []);
  }

  async function lookupWordDetails(word = form.english) {
    if (form.type !== "word" || !word.trim()) {
      return;
    }

    setIsWordLookupLoading(true);

    try {
      const response = await fetch(`/api/pronunciation?word=${encodeURIComponent(word.trim())}`);
      const payload = await response.json();

      if (payload.pronunciation || payload.meaning) {
        setForm((current) => ({
          ...current,
          pronunciation: payload.pronunciation || current.pronunciation,
          korean: current.korean.trim() ? current.korean : payload.meaning || current.korean,
        }));
      }
    } finally {
      setIsWordLookupLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const input: EntryInput = {
      type: form.type,
      english: form.english.trim(),
      korean: form.korean.trim(),
      pronunciation: form.pronunciation.trim(),
      example: form.example.trim(),
      tags: normalizeTags(form.tags),
      reviewedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "저장하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setForm(emptyForm);
      setStatus("새 표현을 GitHub JSON 파일에 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markReviewed(entry: StudyEntry) {
    setError("");

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, reviewedAt: new Date().toISOString() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "복습 표시를 저장하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setStatus("복습 시간을 GitHub JSON 파일에 기록했습니다.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "복습 표시를 저장하지 못했습니다.");
    }
  }

  async function deleteEntry(entryId: string) {
    setError("");

    try {
      const response = await fetch(`/api/entries?id=${entryId}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "삭제하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setStatus("항목을 GitHub JSON 파일에서 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "삭제하지 못했습니다.");
    }
  }

  async function requestNotification() {
    if (!("Notification" in window)) {
      setError("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationReady(permission === "granted");
  }

  function nextQuiz() {
    setQuizEntry(getRandomEntry(entries, currentQuizEntry?.id));
    setShowAnswer(false);
  }

  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#dff4ff,transparent_34%),linear-gradient(135deg,#eef7ff,#d7ebff_48%,#c7d7ff)] p-6">
        <MagicSurface className="w-full max-w-md p-8 text-center animate-rise-in">
          <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-[var(--accent)]">StudyLang</p>
          <h1 className="mt-4 font-serif text-4xl font-extrabold text-[var(--ink)]">오늘의 영어장을 여는 중</h1>
          <div className="mx-auto mt-7 h-2 w-56 overflow-hidden rounded-full bg-[#c9def2]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
          <p className="mt-5 text-sm font-semibold text-[var(--muted-strong)]">{status}</p>
        </MagicSurface>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#eef7ff_0%,#d8ecff_47%,#c7d7ff_100%)] px-4 py-5 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge className="mb-3 bg-white/60">GitHub JSON Database</Badge>
            <h1 className="font-serif text-4xl font-extrabold leading-tight sm:text-6xl">
              <AnimatedGradientText>StudyLang</AnimatedGradientText>
            </h1>
          </div>
          <MagicSurface className="p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="전체" value={entries.length} />
              <Metric label="오늘" value={todaysEntries.length} />
              <Metric label="단어" value={entries.filter((entry) => entry.type === "word").length} />
            </div>
          </MagicSurface>
        </header>

        <MagicSurface className="grid gap-3 p-3 md:grid-cols-[1fr_auto] md:items-center">
          <nav className="grid grid-cols-2 gap-2 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold transition",
                    activeView === item.id
                      ? "bg-[var(--ink)] text-white shadow-sm"
                      : "bg-white/60 text-[var(--muted-strong)] hover:bg-white",
                  )}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <Button variant="secondary" onClick={requestNotification}>
            <FontAwesomeIcon icon={faBell} />
            {notificationReady ? "알림 켜짐" : "7시 알림 켜기"}
          </Button>
        </MagicSurface>

        {(error || status) && (
          <div className="rounded-md border border-[var(--line)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--muted-strong)]">
            {error || status}
          </div>
        )}

        {activeView === "input" && (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)]">
            <MagicSurface className="p-5 sm:p-7">
              <SectionTitle icon={faPenNib} title="단어 / 문장 패턴 입력" />
              <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-white/60 p-1">
                  {(["word", "pattern"] as StudyEntryType[]).map((type) => (
                    <button
                      className={cn(
                        "h-10 rounded-md text-sm font-extrabold transition",
                        form.type === type ? "bg-[var(--accent)] text-white" : "text-[var(--muted-strong)]",
                      )}
                      key={type}
                      onClick={() => setForm((current) => ({ ...current, type }))}
                      type="button"
                    >
                      {type === "word" ? "영어 단어" : "문장 패턴"}
                    </button>
                  ))}
                </div>
                <label className="grid gap-2 text-sm font-extrabold">
                  영어 표현
                  <Input
                    value={form.english}
                    onBlur={() => lookupWordDetails()}
                    onChange={(event) => setForm((current) => ({ ...current, english: event.target.value }))}
                    placeholder="e.g. resilient / I tend to..."
                    required
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <label className="grid gap-2 text-sm font-extrabold">
                    뜻 / 메모
                    <Input
                      value={form.korean}
                      onChange={(event) => setForm((current) => ({ ...current, korean: event.target.value }))}
                      placeholder="회복력 있는, 쉽게 포기하지 않는"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-extrabold">
                    발음기호
                    <Input
                      value={form.pronunciation}
                      onChange={(event) => setForm((current) => ({ ...current, pronunciation: event.target.value }))}
                      placeholder={isWordLookupLoading ? "찾는 중..." : "/rɪˈzɪliənt/"}
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-extrabold">
                  예문
                  <Textarea
                    value={form.example}
                    onChange={(event) => setForm((current) => ({ ...current, example: event.target.value }))}
                    placeholder="I tend to write new phrases down before I forget them."
                  />
                </label>
                <label className="grid gap-2 text-sm font-extrabold">
                  태그
                  <Input
                    value={form.tags}
                    onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="business, speaking, daily"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={isSaving} type="submit">
                    <FontAwesomeIcon icon={faPlus} />
                    {isSaving ? "저장 중" : "저장"}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => lookupWordDetails()}>
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                    뜻/발음 찾기
                  </Button>
                </div>
              </form>
            </MagicSurface>

            <MagicSurface className="p-5 sm:p-7">
              <SectionTitle icon={faLayerGroup} title="오늘의 복습 묶음" />
              <div className="mt-5 grid gap-3">
                {todaysEntries.length === 0 ? (
                  <EmptyState text="오늘 추가하거나 복습한 항목이 아직 없습니다." />
                ) : (
                  todaysEntries.slice(0, 5).map((entry) => <EntryRow entry={entry} key={entry.id} />)
                )}
              </div>
            </MagicSurface>
          </section>
        )}

        {activeView === "quiz" && (
          <MagicSurface className="p-5 sm:p-8">
            <SectionTitle icon={faDice} title="랜덤퀴즈" />
            {!currentQuizEntry ? (
              <EmptyState text="저장된 항목이 생기면 바로 퀴즈를 만들 수 있습니다." />
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="rounded-lg bg-white/70 p-6">
                  <Badge>{currentQuizEntry.type === "word" ? "단어" : "문장 패턴"}</Badge>
                  <p className="mt-5 font-serif text-4xl font-extrabold leading-tight">{currentQuizEntry.english}</p>
                  {currentQuizEntry.pronunciation && <p className="mt-2 text-lg font-bold text-[var(--accent)]">{currentQuizEntry.pronunciation}</p>}
                  <div className="mt-6 min-h-28 rounded-md border border-dashed border-[var(--line)] bg-[var(--paper)] p-4">
                    {showAnswer ? (
                      <div className="grid gap-3">
                        <p className="text-2xl font-extrabold">{currentQuizEntry.korean}</p>
                        {currentQuizEntry.example && <p className="text-base font-semibold text-[var(--muted-strong)]">{currentQuizEntry.example}</p>}
                      </div>
                    ) : (
                      <p className="text-sm font-extrabold text-[var(--muted)]">뜻과 예문을 떠올린 뒤 정답을 확인하세요.</p>
                    )}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => setShowAnswer(true)}>
                      <FontAwesomeIcon icon={faCheck} />
                      정답 보기
                    </Button>
                    <Button variant="secondary" onClick={nextQuiz}>
                      <FontAwesomeIcon icon={faRotateRight} />
                      다음 문제
                    </Button>
                    <Button variant="secondary" onClick={() => markReviewed(currentQuizEntry)}>
                      <FontAwesomeIcon icon={faBookOpen} />
                      복습 완료
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--ink)] p-5 text-white">
                  <p className="text-sm font-extrabold text-[#93c5fd]">오늘 7시 리마인드</p>
                  <p className="mt-3 text-3xl font-extrabold">{todaysEntries.length}개</p>
                  <p className="mt-3 text-sm font-semibold text-white/75">오늘 추가하거나 복습한 표현이 있으면 저녁 7시에 브라우저 알림과 앱 안 리마인드가 뜹니다.</p>
                </div>
              </div>
            )}
          </MagicSurface>
        )}

        {activeView === "calendar" && (
          <MagicSurface className="p-5 sm:p-8">
            <SectionTitle icon={faCalendarDays} title="공부달력" />
            <div className="mt-5 grid grid-cols-7 gap-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div className="text-center text-xs font-extrabold text-[var(--muted)]" key={day}>{day}</div>
              ))}
              {Array.from({ length: getMonthDays()[0].getDay() }).map((_, index) => (
                <div key={`blank-${index}`} />
              ))}
              {getMonthDays().map((day) => {
                const key = todayKey(day);
                const count = calendarCounts[key] ?? 0;
                return (
                  <div
                    className={cn(
                      "aspect-square rounded-md border border-[var(--line)] bg-white/64 p-2 text-sm font-extrabold",
                      count > 0 && "border-[var(--accent)] bg-[#dbeafe]",
                      todayKey() === key && "ring-2 ring-[var(--honey)]",
                    )}
                    key={key}
                  >
                    <div>{day.getDate()}</div>
                    {count > 0 && <div className="mt-2 text-xs text-[var(--accent)]">{count}개</div>}
                  </div>
                );
              })}
            </div>
          </MagicSurface>
        )}

        {activeView === "list" && (
          <MagicSurface className="p-5 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle icon={faLayerGroup} title="전체목록" />
              <div className="w-full sm:w-80">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="표현, 뜻, 태그 검색" />
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {filteredEntries.length === 0 ? (
                <EmptyState text="검색 결과가 없거나 아직 저장된 항목이 없습니다." />
              ) : (
                filteredEntries.map((entry) => (
                  <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white/68 p-4 md:grid-cols-[1fr_auto] md:items-center" key={entry.id}>
                    <EntryRow entry={entry} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => markReviewed(entry)}>
                        <FontAwesomeIcon icon={faCheck} />
                        복습
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteEntry(entry.id)}>
                        <FontAwesomeIcon icon={faTrash} />
                        삭제
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MagicSurface>
        )}
      </div>

      {reminderOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <MagicSurface className="w-full max-w-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--honey)] text-[var(--ink)]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-extrabold">저녁 7시 복습 시간</h2>
                <p className="mt-2 text-sm font-semibold text-[var(--muted-strong)]">오늘 공부한 {todaysEntries.length}개 표현을 한 번 더 확인하세요.</p>
              </div>
            </div>
            <div className="mt-5 grid max-h-72 gap-2 overflow-auto">
              {todaysEntries.map((entry) => <EntryRow entry={entry} key={entry.id} />)}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setReminderOpen(false)}>확인</Button>
            </div>
          </MagicSurface>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/72 px-4 py-3">
      <div className="font-serif text-3xl font-extrabold">{value}</div>
      <div className="text-xs font-extrabold text-[var(--muted)]">{label}</div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: typeof faPenNib; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--ink)] text-white">
        <FontAwesomeIcon icon={icon} />
      </span>
      <h2 className="font-serif text-2xl font-extrabold">{title}</h2>
    </div>
  );
}

function EntryRow({ entry }: { entry: StudyEntry }) {
  return (
    <div className="rounded-md bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{entry.type === "word" ? "단어" : "패턴"}</Badge>
        {entry.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
      </div>
      <p className="mt-3 text-lg font-extrabold">{entry.english}</p>
      {entry.pronunciation && <p className="text-sm font-bold text-[var(--accent)]">{entry.pronunciation}</p>}
      <p className="mt-1 text-sm font-semibold text-[var(--muted-strong)]">{entry.korean}</p>
      {entry.example && <p className="mt-2 text-sm text-[var(--muted)]">{entry.example}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-white/54 p-8 text-center text-sm font-extrabold text-[var(--muted)]">
      {text}
    </div>
  );
}
