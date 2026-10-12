import { EntryInput, StudyEntry, UserId } from "@/lib/types";

type SupabaseEntry = {
  id: string;
  profile_id: UserId;
  type: StudyEntry["type"];
  english: string;
  korean: string;
  pronunciation: string | null;
  example: string | null;
  tags: string[];
  created_at: string;
  reviewed_at: string | null;
};

class SupabaseStoreError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new SupabaseStoreError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.", 503);
  }

  return { url: url.replace(/\/$/, ""), key };
}

function entriesUrl(profileId: UserId, id?: string) {
  const { url } = getSupabaseConfig();
  const endpoint = new URL(`${url}/rest/v1/entries`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("profile_id", `eq.${profileId}`);
  if (id) endpoint.searchParams.set("id", `eq.${id}`);
  return endpoint;
}

async function supabaseRequest<T>(url: URL, init: RequestInit = {}): Promise<T> {
  const { key } = getSupabaseConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase request failed", response.status, details);
    throw new SupabaseStoreError("Supabase 데이터베이스 요청에 실패했습니다.", response.status >= 500 ? 502 : response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function fromDatabaseRow(row: SupabaseEntry): StudyEntry {
  return {
    id: row.id,
    type: row.type,
    english: row.english,
    korean: row.korean,
    pronunciation: row.pronunciation ?? undefined,
    example: row.example ?? undefined,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

function toDatabaseRow(entry: StudyEntry, profileId: UserId): SupabaseEntry {
  return {
    id: entry.id,
    profile_id: profileId,
    type: entry.type,
    english: entry.english,
    korean: entry.korean,
    pronunciation: entry.pronunciation || null,
    example: entry.example || null,
    tags: entry.tags ?? [],
    created_at: entry.createdAt,
    reviewed_at: entry.reviewedAt ?? null,
  };
}

export async function readStudyEntries(profileId: UserId): Promise<StudyEntry[]> {
  const endpoint = entriesUrl(profileId);
  endpoint.searchParams.set("order", "created_at.desc");
  const rows = await supabaseRequest<SupabaseEntry[]>(endpoint);
  return rows.map(fromDatabaseRow);
}

export async function createStudyEntry(input: EntryInput, profileId: UserId): Promise<StudyEntry[]> {
  const entry: StudyEntry = {
    ...input,
    id: crypto.randomUUID(),
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  };

  await supabaseRequest<SupabaseEntry[]>(entriesUrl(profileId), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toDatabaseRow(entry, profileId)),
  });

  return readStudyEntries(profileId);
}

export async function updateStudyEntry(
  id: string,
  changes: Partial<StudyEntry>,
  profileId: UserId,
): Promise<StudyEntry[]> {
  const databaseChanges: Partial<SupabaseEntry> = {};
  if (changes.type !== undefined) databaseChanges.type = changes.type;
  if (changes.english !== undefined) databaseChanges.english = changes.english;
  if (changes.korean !== undefined) databaseChanges.korean = changes.korean;
  if (changes.pronunciation !== undefined) databaseChanges.pronunciation = changes.pronunciation || null;
  if (changes.example !== undefined) databaseChanges.example = changes.example || null;
  if (changes.tags !== undefined) databaseChanges.tags = changes.tags;
  if (changes.reviewedAt !== undefined) databaseChanges.reviewed_at = changes.reviewedAt ?? null;

  await supabaseRequest<SupabaseEntry[]>(entriesUrl(profileId, id), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(databaseChanges),
  });

  return readStudyEntries(profileId);
}

export async function deleteStudyEntry(id: string, profileId: UserId): Promise<StudyEntry[]> {
  await supabaseRequest<undefined>(entriesUrl(profileId, id), { method: "DELETE" });
  return readStudyEntries(profileId);
}

export function supabaseErrorResponse(error: unknown) {
  if (error instanceof SupabaseStoreError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "알 수 없는 서버 오류가 발생했습니다." }, { status: 500 });
}