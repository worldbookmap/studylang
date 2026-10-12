import { NextRequest } from "next/server";
import {
  createStudyEntry,
  deleteStudyEntry,
  readStudyEntries,
  supabaseErrorResponse,
  updateStudyEntry,
} from "@/lib/supabase-store";
import { EntryInput, StudyEntry, StudyEntryType, UserId } from "@/lib/types";

class InvalidProfileError extends Error {}

function getProfileId(request: NextRequest): UserId {
  const profileId = request.nextUrl.searchParams.get("user") ?? request.headers.get("x-user-id");
  if (profileId !== "colly" && profileId !== "baebjji") {
    throw new InvalidProfileError("사용자 프로필을 확인할 수 없습니다.");
  }
  return profileId;
}

function entriesErrorResponse(error: unknown) {
  if (error instanceof InvalidProfileError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return supabaseErrorResponse(error);
}

export async function GET(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
    const entries = await readStudyEntries(profileId);
    return Response.json({ version: 1, entries });
  } catch (error) {
    return entriesErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
    const input = (await request.json()) as EntryInput;
    if (!input.english?.trim() || !input.korean?.trim() || !isStudyEntryType(input.type)) {
      return Response.json({ error: "영어 표현, 뜻, 올바른 카테고리가 필요합니다." }, { status: 400 });
    }
    const entries = await createStudyEntry(input, profileId);
    return Response.json({ version: 1, entries }, { status: 201 });
  } catch (error) {
    return entriesErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
    const input = (await request.json()) as Partial<StudyEntry> & { id: string };

    if (!input.id) {
      return Response.json({ error: "수정할 항목 id가 필요합니다." }, { status: 400 });
    }

    if (input.type !== undefined && !isStudyEntryType(input.type)) {
      return Response.json({ error: "올바른 카테고리가 필요합니다." }, { status: 400 });
    }
    const entries = await updateStudyEntry(input.id, input, profileId);
    return Response.json({ version: 1, entries });
  } catch (error) {
    return entriesErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "삭제할 항목 id가 필요합니다." }, { status: 400 });
    }

    const entries = await deleteStudyEntry(id, profileId);
    return Response.json({ version: 1, entries });
  } catch (error) {
    return entriesErrorResponse(error);
  }
}

function isStudyEntryType(type: string): type is StudyEntryType {
  return type === "word" || type === "pattern" || type === "shadowing";
}
