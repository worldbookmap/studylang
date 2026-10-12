import { NextRequest } from "next/server";

type DeepLResponse = {
  translations?: { text?: string }[];
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "DEEPL_API_KEY 환경변수가 설정되지 않았습니다." }, { status: 503 });
  }

  let text: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "번역할 문장을 확인할 수 없습니다." }, { status: 400 });
  }

  if (!text || text.length > 5000) {
    return Response.json({ error: "번역할 문장은 1자 이상 5,000자 이하여야 합니다." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text], source_lang: "EN", target_lang: "KO" }),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = response.status === 456
        ? "DeepL 무료 API 월간 사용량을 초과했습니다."
        : response.status === 403
          ? "DeepL API 키를 확인할 수 없습니다."
          : "DeepL 번역 요청에 실패했습니다.";
      return Response.json({ error }, { status: response.status === 456 ? 429 : 502 });
    }

    const payload = (await response.json()) as DeepLResponse;
    const translation = payload.translations?.[0]?.text?.trim();
    if (!translation) {
      return Response.json({ error: "DeepL에서 번역 결과를 받지 못했습니다." }, { status: 502 });
    }

    return Response.json({ translation });
  } catch {
    return Response.json({ error: "DeepL에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}