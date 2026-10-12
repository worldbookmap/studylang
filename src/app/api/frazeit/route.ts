import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PHRASE_KEYS = new Set(["phrase", "sentence", "example", "text", "phrasetext"]);

function cleanPhrase(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function collectJsonPhrases(value: unknown, phrases: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonPhrases(item, phrases);
    return phrases;
  }

  if (typeof value !== "object" || value === null) return phrases;

  for (const [key, item] of Object.entries(value)) {
    if (PHRASE_KEYS.has(key.toLowerCase()) && typeof item === "string") {
      const phrase = cleanPhrase(item);
      if (phrase) phrases.push(phrase);
    } else if (typeof item === "object" && item !== null) {
      collectJsonPhrases(item, phrases);
    }
  }

  return phrases;
}

function extractPhrases(body: string, contentType: string) {
  if (contentType.includes("json") || /^[\s]*[\[{]/.test(body)) {
    try {
      const phrases = collectJsonPhrases(JSON.parse(body));
      if (phrases.length) return phrases;
    } catch {
      // Fall through to XML extraction for providers with a mismatched content type.
    }
  }

  const phrases: string[] = [];
  const phraseElement = /<(phrase|sentence|example|text)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of body.matchAll(phraseElement)) {
    const phrase = cleanPhrase(match[2]);
    if (phrase) phrases.push(phrase);
  }
  return phrases;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (!query || query.length > 100) {
    return Response.json({ error: "검색어는 1자 이상 100자 이하여야 합니다." }, { status: 400 });
  }

  const apiKey = process.env.FRAZEIT_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "Fraze.it API 키를 FRAZEIT_API_KEY 환경변수에 설정해 주세요." }, { status: 503 });
  }

  const apiUrl = [
    "https://fraze.it/api/phrase",
    encodeURIComponent(query),
    "en",
    "1",
    "no",
    encodeURIComponent(apiKey),
  ].join("/");

  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json, application/xml;q=0.9, text/xml;q=0.8" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "Fraze.it API 키를 확인할 수 없습니다."
        : response.status === 429
          ? "Fraze.it API 요청 한도에 도달했습니다."
          : `Fraze.it 예문 조회에 실패했습니다 (HTTP ${response.status}).`;
      return Response.json({ error: message }, {
        status: response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 502 : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const body = await response.text();
    const phrases = [...new Set(extractPhrases(body, response.headers.get("content-type") ?? ""))].slice(0, 10);

    return Response.json({ phrases }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Fraze.it API에 연결하지 못했습니다." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}