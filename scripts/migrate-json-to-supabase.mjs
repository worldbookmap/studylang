import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const users = ["colly", "baebjji"];
const retiredTypes = new Set(["contraction", "dialogue"]);
const allowedTypes = new Set(["word", "pattern", "shadowing"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shouldApply = process.argv.includes("--apply");
const source = process.argv.find((argument) => argument.startsWith("--source="))?.split("=")[1] ?? "github";

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`필수 환경변수가 설정되지 않았습니다: ${name}`);
  }
  return value;
}

function getGithubPath(user) {
  const basePath = process.env.GITHUB_DATA_PATH ?? "data/study.json";
  const extension = path.posix.extname(basePath);
  const name = basePath.slice(0, basePath.length - extension.length);
  return `${name}-${user}${extension || ".json"}`;
}

async function readGithubDatabase(user) {
  const owner = requireEnvironment("GITHUB_OWNER");
  const repository = requireEnvironment("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH ?? "main";
  const token = process.env.GITHUB_TOKEN;
  const githubPath = getGithubPath(user).split("/").map(encodeURIComponent).join("/");
  const url = new URL(`https://api.github.com/repos/${owner}/${repository}/contents/${githubPath}`);
  url.searchParams.set("ref", branch);

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(url, { headers, cache: "no-store" });
  if (response.status === 401 && token) {
    console.warn("GitHub 토큰 인증에 실패했습니다. 공개 저장소인지 확인하기 위해 토큰 없이 다시 시도합니다.");
    delete headers.Authorization;
    response = await fetch(url, { headers, cache: "no-store" });
  }

  if (!response.ok) {
    const hint = response.status === 404
      ? "저장소가 비공개라면 유효한 GITHUB_TOKEN과 Contents 읽기 권한이 필요합니다."
      : "GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_DATA_PATH 설정과 GitHub 토큰을 확인하세요.";
    throw new Error(`GitHub 원본을 읽지 못했습니다 (${user}, HTTP ${response.status}). ${hint}`);
  }

  const payload = await response.json();
  if (payload.encoding !== "base64" || typeof payload.content !== "string") {
    throw new Error(`GitHub 원본 JSON 형식을 확인할 수 없습니다 (${user}).`);
  }

  return JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
}

async function readLocalDatabase(user) {
  const filePath = path.join(projectDirectory, "data", `study-${user}.json`);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function toDatabaseRows(database, user) {
  if (!Array.isArray(database.entries)) {
    throw new Error(`${user}의 JSON에 entries 배열이 없습니다.`);
  }

  return database.entries
    .filter((entry) => !retiredTypes.has(entry.type))
    .map((entry) => {
      if (!allowedTypes.has(entry.type)) {
        throw new Error(`${user} 자료 ${entry.id}의 유형을 지원하지 않습니다: ${entry.type}`);
      }
      if (!uuidPattern.test(entry.id)) {
        throw new Error(`${user} 자료의 id가 UUID가 아닙니다: ${entry.id}`);
      }
      if (!entry.english || !entry.korean || !entry.createdAt) {
        throw new Error(`${user} 자료 ${entry.id}에 필수 필드가 없습니다.`);
      }

      return {
        id: entry.id,
        profile_id: user,
        type: entry.type,
        english: entry.english,
        korean: entry.korean,
        pronunciation: entry.pronunciation || null,
        example: entry.example || null,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        created_at: entry.createdAt,
        reviewed_at: entry.reviewedAt || null,
      };
    });
}

async function writeRows(rows, supabaseUrl, serviceRoleKey) {
  const endpoint = new URL("/rest/v1/entries", supabaseUrl);
  endpoint.searchParams.set("on_conflict", "id");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase 저장 실패 (HTTP ${response.status}): ${details}`);
  }

  return response.json();
}

async function main() {
  if (source !== "github" && source !== "local") {
    throw new Error("--source 값은 github 또는 local이어야 합니다.");
  }

  const supabaseUrl = shouldApply ? requireEnvironment("SUPABASE_URL") : "";
  const serviceRoleKey = shouldApply ? requireEnvironment("SUPABASE_SERVICE_ROLE_KEY") : "";
  const allRows = [];
  const seenIds = new Set();
  const summary = [];

  for (const user of users) {
    const database = source === "github"
      ? await readGithubDatabase(user)
      : await readLocalDatabase(user);
    const rows = toDatabaseRows(database, user);
    for (const row of rows) {
      if (seenIds.has(row.id)) {
        throw new Error(`두 JSON 파일에서 중복된 자료 ID가 발견됐습니다: ${row.id}`);
      }
      seenIds.add(row.id);
    }
    allRows.push(...rows);
    summary.push({ user, count: rows.length });
  }

  for (const { user, count } of summary) {
    console.log(`${user}: ${count}개`);
  }
  console.log(`합계: ${allRows.length}개 (원본 UUID와 날짜 유지)`);

  if (!shouldApply) {
    console.log("미리보기만 실행했습니다. 실제 저장은 --apply 옵션을 추가하세요.");
    return;
  }

  const savedRows = await writeRows(allRows, supabaseUrl, serviceRoleKey);
  console.log(`Supabase에 ${savedRows.length}개 자료를 upsert했습니다.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "이관에 실패했습니다.");
  process.exitCode = 1;
});