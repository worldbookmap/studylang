import { NextRequest } from "next/server";

type DictionaryPhonetic = {
  text?: string;
};

type DictionaryMeaning = {
  definitions?: { definition?: string; example?: string }[];
};

type DictionaryEntry = {
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
  meanings?: DictionaryMeaning[];
};

type TranslationResponse = {
  responseData?: {
    translatedText?: string;
  };
};

async function lookupKoreanMeaning(word: string) {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`,
    { next: { revalidate: 60 * 60 * 24 * 7 } },
  );

  if (!response.ok) {
    return "";
  }

  const data = (await response.json()) as TranslationResponse;
  const translatedText = data.responseData?.translatedText?.trim() ?? "";

  return translatedText.toLowerCase() === word.toLowerCase() ? "" : translatedText;
}

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
  const englishDefinition =
    data
      .flatMap((entry) => entry.meanings ?? [])
      .flatMap((meaning) => meaning.definitions ?? [])
      .find((definition) => definition.definition)?.definition ?? "";
  const example =
    data
      .flatMap((entry) => entry.meanings ?? [])
      .flatMap((meaning) => meaning.definitions ?? [])
      .find((definition) => definition.example)?.example ?? "";
  const koreanMeaning = await lookupKoreanMeaning(word);

  return Response.json({ pronunciation, meaning: koreanMeaning || englishDefinition, example });
}
