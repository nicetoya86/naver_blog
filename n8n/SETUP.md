# n8n 설정 가이드 — naver-blog-shopping-connect

## module-1: naver-blog-monitor-alert

### 1. 워크플로우 Import

`n8n/workflows/naver-blog-monitor-alert.json`을 n8n UI에서 Import.

### 2. Credentials 등록

| Credential | 종류 | 용도 |
|---|---|---|
| `telegram-naver-blog` | Telegram API | 급락 알림 발송 (텔레그램 노드가 사용) |

Telegram Bot 생성: [@BotFather](https://t.me/BotFather)에서 `/newbot`으로 토큰 발급 → 알림 받을 채팅방에 봇 초대 후 chat ID 확인(예: `https://api.telegram.org/bot<TOKEN>/getUpdates` 호출로 확인) → n8n Credentials에 Token 등록.

**주의**: Telegram credential에는 Bot Token만 저장되고 chat ID 필드는 없다. 워크플로우의 Telegram 노드들은 `chatId`를 `$env.TELEGRAM_CHAT_ID` 환경변수에서 읽으므로, 아래 §3에 `TELEGRAM_CHAT_ID`를 반드시 함께 등록해야 한다.

### 3. Execute Command 노드 환경변수

"Run Stats Script" 노드가 `node "$PROJECT_ROOT/n8n/scripts/naver-stats.playwright.js"`를 실행할 때 다음 환경변수가 필요하다. n8n이 실행되는 서버의 환경변수로 설정하거나, n8n Execute Command 노드의 Environment Variables 옵션에 등록한다.

| 변수 | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | 자동화 전용 네이버 계정 (Plan §8.3 — 평문 저장 금지, 서버 secret 관리 사용) |
| `NAVER_BLOG_ID` | 통계를 조회할 블로그 ID |
| `PROJECT_ROOT` | 이 저장소(`naver_blog`)의 n8n 실행 서버 기준 절대 경로 — Execute Command가 n8n 프로세스 작업 디렉터리에 상관없이 스크립트를 찾도록 함 |
| `TELEGRAM_CHAT_ID` | 알림을 받을 텔레그램 chat ID (module-1, module-2,3 공통 사용) |

### 3.1 Code 노드 Node.js 내장 모듈 허용 설정 (필수)

"긴급브레이크 ON" 노드가 `fs`/`os`/`path`로 daily-publish 워크플로우와 공유하는 상태 파일(`$PROJECT_ROOT/.n8n-shared-state.json`, `PROJECT_ROOT` 미설정 시 OS temp 디렉터리로 폴백)을 기록한다. module-2,3과 마찬가지로 n8n 실행 환경변수에 다음이 필요하다:

```
NODE_FUNCTION_ALLOW_BUILTIN=fs,os,path
```

두 워크플로우가 서로 다른 서버/컨테이너에서 실행되면 이 파일 공유가 동작하지 않는다 — 반드시 같은 n8n 인스턴스(같은 파일시스템)에서 실행할 것. OS temp로 폴백되면 재부팅/temp 정리 시 긴급브레이크가 조용히 풀릴 수 있으니 `PROJECT_ROOT`를 반드시 설정할 것.

### 3.2 n8n 플랫폼 설정 (필수, n8n 버전에 따라)

Code 노드의 `$env` 접근과 Execute Command 노드는 n8n 버전/배포 방식에 따라 기본 차단될 수 있다. self-hosted n8n 실행 환경변수에 다음을 확인·추가할 것:

```
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Execute Command 노드가 목록에서 비활성화되어 있다면(`NODES_EXCLUDE` 설정 등) 제외 목록에서 빼야 한다. (n8n Cloud는 Execute Command 노드 자체를 지원하지 않을 수 있음 — self-hosted 전제.)

### 4. Playwright 설치 (n8n 실행 서버 기준)

```bash
npm install playwright
npx playwright install chromium
```

### 5. 셀렉터 검증 (필수, 1회)

`n8n/scripts/naver-stats.playwright.js`의 통계 페이지 셀렉터(`[data-stat="today-visitors"]` 등)는 플레이스홀더다. 실제 네이버 통계 페이지(`admin.blog.naver.com/{blogId}/home/visitstat`)에 로그인해 개발자 도구로 실제 DOM 구조를 확인하고 셀렉터를 교체해야 동작한다. 이 검증 전까지는 스크립트가 `STATS_FETCH_FAIL`로 exit 1 하고, "실행 실패?" 분기가 텔레그램으로 알린 뒤 중단한다(Design §6.1). `emergencyBrake`는 이 경로에서 변경되지 않는다(오탐 방지).

### 6. 동작 확인

1. n8n에서 워크플로우 수동 실행(Execute Workflow)
2. "Run Stats Script" 노드 출력에 `{"date":..., "visitors":N, "searchInflow":N}` 형태 JSON 확인
3. 전일 데이터가 없는 첫 실행은 `isCritical: false`가 정상(비교 대상 없음)
4. 급락 시나리오 테스트: n8n Static Data(`$getWorkflowStaticData`)를 수동으로 `lastStats.visitors`를 오늘 값의 2배로 편집 후 재실행 → 텔레그램 알림 수신 + `emergencyBrake: true` 저장 확인
5. 긴급브레이크 전파 확인(daily-publish와 공유): 4번 실행 후 `$PROJECT_ROOT/.n8n-shared-state.json`에 `{"emergencyBrake":true}`가 기록됐는지 확인 → daily-publish를 수동 실행해 "긴급브레이크 확인" 분기에서 중단되는지 확인. 수동 해제는 이 파일의 `emergencyBrake`를 `false`로 고치거나 파일을 삭제하면 된다(운영 중 재개 절차).
6. 스크립트 실패 알림 테스트: `NAVER_ID`를 일부러 틀리게 설정하고 실행 → `LOGIN_FAIL`로 exit 1 → "텔레그램: 통계 수집 실패 알림" 수신 확인(`Run Stats Script`에 `continueOnFail: true`가 설정돼 있어 실패해도 워크플로우가 이어서 분기 처리함).

**Known Gap**: n8n 버전에 따라 `continueOnFail` 시 실패 아이템의 에러 필드 모양(`$json.error`)이 다를 수 있다(확인 필요, SETUP.md 작성 시점 미검증). 위 6번으로 반드시 실제 환경에서 확인할 것. daily-publish 쪽 Execute Command(Gemini/NIM/Playwright 발행)는 아직 동일한 실패 알림 분기가 없다 — 필요시 같은 패턴으로 추가.

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

두 HTTP Request 노드("Gemini 본문 생성", "NIM 이미지 생성")는 n8n의 Generic Credential Type(`httpHeaderAuth`)을 쓰도록 구성돼 있다. n8n UI에서 각각 HTTP Header Auth credential을 만들고:
- `gemini-naver-blog`: Header Name `x-goog-api-key`, Header Value = 실제 Gemini API 키
- `nim-naver-blog`: Header Name `Authorization`, Header Value = `Bearer <실제 NIM API 키>`

만든 뒤 해당 HTTP Request 노드를 열어 Credential을 위 이름으로 연결(워크플로우 JSON의 `id: "TBD"`를 n8n UI에서 실제 credential로 교체, Telegram credential과 동일한 방식).

### 3. Execute Command 환경변수

"Playwright 발행" 노드 실행 시 필요:

| 변수 | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | module-1과 동일 자동화 전용 계정 |
| `NAVER_BLOG_ID` | 발행 대상 블로그 ID |
| `PROJECT_ROOT` | module-1과 동일(§3 참조) |
| `TELEGRAM_CHAT_ID` | module-1과 동일(§3 참조) — "텔레그램: 체크리스트 탈락 알림" 노드가 사용 |

### 4. 키워드 풀 초기화 (필수, 1회)

`키워드 수집` 노드는 Static Data(`keywordPool`)에서 순차로 꺼내 쓴다. n8n UI에서 워크플로우 설정 → Static Data를 열고 최초 1회 아래처럼 채워야 한다(운영 중 소진되면 보충):

```json
{ "keywordPool": ["키워드1", "키워드2", "키워드3"] }
```

업그레이드 경로: 네이버 데이터랩/자동완성 자동 수집 노드로 교체(현재는 수동 큐 — YAGNI, §4.1 코드 주석 참조).

### 5. 실제 연동 전 TODO (이번 세션 범위 밖, 명시적으로 미구현)

- `naver-publish.playwright.js`: 스마트에디터 ONE의 실제 제목/본문/이미지/발행버튼 셀렉터 — 현재는 플레이스홀더, 1회 수동 검증 필요. **검증 전까지 스크립트는 의도적으로 `PUBLISH_NOT_IMPLEMENTED` 에러로 exit 1 한다**(발행 안 된 글을 발행된 것으로 잘못 기록하는 사고 방지) — "Playwright 발행" 노드 실행이 실패하는 게 정상이다. 단, 키워드는 발행 성공 여부와 무관하게 "키워드 수집" 단계에서 먼저 소모되므로, 이 상태로 매일 실행하면 키워드 1개 + Gemini/NIM API 호출 비용이 매일 낭비된다 — 셀렉터 검증 전까지는 Cron을 꺼두거나 수동 실행만 할 것.
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
4. `lastPublishedDate`는 Static Data에서, `emergencyBrake`는 `$PROJECT_ROOT/.n8n-shared-state.json`에서 강제로 설정해 각 IF 분기가 올바르게 중단되는지 확인(module-1 §6 참조 — Static Data가 아님에 주의)

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
