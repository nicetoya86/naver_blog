# n8n 설정 가이드 — naver-blog-shopping-connect

## module-1: naver-blog-monitor-alert

### 1. 워크플로우 Import

`n8n/workflows/naver-blog-monitor-alert.json`을 n8n UI에서 Import.

### 2. Credentials 등록

| Credential | 종류 | 용도 |
|---|---|---|
| `telegram-naver-blog` | Telegram API | 급락 알림 발송 (텔레그램 노드가 사용) |

Telegram Bot 생성: [@BotFather](https://t.me/BotFather)에서 `/newbot`으로 토큰 발급 → 알림 받을 채팅방에 봇 초대 후 chat ID 확인(예: `https://api.telegram.org/bot<TOKEN>/getUpdates` 호출로 확인) → n8n Credentials에 Token/Chat ID 등록.

### 3. Execute Command 노드 환경변수

"Run Stats Script" 노드가 `node n8n/scripts/naver-stats.playwright.js`를 실행할 때 다음 환경변수가 필요하다. n8n이 실행되는 서버의 환경변수로 설정하거나, n8n Execute Command 노드의 Environment Variables 옵션에 등록한다.

| 변수 | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | 자동화 전용 네이버 계정 (Plan §8.3 — 평문 저장 금지, 서버 secret 관리 사용) |
| `NAVER_BLOG_ID` | 통계를 조회할 블로그 ID |

### 4. Playwright 설치 (n8n 실행 서버 기준)

```bash
npm install playwright
npx playwright install chromium
```

### 5. 셀렉터 검증 (필수, 1회)

`n8n/scripts/naver-stats.playwright.js`의 통계 페이지 셀렉터(`[data-stat="today-visitors"]` 등)는 플레이스홀더다. 실제 네이버 통계 페이지(`admin.blog.naver.com/{blogId}/home/visitstat`)에 로그인해 개발자 도구로 실제 DOM 구조를 확인하고 셀렉터를 교체해야 동작한다. 이 검증 전까지는 `STATS_FETCH_FAIL`로 처리되어 알림만 발송되고 `emergencyBrake`는 변경되지 않는다(Design §6.1 — 오탐 방지).

### 6. 동작 확인

1. n8n에서 워크플로우 수동 실행(Execute Workflow)
2. "Run Stats Script" 노드 출력에 `{"date":..., "visitors":N, "searchInflow":N}` 형태 JSON 확인
3. 전일 데이터가 없는 첫 실행은 `isCritical: false`가 정상(비교 대상 없음)
4. 급락 시나리오 테스트: n8n Static Data(`$getWorkflowStaticData`)를 수동으로 `lastStats.visitors`를 오늘 값의 2배로 편집 후 재실행 → 텔레그램 알림 수신 + `emergencyBrake: true` 저장 확인

---

## module-2,3: naver-blog-daily-publish

### 1. 워크플로우 Import

`n8n/workflows/naver-blog-daily-publish.json`을 n8n UI에서 Import.

### 2. Credentials 등록

| Credential | 종류 | 용도 |
|---|---|---|
| `gemini-naver-blog` | HTTP Header Auth 또는 Custom | Gemini API 키(`geminiApi.apiKey`) |
| `nim-naver-blog` | HTTP Header Auth 또는 Custom | NVIDIA NIM API 키(`nimApi.apiKey`) |
| `telegram-naver-blog` | Telegram API | 체크리스트 탈락 알림 (module-1과 동일 Credential 재사용) |

n8n 노드 파라미터의 `$credentials.geminiApi.apiKey`, `$credentials.nimApi.apiKey`는 각각 "HTTP Request" 노드에 Credential을 연결한 뒤 Credential 타입에 맞는 필드명으로 교체 필요(n8n 버전에 따라 Generic Credential Type 설정 방식이 다름).

### 3. Execute Command 환경변수

"Playwright 발행" 노드 실행 시 필요:

| 변수 | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | module-1과 동일 자동화 전용 계정 |
| `NAVER_BLOG_ID` | 발행 대상 블로그 ID |

### 4. 키워드 풀 초기화 (필수, 1회)

`키워드 수집` 노드는 Static Data(`keywordPool`)에서 순차로 꺼내 쓴다. n8n UI에서 워크플로우 설정 → Static Data를 열고 최초 1회 아래처럼 채워야 한다(운영 중 소진되면 보충):

```json
{ "keywordPool": ["키워드1", "키워드2", "키워드3"] }
```

업그레이드 경로: 네이버 데이터랩/자동완성 자동 수집 노드로 교체(현재는 수동 큐 — YAGNI, §4.1 코드 주석 참조).

### 5. 실제 연동 전 TODO (이번 세션 범위 밖, 명시적으로 미구현)

- `naver-publish.playwright.js`: 스마트에디터 ONE의 실제 제목/본문/이미지/발행버튼 셀렉터 — 현재는 플레이스홀더, 1회 수동 검증 필요
- 체크리스트의 "타 사이트 문장 유사도" 검사 — 외부 표절 검사 API(예: Copyscape) 연동 필요, 현재는 항상 통과 처리
- **NIM 이미지 생성 엔드포인트 (필수, go-live 전)**: 워크플로우의 "NIM 이미지 생성 (TODO: 엔드포인트 검증 필요)" 노드 URL(`ai.api.nvidia.com/v1/genai/qwen/qwen-image`)은 추정값이다. NVIDIA NIM 콘솔에서 Qwen-Image 모델의 실제 엔드포인트/요청 스키마를 확인 후 교체할 것 — 미교체 시 발행이 전부 실패한다.
- `제휴비중 게이트` 노드는 플래그만 결정하며, 실제 상품 링크/이미지 삽입은 쇼핑커넥트 연동 후 구현(§module-4 참조)

### 6. Code 노드 Node.js 내장 모듈 허용 설정 (필수)

"콘텐츠 임시저장" 노드가 `fs`/`os`/`path`를 사용한다. self-hosted n8n은 기본적으로 Code 노드에서 Node.js 내장 모듈 사용이 제한되어 있으므로, n8n 실행 환경변수에 다음을 추가해야 한다:

```
NODE_FUNCTION_ALLOW_BUILTIN=fs,os,path
```

(n8n Cloud 사용 시 이 설정이 지원되지 않을 수 있음 — 별도 저장소 노드로 대체 필요)

### 6. 동작 확인

1. keywordPool 채운 뒤 워크플로우 수동 실행
2. Gemini/NIM 노드 응답에 실제 본문/이미지 URL이 오는지 확인
3. 체크리스트 노드 출력의 `checks`, `passed` 값 확인
4. `emergencyBrake`/`lastPublishedDate`를 Static Data에서 강제로 설정해 각 IF 분기가 올바르게 중단되는지 확인

---

## module-4: 로드맵 게이트 (affiliateRatio)

### 1. 로드맵 단계 전환 (운영자 수동 조작)

`naver-blog-daily-publish` 워크플로우의 Static Data에서 `roadmapPhase` 값을 게이트 통과 시 직접 편집한다(Plan §로드맵 로드맵 테이블, Design §5.2 User Flow 참조).

| roadmapPhase 값 | affiliateRatio(자동 계산) |
|---|---|
| `준비기` | 0% |
| `지수성장기` (기본값) | 0% |
| `최적화진입` | 20% |
| `운영` | 35% |

n8n UI → 워크플로우 설정 → Static Data에서:

```json
{ "roadmapPhase": "최적화진입" }
```

### 2. 현재 구현 범위

"제휴비중 게이트" Code 노드가 `roadmapPhase`를 읽어 `affiliateRatio` 확률로 `isAffiliatePost` 플래그를 결정하고, Playwright 발행 스크립트에 인자로 전달한다. **쇼핑 커넥트가 아직 미연동 상태라 실제 상품 링크/이미지 삽입은 구현하지 않았다** — `isAffiliatePost=true`여도 현재는 플래그만 전달되고 본문은 동일하게 생성된다.

### 3. 다음 단계 (쇼핑 커넥트 연동 후)

1. 쇼핑 커넥트 승인 완료
2. `naver-publish.playwright.js`의 TODO(제휴비중 게이트 — module-4 주석) 부분에서 `isAffiliatePost` 분기로 셀러 제공 이미지/링크 삽입 구현
3. Gemini 본문 생성 프롬프트도 `isAffiliatePost`에 따라 후기·추천형 어투로 분기(현재는 정보성 프롬프트 고정)

Design 참조: [naver-blog-shopping-connect.design.md](../docs/02-design/features/naver-blog-shopping-connect.design.md)
