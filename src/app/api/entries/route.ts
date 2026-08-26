import { NextRequest } from "next/server";
import { githubErrorResponse, readStudyDatabase, writeStudyDatabase } from "@/lib/github-store";
import { EntryInput, StudyEntry } from "@/lib/types";

export async function GET() {
  try {
    const { database } = await readStudyDatabase();
    return Response.json(database);
  } catch (error) {
    return githubErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as EntryInput;
    const { database, sha } = await readStudyDatabase();
    const entry: StudyEntry = {
      ...input,
      id: crypto.randomUUID(),
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
    };

    const nextDatabase = await writeStudyDatabase([entry, ...database.entries], sha);
    return Response.json(nextDatabase, { status: 201 });
  } catch (error) {
    return githubErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = (await request.json()) as Partial<StudyEntry> & { id: string };
    const { database, sha } = await readStudyDatabase();
    const entries = database.entries.map((entry) =>
      entry.id === input.id ? { ...entry, ...input, id: entry.id } : entry,
    );

    const nextDatabase = await writeStudyDatabase(entries, sha);
    return Response.json(nextDatabase);
  } catch (error) {
    return githubErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "삭제할 항목 id가 필요합니다." }, { status: 400 });
    }

    const { database, sha } = await readStudyDatabase();
    const nextDatabase = await writeStudyDatabase(
      database.entries.filter((entry) => entry.id !== id),
      sha,
    );

    return Response.json(nextDatabase);
  } catch (error) {
    return githubErrorResponse(error);
  }
}
