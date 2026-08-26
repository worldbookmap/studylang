export type StudyEntryType = "word" | "pattern";

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
