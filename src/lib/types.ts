export type StudyEntryType = "word" | "pattern";

export type UserId = "colly" | "baebjji";

export type UserProfile = {
  id: UserId;
  name: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  description: string;
};

export const USER_PROFILES: Record<UserId, UserProfile> = {
  colly: {
    id: "colly",
    name: "콜리",
    emoji: "🐶",
    badgeBg: "bg-purple-100 text-purple-700 border-purple-200",
    badgeText: "콜리의 단어장",
    description: "귀여운 강아지 콜리의 꼼꼼한 학습장",
  },
  baebjji: {
    id: "baebjji",
    name: "뱁찌",
    emoji: "🐥",
    badgeBg: "bg-amber-100 text-amber-700 border-amber-200",
    badgeText: "뱁찌의 단어장",
    description: "아기 뱁새 뱁찌의 매일매일 영어장",
  },
};

export type StudyEntry = {
  id: string;
  type: StudyEntryType;
  english: string;
  korean: string;
  pronunciation?: string;
  example?: string;
  tags: string[];
  createdAt: string;
  reviewedAt?: string;
};

export type StudyDatabase = {
  version: 1;
  entries: StudyEntry[];
};

export type EntryInput = Omit<StudyEntry, "id" | "createdAt">;
