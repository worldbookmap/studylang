import { StudyDatabase, StudyEntry } from "@/lib/types";

const DEFAULT_DATA_PATH = "data/study.json";
const API_VERSION = "2022-11-28";

class GithubStoreError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

type GithubContentResponse = {
  content: string;
  encoding: "base64";
  sha: string;
};

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  const path = process.env.GITHUB_DATA_PATH ?? DEFAULT_DATA_PATH;

  if (!token || !owner || !repo) {
    throw new GithubStoreError(
      "GitHub 저장소 연동을 위해 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO 환경변수가 필요합니다.",
      503,
    );
  }

  return { token, owner, repo, branch, path };
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
  };
}

function encodeDatabase(database: StudyDatabase) {
  return Buffer.from(JSON.stringify(database, null, 2)).toString("base64");
}

function decodeDatabase(content: string): StudyDatabase {
  const decoded = Buffer.from(content, "base64").toString("utf8");
  const parsed = JSON.parse(decoded) as StudyDatabase;

  return {
    version: 1,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
}

export async function readStudyDatabase(): Promise<{ database: StudyDatabase; sha?: string }> {
  const config = getGithubConfig();
  const url = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
  );
  url.searchParams.set("ref", config.branch);

  const response = await fetch(url, {
    headers: githubHeaders(config.token),
    cache: "no-store",
  });

  if (response.status === 404) {
    return { database: { version: 1, entries: [] } };
  }

  if (!response.ok) {
    throw new GithubStoreError("GitHub JSON 데이터베이스를 읽지 못했습니다.", response.status);
  }

  const payload = (await response.json()) as GithubContentResponse;
  return { database: decodeDatabase(payload.content), sha: payload.sha };
}

export async function writeStudyDatabase(entries: StudyEntry[], sha?: string) {
  const config = getGithubConfig();
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const database: StudyDatabase = { version: 1, entries };

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(config.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Update study language database",
      content: encodeDatabase(database),
      branch: config.branch,
      sha,
    }),
  });

  if (!response.ok) {
    throw new GithubStoreError("GitHub JSON 데이터베이스를 저장하지 못했습니다.", response.status);
  }

  return database;
}

export function githubErrorResponse(error: unknown) {
  if (error instanceof GithubStoreError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "알 수 없는 서버 오류가 발생했습니다." }, { status: 500 });
}
