import { NextRequest } from "next/server";

type DictionaryDefinition = {
  definition?: string;
  example?: string;
};

type DictionaryMeaning = {
  definitions?: DictionaryDefinition[];
};

type DictionaryPhonetic = {
  text?: string;
};

type DictionaryEntry = {
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
  meanings?: DictionaryMeaning[];
};

type DatamuseEntry = {
  word?: string;
  defs?: string[];
};

type WiktionaryResponse = {
  parse?: {
    wikitext?: { "*"?: string };
  };
};

const DEFINITION_HEADINGS = new Set([
  "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "interjection",
  "numeral", "determiner", "conjunction", "particle", "proper noun", "phrase",
]);
const EXAMPLE_TEMPLATES = new Set([
  "ux", "usex", "uxi", "quote-text", "quote-book", "quote-journal", "quote-web",
  "quote-song", "quote-hansard", "quote-av",
]);

function normalizeTerm(value: string) {
  return value.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

async function lookupDictionaryApi(term: string): Promise<DictionaryEntry[]> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
      { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    return Array.isArray(payload) ? payload as DictionaryEntry[] : [];
  } catch {
    return [];
  }
}

async function lookupDatamuse(term: string): Promise<string[]> {
  try {
    const url = new URL("https://api.datamuse.com/words");
    url.searchParams.set("sp", term);
    url.searchParams.set("md", "d");
    url.searchParams.set("max", "8");
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];

    const entries = (await response.json()) as DatamuseEntry[];
    const exactEntry = entries.find((entry) => normalizeTerm(entry.word ?? "") === normalizeTerm(term));
    return (exactEntry?.defs ?? []).map((definition) => {
      const separator = definition.indexOf("\t");
      return (separator >= 0 ? definition.slice(separator + 1) : definition).trim();
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function splitTemplateArguments(template: string) {
  const argumentsList: string[] = [];
  let start = 0;
  let depth = 0;

  for (let index = 0; index < template.length; index += 1) {
    if (template.startsWith("{{", index)) {
      depth += 1;
      index += 1;
    } else if (template.startsWith("}}", index)) {
      depth = Math.max(0, depth - 1);
      index += 1;
    } else if (template[index] === "|" && depth === 0) {
      argumentsList.push(template.slice(start, index).trim());
      start = index + 1;
    }
  }

  argumentsList.push(template.slice(start).trim());
  return argumentsList;
}

function findTemplates(wikitext: string, names: Set<string>) {
  const matches: string[][] = [];
  let index = 0;

  while (index < wikitext.length - 1) {
    if (!wikitext.startsWith("{{", index)) {
      index += 1;
      continue;
    }

    let depth = 1;
    let cursor = index + 2;
    while (cursor < wikitext.length - 1 && depth > 0) {
      if (wikitext.startsWith("{{", cursor)) {
        depth += 1;
        cursor += 2;
      } else if (wikitext.startsWith("}}", cursor)) {
        depth -= 1;
        cursor += 2;
      } else {
        cursor += 1;
      }
    }

    if (depth === 0) {
      const argumentsList = splitTemplateArguments(wikitext.slice(index + 2, cursor - 2));
      if (names.has(argumentsList[0]?.toLowerCase())) matches.push(argumentsList);
      index = cursor;
    } else {
      index += 2;
    }
  }

  return matches;
}

function cleanWikitext(value: string) {
  let cleaned = value.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  for (let pass = 0; pass < 5; pass += 1) {
    cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, "");
  }

  return cleaned
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/'''|''/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getEnglishSection(wikitext: string) {
  const heading = /^==\s*English\s*==\s*$/m.exec(wikitext);
  if (!heading) return "";

  const start = heading.index + heading[0].length;
  const rest = wikitext.slice(start);
  const nextLanguage = /^==[^=].*?==\s*$/m.exec(rest);
  return nextLanguage ? rest.slice(0, nextLanguage.index) : rest;
}

function extractWiktionaryData(wikitext: string) {
  const englishSection = getEnglishSection(wikitext);
  if (!englishSection) return { pronunciation: "", definitions: [] as string[], examples: [] as string[] };

  const pronunciationTemplate = findTemplates(englishSection, new Set(["ipa", "ipachar"]))
    .find((args) => args[1]?.toLowerCase().startsWith("en"));
  const pronunciation = pronunciationTemplate
    ? cleanWikitext(pronunciationTemplate[2] ?? "")
    : "";

  let inDefinitionSection = false;
  const definitions = englishSection.split("\n").flatMap((line) => {
    const heading = /^===([^=]+)===$/.exec(line.trim());
    if (heading) {
      inDefinitionSection = DEFINITION_HEADINGS.has(heading[1].replace(/\s+\d+$/, "").trim().toLowerCase());
      return [];
    }

    const definition = inDefinitionSection ? /^#(?![#*:])\s+(.+)$/.exec(line.trim()) : null;
    const cleaned = definition ? cleanWikitext(definition[1]) : "";
    return cleaned.length > 8 ? [cleaned] : [];
  });

  const exampleTemplates = findTemplates(englishSection, EXAMPLE_TEMPLATES);
  const orderedExampleTemplates = [
    ...exampleTemplates.filter((args) => ["ux", "usex", "uxi"].includes(args[0].toLowerCase())),
    ...exampleTemplates.filter((args) => !["ux", "usex", "uxi"].includes(args[0].toLowerCase())),
  ];
  const examples = orderedExampleTemplates.flatMap((args) => {
    const name = args[0].toLowerCase();
    const value = name === "ux" || name === "usex" || name === "uxi"
      ? args.slice(2).find((argument) => argument && !argument.includes("="))
      : args.slice(1).map((argument) => argument.trim()).find((argument) => /^(passage|text)=/i.test(argument))?.replace(/^(passage|text)=/i, "");
    const cleaned = value ? cleanWikitext(value) : "";
    return cleaned.length > 10 && cleaned.length <= 500 ? [cleaned] : [];
  });

  return {
    pronunciation,
    definitions: [...new Set(definitions)],
    examples: [...new Set(examples)],
  };
}

async function lookupWiktionary(term: string) {
  try {
    const url = new URL("https://en.wiktionary.org/w/api.php");
    url.searchParams.set("action", "parse");
    url.searchParams.set("page", term.replace(/\s+/g, "_"));
    url.searchParams.set("prop", "wikitext");
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { pronunciation: "", definitions: [], examples: [] };

    const payload = (await response.json()) as WiktionaryResponse;
    return extractWiktionaryData(payload.parse?.wikitext?.["*"] ?? "");
  } catch {
    return { pronunciation: "", definitions: [], examples: [] };
  }
}

async function lookupComponentPronunciation(term: string) {
  const components = term.split(/\s+/).filter(Boolean);
  if (components.length < 2) return "";

  const pronunciations = await Promise.all(components.map(async (component) => {
    const dictionaryEntriesPromise = lookupDictionaryApi(component);
    const wiktionary = await lookupWiktionary(component);
    if (wiktionary.pronunciation) return `${component} ${wiktionary.pronunciation}`;

    const dictionaryEntries = await dictionaryEntriesPromise;
    const dictionaryPronunciation = dictionaryEntries.find((entry) => entry.phonetic)?.phonetic
      ?? dictionaryEntries.flatMap((entry) => entry.phonetics ?? []).find((phonetic) => phonetic.text)?.text;
    return dictionaryPronunciation ? `${component} ${dictionaryPronunciation}` : "";
  }));

  return pronunciations.every(Boolean) ? pronunciations.join(" · ") : "";
}

async function lookupKoreanMeaning(term: string) {
  const deepLKey = process.env.DEEPL_API_KEY;
  if (deepLKey) {
    try {
      const response = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${deepLKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [term], source_lang: "EN", target_lang: "KO" }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const payload = (await response.json()) as { translations?: { text?: string }[] };
        const translation = payload.translations?.[0]?.text?.trim() ?? "";
        if (translation && normalizeTerm(translation) !== normalizeTerm(term)) return translation;
      }
    } catch {
      // Use the public translation fallback below when DeepL is unavailable.
    }
  }

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", term);
    url.searchParams.set("langpair", "en|ko");
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return "";

    const payload = (await response.json()) as { responseData?: { translatedText?: string } };
    const translation = payload.responseData?.translatedText?.trim() ?? "";
    return normalizeTerm(translation) === normalizeTerm(term) ? "" : translation;
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("word")?.trim().replace(/\s+/g, " ") ?? "";
  if (!term) {
    return Response.json({ error: "검색할 단어나 구동사를 입력해 주세요." }, { status: 400 });
  }
  if (term.length > 100) {
    return Response.json({ error: "검색어는 100자 이내로 입력해 주세요." }, { status: 400 });
  }

  const [dictionaryEntries, datamuseDefinitions, wiktionary, koreanMeaning, componentPronunciation] = await Promise.all([
    term.includes(" ") ? Promise.resolve([]) : lookupDictionaryApi(term),
    lookupDatamuse(term),
    lookupWiktionary(term),
    lookupKoreanMeaning(term),
    term.includes(" ") ? lookupComponentPronunciation(term) : Promise.resolve(""),
  ]);

  const dictionaryDefinitions = dictionaryEntries
    .flatMap((entry) => entry.meanings ?? [])
    .flatMap((meaning) => meaning.definitions ?? []);
  const definitions = dictionaryDefinitions.map((definition) => definition.definition?.trim() ?? "").filter(Boolean);
  const meaning = koreanMeaning || definitions[0] || datamuseDefinitions[0] || wiktionary.definitions[0] || "";
  const directPronunciation = dictionaryEntries.find((entry) => entry.phonetic)?.phonetic
    ?? dictionaryEntries.flatMap((entry) => entry.phonetics ?? []).find((phonetic) => phonetic.text)?.text
    ?? wiktionary.pronunciation;
  const pronunciation = directPronunciation || componentPronunciation;
  const examples = [
    ...dictionaryDefinitions.map((definition) => definition.example?.trim() ?? "").filter(Boolean),
    ...wiktionary.examples,
  ];
  const example = [...new Set(examples)].slice(0, 2).join("\n\n");

  if (!meaning && !pronunciation && !example) {
    return Response.json({ error: "사전에서 이 단어 또는 구동사를 찾지 못했습니다. 직접 입력해 주세요." }, { status: 404 });
  }

  return Response.json({ pronunciation: pronunciation ?? "", meaning, example });
}
