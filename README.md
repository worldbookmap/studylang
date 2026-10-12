# StudyLang

Next.js 기반 영어 단어/문장 패턴 암기 웹앱입니다. 앱 데이터는 Supabase에 저장하고, GitHub는 코드 관리와 Vercel 배포에 사용합니다. 콜리/뱁찌 선택은 기존처럼 브라우저 `localStorage`에 유지됩니다.

## 주요 기능

- 단어와 문장 패턴 입력, 발음기호 자동 조회
- 랜덤 퀴즈와 복습 완료 기록
- 월간 공부 달력
- 전체 목록 검색, 복습, 삭제
- 저녁 7시 브라우저 알림과 앱 안 리마인드

## Supabase 설정

Supabase Dashboard의 SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행한 뒤, 로컬 `.env.local`과 Vercel Project Settings에 아래 서버 환경변수를 설정하세요.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEEPL_API_KEY=your-deepl-api-key
```

서비스 키는 서버에서만 사용하며 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 코드에 넣으면 안 됩니다. 사용자 선택 키 `studylang_user`와 기존 콜리/뱁찌 UI는 그대로 유지되고, API가 그 프로필로 데이터를 분리합니다.

DeepL API Free 키도 `DEEPL_API_KEY`라는 이름으로 로컬 `.env.local`과 Vercel Project Settings의 Environment Variables에 설정하세요. 이 키는 클라이언트로 전달하지 않습니다. 영어 문장 또는 쉐도잉 표현 입력 후 입력란에서 포커스를 옮기면 한국어 뜻이 자동으로 채워지며, 이미 한국어 메모가 있으면 덮어쓰지 않습니다. DeepL 키가 없거나 무료 사용량을 초과하면 입력 폼에 오류가 표시됩니다. 현재 앱은 로그인 없이 공개되어 있으므로 번역 API를 외부에서 직접 호출해 무료 사용량을 소진할 수 있습니다. 공개 운영 전 요청 제한 또는 인증을 추가하세요.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 배포

GitHub 저장소를 Vercel에 연결한 뒤 위 환경변수를 Vercel Project Settings에 등록하고 배포하세요.

## GitHub JSON에서 Supabase로 이관

아래 도구는 GitHub JSON 두 파일의 자료를 Supabase `entries` 테이블로 복사합니다. 기본 실행은 미리보기이며, 실제 쓰기는 `--apply`를 지정해야 합니다. GitHub 원본 읽기에 필요한 환경변수도 `.env.local`에 추가하세요. 공개 저장소라면 `GITHUB_TOKEN`은 생략하는 편이 좋고, 비공개 저장소라면 유효한 토큰과 Contents 읽기 권한이 필요합니다.

### 이전 Auth SQL을 이미 실행한 경우

이전에 `owner_id`가 `auth.users`를 참조하는 SQL을 실행했다면, 데이터 import를 하기 전에 Supabase SQL Editor에서 [`supabase/migrate-localstorage-profiles.sql`](supabase/migrate-localstorage-profiles.sql)을 실행하세요. 이 변환은 기존 테이블을 삭제하지 않고 localStorage 프로필용 `profile_id`를 추가합니다. `entries`가 비어 있지 않으면 SQL이 오류로 중단되므로, 그 경우 임의로 비우지 말고 기존 행의 사용자 매핑을 먼저 확인하세요. 새 Supabase 프로젝트라면 [`supabase/schema.sql`](supabase/schema.sql)만 실행하면 됩니다.

### 가져오기

1. Supabase `entries`가 준비된 뒤, 로컬 `.env.local`에 Supabase와 GitHub 원본 설정을 둡니다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 앞 설정 절의 값을 사용합니다.

```bash
# 공개 저장소면 생략 가능. 비공개 저장소만 유효한 읽기 토큰 필요
GITHUB_TOKEN=github_pat_your_token
GITHUB_OWNER=worldbookmap
GITHUB_REPO=studylang
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/study.json
```

2. 최신 GitHub 원본 기준으로 미리보기를 실행합니다. 작업 트리의 로컬 JSON을 원본으로 쓰려면 `--source=local`을 붙입니다.

```bash
node --env-file=.env.local scripts/migrate-json-to-supabase.mjs
```

3. 콜리/뱁찌별 건수가 예상과 일치하면 실제 이관을 실행합니다.

```bash
node --env-file=.env.local scripts/migrate-json-to-supabase.mjs --apply
```

같은 명령은 원본 UUID를 기준으로 upsert하므로 재실행해도 중복 행을 만들지 않습니다. 다른 로컬 JSON 사본을 원본으로 삼으려면 `--source=local`을 사용하세요. 현재 로컬 파일 기준 예상 건수는 콜리 23개, 뱁찌 39개입니다. 이관 후에도 원본 JSON 파일은 백업으로 남겨 두세요.

## 접근 범위 주의

localStorage 프로필 선택은 사용자 경험을 위한 선택값이지 로그인이나 인증이 아닙니다. 현재 구조는 앱의 서버 API를 통해 콜리/뱁찌 자료를 나누지만, API URL을 아는 방문자가 `user=colly` 또는 `user=baebjji`로 요청할 수 있습니다. 브라우저에서 각 사용자의 데이터가 보이지 않도록 보안 경계를 만들려면 Supabase Auth 로그인을 추가해야 합니다.
