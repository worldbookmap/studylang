# StudyLang

Next.js 기반 영어 단어/문장 패턴 암기 웹앱입니다. 데이터는 브라우저 로컬 저장소가 아니라 GitHub 저장소의 JSON 파일에 저장됩니다.

## 주요 기능

- 단어와 문장 패턴 입력, 발음기호 자동 조회
- 랜덤 퀴즈와 복습 완료 기록
- 월간 공부 달력
- 전체 목록 검색, 복습, 삭제
- 저녁 7시 브라우저 알림과 앱 안 리마인드

## GitHub JSON 데이터베이스 설정

Vercel 프로젝트 환경변수에 아래 값을 설정하세요.

```bash
GITHUB_TOKEN=github_pat_your_token
GITHUB_OWNER=worldbookmap
GITHUB_REPO=studylang
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/study.json
```

`GITHUB_TOKEN`은 저장소 Contents 읽기/쓰기 권한이 있는 fine-grained token을 권장합니다. `data/study.json` 파일이 없어도 첫 저장 시 자동으로 생성됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 배포

GitHub 저장소를 Vercel에 연결한 뒤 위 환경변수를 Vercel Project Settings에 등록하고 배포하세요.
