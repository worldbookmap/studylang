"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Bell,
  BookOpenCheck,
  BookText,
  CalendarDays,
  CircleCheck,
  Dices,
  Layers3,
  ListChecks,
  PenLine,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  User,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatedGradientText, MagicSurface } from "@/components/magic-ui/magic-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, isSameLocalDay, todayKey } from "@/lib/utils";
import { EntryInput, StudyEntry, StudyEntryType, UserId, USER_PROFILES } from "@/lib/types";

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

const navItems: { id: ActiveView; label: string; icon: LucideIcon }[] = [
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

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserId | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("input");
  const [entries, setEntries] = useState<StudyEntry[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "word" | "pattern">("all");
  const [quizEntry, setQuizEntry] = useState<StudyEntry>();
  const [showAnswer, setShowAnswer] = useState(false);
  const [status, setStatus] = useState("학습장을 불러오는 중입니다.");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isWordLookupLoading, setIsWordLookupLoading] = useState(false);
  const [notificationReady, setNotificationReady] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSentKey, setReminderSentKey] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const activeProfile = currentUser ? USER_PROFILES[currentUser] : null;

  const todaysEntries = useMemo(
    () => entries.filter((entry) => isSameLocalDay(entry.createdAt) || isSameLocalDay(entry.reviewedAt)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (listFilter !== "all" && entry.type !== listFilter) {
        return false;
      }
      if (!lowerQuery) {
        return true;
      }
      return [entry.english, entry.korean, entry.pronunciation, entry.example, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery);
    });
  }, [entries, query, listFilter]);

  const calendarEntries = useMemo(() => {
    return entries.reduce<Record<string, { word: number; pattern: number; entries: StudyEntry[] }>>((acc, entry) => {
      const key = localDateKey(new Date(entry.reviewedAt ?? entry.createdAt));
      const current = acc[key] ?? { word: 0, pattern: 0, entries: [] };
      current[entry.type] += 1;
      current.entries.push(entry);
      acc[key] = current;
      return acc;
    }, {});
  }, [entries]);

  const selectedCalendarEntries = selectedCalendarDate ? calendarEntries[selectedCalendarDate]?.entries ?? [] : [];

  const currentQuizEntry = useMemo(() => {
    if (entries.length === 0) {
      return undefined;
    }

    return entries.find((entry) => entry.id === quizEntry?.id) ?? entries[0];
  }, [entries, quizEntry]);

  async function loadUserEntries(user: UserId) {
    setIsBooting(true);
    setError("");

    try {
      const [response] = await Promise.all([
        fetch(`/api/entries?user=${user}`, { cache: "no-store" }),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "학습 데이터를 불러오지 못했습니다.");
      }

      setEntries(payload.entries ?? []);
      const profile = USER_PROFILES[user];
      setStatus(`${profile.name}(${profile.emoji})의 단어장 데이터베이스가 연결되었습니다.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "학습 데이터를 불러오지 못했습니다.");
      setStatus("저장 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsBooting(false);
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem("studylang_user") as UserId | null;
    if (savedUser && (savedUser === "colly" || savedUser === "baebjji")) {
      setCurrentUser(savedUser);
      loadUserEntries(savedUser);
    } else {
      setIsBooting(false);
      setIsUserModalOpen(true);
      setStatus("사용자를 선택하면 단어장이 시작됩니다.");
    }
  }, []);

  function handleSelectUser(user: UserId) {
    localStorage.setItem("studylang_user", user);
    setCurrentUser(user);
    setIsUserModalOpen(false);
    setForm(emptyForm);
    setEditingEntryId(null);
    loadUserEntries(user);
  }

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

    if (!currentUser) return;

    const response = await fetch(`/api/entries?user=${currentUser}`, { cache: "no-store" });
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
    if (!currentUser) return;
    setError("");
    setIsSaving(true);

    const input: EntryInput = {
      type: form.type,
      english: form.english.trim(),
      korean: form.korean.trim(),
      pronunciation: form.pronunciation.trim(),
      example: form.example.trim(),
      tags: normalizeTags(form.tags),
      ...(editingEntryId ? {} : { reviewedAt: new Date().toISOString() }),
    };

    try {
      const response = await fetch(`/api/entries?user=${currentUser}`, {
        method: editingEntryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEntryId ? { ...input, id: editingEntryId } : input),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "저장하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setForm(emptyForm);
      setEditingEntryId(null);
      setStatus(editingEntryId ? "표현을 수정해 저장했습니다." : "새 표현을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function editEntry(entry: StudyEntry) {
    setEditingEntryId(entry.id);
    setForm({
      type: entry.type,
      english: entry.english,
      korean: entry.korean,
      pronunciation: entry.pronunciation ?? "",
      example: entry.example ?? "",
      tags: entry.tags.join(", "),
    });
    setActiveView("input");
    setError("");
    setStatus("표현을 수정한 뒤 저장하세요.");
  }

  function cancelEditing() {
    setEditingEntryId(null);
    setForm(emptyForm);
    setStatus("새 표현을 입력할 수 있습니다.");
  }

  async function markReviewed(entry: StudyEntry) {
    if (!currentUser) return;
    setError("");

    try {
      const response = await fetch(`/api/entries?user=${currentUser}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, reviewedAt: new Date().toISOString() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "복습 표시를 저장하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setStatus("복습 시간을 기록했습니다.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "복습 표시를 저장하지 못했습니다.");
    }
  }

  async function deleteEntry(entryId: string) {
    if (!currentUser) return;
    setError("");

    try {
      const response = await fetch(`/api/entries?user=${currentUser}&id=${entryId}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "삭제하지 못했습니다.");
      }

      await refreshEntries(payload.entries);
      setStatus("항목을 삭제했습니다.");
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

  if (isBooting && currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8fbff,#dbeafe_48%,#c7d2fe)] p-6">
        <MagicSurface className="w-full max-w-md animate-rise-in p-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--accent)]">StudyLang</p>
          <div className="mt-3 flex justify-center text-4xl">
            {activeProfile?.emoji ?? "📖"}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            {activeProfile?.name ?? "사용자"}의 영어장을 여는 중
          </h1>
          <div className="mx-auto mt-7 h-2 w-56 overflow-hidden rounded-full bg-[#c9def2]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#0f3c81,#38bdf8)]" />
          </div>
          <p className="mt-5 text-sm font-semibold text-[var(--muted-strong)]">{status}</p>
        </MagicSurface>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[size:44px_44px] px-3 py-4 text-[var(--ink)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5">
        <header className="grid gap-4 rounded-xl border border-white/70 bg-[linear-gradient(135deg,rgba(248,251,255,0.96),rgba(214,232,255,0.88))] p-4 text-[var(--ink)] shadow-[0_22px_70px_rgba(37,99,235,0.18)] sm:p-5 lg:grid-cols-[1fr_auto] lg:items-end lg:p-7">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h1 className="relative isolate inline-flex overflow-visible pl-6 pr-6 font-serif text-[2.65rem] font-extrabold leading-none tracking-tight min-[420px]:text-5xl sm:pl-14 sm:pr-20 sm:text-6xl">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-11 top-1/2 z-0 h-44 w-44 -translate-y-[52%] rotate-6 object-contain opacity-43 min-[420px]:h-52 min-[420px]:w-52 sm:-left-7 sm:h-60 sm:w-60"
                  height={240}
                  priority
                  src="/assets/cat.svg"
                  width={240}
                />
                <AnimatedGradientText className="relative z-10">StudyLang</AnimatedGradientText>
              </h1>
            </div>
          </div>

          <div className="w-full max-w-[17rem] justify-self-center rounded-lg border border-white/60 bg-white/20 p-1.5 shadow-sm backdrop-blur-md sm:max-w-none sm:p-3 lg:justify-self-auto">
            <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
              <Metric label="전체" value={entries.length} />
              <Metric label="오늘" value={todaysEntries.length} />
              <Metric label="단어" value={entries.filter((entry) => entry.type === "word").length} />
            </div>
          </div>
        </header>

        <MagicSurface className="grid gap-2 p-2 sm:gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <nav className="grid grid-cols-2 gap-2 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-extrabold transition sm:h-11 sm:px-3",
                    activeView === item.id
                      ? "bg-[linear-gradient(135deg,#0b1f3a,#2563eb)] text-white shadow-[0_10px_28px_rgba(37,99,235,0.25)]"
                      : "text-[var(--muted-strong)] hover:bg-white/80",
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
          <Button className="w-full md:w-auto" variant="secondary" onClick={requestNotification}>
            <Bell className="h-4 w-4" />
            {notificationReady ? "알림 켜짐" : "7시 알림 켜기"}
          </Button>
        </MagicSurface>

        {(error || status) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/72 px-4 py-3 text-sm font-bold leading-6 text-[var(--muted-strong)] shadow-sm backdrop-blur sm:leading-normal">
            <span>{error || status}</span>
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/80 text-xl shadow-sm transition hover:scale-110 hover:bg-blue-50 active:scale-95"
              title="사용자 교체"
              aria-label="사용자 교체"
              type="button"
            >
              {activeProfile?.emoji ?? "🐶"}
            </button>
          </div>
        )}

        {activeView === "input" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)]">
            <MagicSurface className="p-4 sm:p-7">
              <SectionTitle icon={PenLine} title={editingEntryId ? "표현 수정" : "단어 / 문장 패턴 입력"} />
              <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--line)] bg-[#edf6ff] p-1">
                  {(["word", "pattern"] as StudyEntryType[]).map((type) => (
                    <button
                      className={cn(
                        "h-10 rounded-md text-sm font-extrabold transition",
                        form.type === type ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--muted-strong)]",
                      )}
                      key={type}
                      onClick={() => setForm((current) => ({
                        ...current,
                        type,
                        pronunciation: type === "pattern" ? "" : current.pronunciation,
                      }))}
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
                    onChange={(event) => setForm((current) => {
                      const english = event.target.value;
                      const wordCount = english.trim().split(/\s+/).filter(Boolean).length;

                      return {
                        ...current,
                        english,
                        type: current.type === "word" && wordCount >= 3 ? "pattern" : current.type,
                        pronunciation: current.type === "word" && wordCount >= 3 ? "" : current.pronunciation,
                      };
                    })}
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
                      disabled={form.type === "pattern"}
                      value={form.pronunciation}
                      onChange={(event) => setForm((current) => ({ ...current, pronunciation: event.target.value }))}
                      placeholder={form.type === "pattern" ? "문장 패턴은 발음기호를 사용하지 않습니다" : isWordLookupLoading ? "찾는 중..." : "/rɪˈzɪliənt/"}
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
                    {editingEntryId ? <CircleCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {isSaving ? "저장 중" : editingEntryId ? "수정 저장" : "저장"}
                  </Button>
                  {editingEntryId && (
                    <Button disabled={isSaving} variant="secondary" type="button" onClick={cancelEditing}>
                      취소
                    </Button>
                  )}
                  <Button disabled={form.type === "pattern" || isWordLookupLoading} variant="secondary" type="button" onClick={() => lookupWordDetails()}>
                    <Search className="h-4 w-4" />
                    뜻/발음 찾기
                  </Button>
                </div>
              </form>
            </MagicSurface>

            <MagicSurface className="p-4 sm:p-7">
              <SectionTitle icon={Layers3} title="오늘의 복습 묶음" />
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
            <SectionTitle icon={Dices} title="랜덤퀴즈" />
            {!currentQuizEntry ? (
              <EmptyState text="저장된 항목이 생기면 바로 퀴즈를 만들 수 있습니다." />
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
                  <Badge>{currentQuizEntry.type === "word" ? "단어" : "문장 패턴"}</Badge>
                  <p className="mt-5 font-serif text-4xl font-extrabold leading-tight">{currentQuizEntry.english}</p>
                  {currentQuizEntry.pronunciation && <p className="mt-2 text-lg font-bold text-[var(--accent)]">{currentQuizEntry.pronunciation}</p>}
                  <div className="mt-6 min-h-28 rounded-md border border-dashed border-[var(--line)] bg-[#eff7ff] p-4">
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
                      <CircleCheck className="h-4 w-4" />
                      정답 보기
                    </Button>
                    <Button variant="secondary" onClick={nextQuiz}>
                      <RotateCw className="h-4 w-4" />
                      다음 문제
                    </Button>
                    <Button variant="secondary" onClick={() => markReviewed(currentQuizEntry)}>
                      <BookOpenCheck className="h-4 w-4" />
                      복습 완료
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg bg-[linear-gradient(160deg,#071a34,#123f80)] p-5 text-white shadow-[0_16px_48px_rgba(7,26,52,0.28)]">
                  <p className="text-sm font-extrabold text-[#93c5fd]">오늘 7시 리마인드</p>
                  <p className="mt-3 text-3xl font-extrabold">{todaysEntries.length}개</p>
                  <p className="mt-3 text-sm font-semibold text-white/75">오늘 추가하거나 복습한 표현이 있으면 저녁 7시에 브라우저 알림과 앱 안 리마인드가 뜹니다.</p>
                </div>
              </div>
            )}
          </MagicSurface>
        )}

        {activeView === "calendar" && (
          <MagicSurface className="p-3 sm:p-8">
            <SectionTitle icon={CalendarDays} title="공부달력" />
            <div className="mt-3 grid grid-cols-7 gap-1 sm:mt-5 sm:gap-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div className="text-center text-xs font-extrabold text-[var(--muted)]" key={day}>{day}</div>
              ))}
              {Array.from({ length: getMonthDays()[0].getDay() }).map((_, index) => (
                <div key={`blank-${index}`} />
              ))}
              {getMonthDays().map((day) => {
                const key = localDateKey(day);
                const dayEntries = calendarEntries[key] ?? { word: 0, pattern: 0, entries: [] };
                const count = dayEntries.entries.length;
                return (
                  <button
                    className={cn(
                      "aspect-square rounded-md border border-[var(--line)] bg-white/70 p-1 text-left text-xs font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-white sm:p-2 sm:text-sm",
                      count > 0 && "border-[var(--accent)] bg-[#dbeafe] shadow-[0_10px_24px_rgba(37,99,235,0.16)]",
                      localDateKey(new Date()) === key && "ring-2 ring-[var(--honey)]",
                    )}
                    aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일 공부 내용 보기`}
                    key={key}
                    onClick={() => setSelectedCalendarDate(key)}
                    type="button"
                  >
                    <div>{day.getDate()}</div>
                    {count > 0 && (
                      <div className="mt-1 grid gap-0 text-[0.6rem] leading-tight text-[var(--accent)] sm:mt-2 sm:gap-0.5 sm:text-xs">
                        {dayEntries.word > 0 && <span><span className="sm:hidden">단 </span><span className="hidden sm:inline">단어 </span>{dayEntries.word}</span>}
                        {dayEntries.pattern > 0 && <span><span className="sm:hidden">패 </span><span className="hidden sm:inline">패턴 </span>{dayEntries.pattern}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </MagicSurface>
        )}

        {activeView === "list" && (
          <MagicSurface className="p-5 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle icon={Layers3} title="전체목록" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex rounded-md border border-[var(--line)] bg-[#edf6ff] p-1">
                  <button
                    type="button"
                    onClick={() => setListFilter("all")}
                    className={cn(
                      "px-3 py-1.5 text-xs sm:text-sm font-extrabold rounded-md transition",
                      listFilter === "all" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--muted-strong)]",
                    )}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter("word")}
                    className={cn(
                      "px-3 py-1.5 text-xs sm:text-sm font-extrabold rounded-md transition",
                      listFilter === "word" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--muted-strong)]",
                    )}
                  >
                    단어
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilter("pattern")}
                    className={cn(
                      "px-3 py-1.5 text-xs sm:text-sm font-extrabold rounded-md transition",
                      listFilter === "pattern" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--muted-strong)]",
                    )}
                  >
                    문장 패턴
                  </button>
                </div>
                <div className="w-full sm:w-64">
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="표현, 뜻, 태그 검색" />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {filteredEntries.length === 0 ? (
                <EmptyState text="검색 결과가 없거나 아직 저장된 항목이 없습니다." />
              ) : (
                filteredEntries.map((entry) => (
                  <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center" key={entry.id}>
                    <EntryRow entry={entry} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => editEntry(entry)}>
                        <PenLine className="h-4 w-4" />
                        수정
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => markReviewed(entry)}>
                        <CircleCheck className="h-4 w-4" />
                        복습
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteEntry(entry.id)}>
                        <Trash2 className="h-4 w-4" />
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

      {/* 사용자 선택 / 교체 모달 */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
          <MagicSurface className="motion-safe:animate-soft-pop w-full max-w-lg p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl shadow-inner">
              👋
            </div>
            <h2 className="mt-4 font-serif text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
              누가 공부할 건가요?
            </h2>
            <p className="mt-2 text-sm font-semibold text-[var(--muted-strong)]">
              사용자를 선택하면 개별 데이터베이스에 학습한 단어가 안전하게 따로 저장됩니다.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(Object.keys(USER_PROFILES) as UserId[]).map((userId) => {
                const profile = USER_PROFILES[userId];
                const isSelected = currentUser === userId;
                return (
                  <button
                    key={userId}
                    onClick={() => handleSelectUser(userId)}
                    className={cn(
                      "group relative flex flex-col items-center rounded-xl border-2 p-5 text-center transition-all hover:-translate-y-1 hover:shadow-md",
                      isSelected
                        ? "border-[var(--accent)] bg-blue-50/80 shadow-md ring-2 ring-[var(--accent)]/30"
                        : "border-gray-200/80 bg-white hover:border-blue-300",
                    )}
                    type="button"
                  >
                    <div className="text-4xl transition-transform group-hover:scale-110">
                      {profile.emoji}
                    </div>
                    <h3 className="mt-3 font-serif text-xl font-extrabold text-[var(--ink)]">
                      {profile.name}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[var(--muted-strong)]">
                      {profile.description}
                    </p>
                    <span
                      className={cn(
                        "mt-4 rounded-full px-3 py-1 text-xs font-black",
                        profile.badgeBg,
                      )}
                    >
                      {isSelected ? "현재 선택됨" : "선택하기"}
                    </span>
                  </button>
                );
              })}
            </div>

            {currentUser && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={() => setIsUserModalOpen(false)}>
                  취소
                </Button>
              </div>
            )}
          </MagicSurface>
        </div>
      )}

      {reminderOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <MagicSurface className="motion-safe:animate-soft-pop w-full max-w-lg p-6">
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

      {selectedCalendarDate && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <MagicSurface className="motion-safe:animate-soft-pop w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-[var(--accent)]">공부 기록</p>
                <h2 className="mt-1 font-serif text-2xl font-extrabold">{formatCalendarDate(selectedCalendarDate)}</h2>
              </div>
              <Button aria-label="공부 기록 닫기" size="icon" variant="secondary" onClick={() => setSelectedCalendarDate(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-5 grid max-h-80 gap-2 overflow-auto">
              {selectedCalendarEntries.length === 0 ? (
                <EmptyState text="이 날 공부한 내용이 없습니다." />
              ) : (
                selectedCalendarEntries.map((entry) => <EntryRow entry={entry} key={entry.id} />)
              )}
            </div>
          </MagicSurface>
        </div>
      )}
    </main>
  );
}

function formatCalendarDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/10 px-2 py-1.5 backdrop-blur-[2px] sm:bg-white/15 sm:px-4 sm:py-3">
      <div className="font-serif text-xl font-extrabold leading-none sm:text-4xl lg:text-3xl">{value}</div>
      <div className="mt-1 text-[0.65rem] font-extrabold leading-none text-[var(--muted)] sm:text-sm lg:text-xs">{label}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ink)] text-white sm:h-11 sm:w-11">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <h2 className="font-serif text-[1.45rem] font-extrabold leading-tight sm:text-3xl lg:text-2xl">{title}</h2>
    </div>
  );
}

function EntryRow({ entry }: { entry: StudyEntry }) {
  function speakEntry() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.english);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((voice) =>
      /^(en-US|en-GB)$/i.test(voice.lang) && /Samantha|Google US English|Microsoft Aria|Microsoft Jenny/i.test(voice.name),
    ) ?? voices.find((voice) => /^en(-US|-GB)?$/i.test(voice.lang));

    utterance.lang = englishVoice?.lang ?? "en-US";
    utterance.voice = englishVoice ?? null;
    utterance.rate = 0.88;
    utterance.pitch = 1.02;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="rounded-md bg-white/70 p-3 motion-safe:animate-rise-in motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{entry.type === "word" ? "단어" : "패턴"}</Badge>
        {entry.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <p className="text-lg font-extrabold">{entry.english}</p>
        <Button
          aria-label={`${entry.english} 듣기`}
          className="h-5 w-5 text-[9px]"
          size="icon"
          variant="secondary"
          onClick={speakEntry}
          title="표현 듣기"
        >
          <Volume2 className="h-3 w-3" />
        </Button>
      </div>
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
