import { NextRequest } from "next/server";

type DictionaryPhonetic = {
  text?: string;
};

type DictionaryEntry = {
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
};

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.trim();

  if (!word) {
    return Response.json({ pronunciation: "" });
  }

  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!response.ok) {
    return Response.json({ pronunciation: "" });
  }

  const data = (await response.json()) as DictionaryEntry[];
  const pronunciation =
    data.find((entry) => entry.phonetic)?.phonetic ??
    data.flatMap((entry) => entry.phonetics ?? []).find((phonetic) => phonetic.text)?.text ??
    "";

  return Response.json({ pronunciation });
}
