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

### 3. Vercel API 호출 설정 (n8n Cloud는 Execute Command 미지원)

"Run Stats Script" 노드는 더 이상 Execute Command가 아니라 `vercel/api/stats.js`를 호출하는 HTTP Request 노드다. n8n UI에서 노드의 `url`을 실제 배포된 Vercel URL(`https://<your-project>.vercel.app/api/stats`)로 교체하고, `naver-automation-api` HTTP Header Auth credential을 Vercel 프로젝트의 `API_SECRET` 값으로 등록할 것.

| 변수(Vercel 프로젝트 환경변수) | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | 자동화 전용 네이버 계정 (Plan §8.3 — 평문 저장 금지) |
| `NAVER_BLOG_ID` | 통계를 조회할 블로그 ID |
| `API_SECRET` | n8n → Vercel 호출 인증용 공유 비밀키(n8n의 `naver-automation-api` credential과 동일 값) |
| `TELEGRAM_CHAT_ID` | 알림을 받을 텔레그램 chat ID (n8n 환경변수, module-1, module-2,3 공통 사용) |

### 3.1 emergencyBrake 공유 설정 (필수, Vercel Edge Config)

n8n Cloud는 Code 노드의 `fs`/`os`/`path` 접근도 차단하므로(Execute Command 미지원과 같은 샌드박스 정책), 기존에 썼던 "공유 파일(`$PROJECT_ROOT/.n8n-shared-state.json`)" 방식은 동작하지 않는다. 두 워크플로우 모두 "긴급브레이크 ON"/"공유상태 읽기" 노드가 `vercel/api/state.js`(새 엔드포인트, Vercel Edge Config 기반)를 HTTP Request로 호출하도록 바뀌었다. Vercel 프로젝트에서 1회 설정 필요:

1. Vercel 대시보드 → Storage → Edge Config 생성(최근 UI에서는 "Global Config"로 표시되기도 함, 같은 기능) → 이 프로젝트에 Connect(자동으로 `EDGE_CONFIG` 또는 `GLOBAL_CONFIG` 환경변수가 주입됨 — `vercel/lib/edgeConfig.js`가 둘 다 인식하므로 이름은 신경 쓰지 않아도 됨)
2. Vercel 대시보드 → Settings → Tokens에서 API 토큰 발급(계정 전체 쓰기 권한) → 프로젝트 환경변수에 `VERCEL_API_TOKEN`으로 등록
3. 생성된 Edge/Global Config의 ID(URL의 `ecfg_...`)를 프로젝트 환경변수 `EDGE_CONFIG_ID`로 등록
4. 팀(Team) 계정에서 만들었다면 `VERCEL_TEAM_ID`도 등록(개인 Hobby 계정이면 불필요)
5. 두 n8n 워크플로우의 "공유상태 읽기"/"긴급브레이크 ON" 노드 `url`을 실제 Vercel URL(`.../api/state`)로 교체

### 4. Playwright 설치

Vercel 배포 시 `vercel/package.json`의 `playwright-core`/`@sparticuz/chromium`이 자동 설치된다 — 별도 설치 불필요.

### 5. 셀렉터 검증 (2026-11-11 완료)

실제 통계 페이지(`admin.blog.naver.com/{blogId}/stat/uv`, `/stat/referer`)와 에디터(제목/본문/이미지업로드/카테고리/발행버튼) 선택자는 aside로 읽기 전용 DOM 조사를 완료해 `vercel/api/stats.js`, `vercel/api/publish.js`에 반영했다. 발행은 더 이상 `PUBLISH_NOT_IMPLEMENTED`로 중단하지 않고 실제 클릭(제목 입력→본문 입력→이미지 업로드→발행 패널→발행 버튼)까지 구현돼 있다. 단 아직 미해결:
- `/home/visitstat` 경로 자체가 없어졌고, 새 통계 페이지에선 "검색 유입"이 절대 건수가 아니라 유입경로 중 검색 비중(%)으로만 노출된다 — 급락 판정 로직(day-over-day dropRate)은 구조적으로 그대로 동작하지만 "유입 건수 급락"이 아니라 "유입 비중 급락"으로 의미가 바뀐다. 운영 중 오탐 여부 확인 권장.
- **실제 계정으로 클릭→발행 성공까지는 아직 1회도 실행된 적 없다** — 선택자 식별과 실행 검증은 별개다. §6의 수동 1회 검증을 반드시 거칠 것(현재 `visibility:'private'`로 비공개 발행되므로 안전하게 테스트 가능).
- 선택자가 CSS 모듈 해시 클래스/`data-*` 속성 혼용이라 네이버가 배포를 바꾸면 깨질 수 있다 — 깨지면 재검증 필요.

### 5.1 실행 환경 전환 (필수, Vercel IP 차단)

네이버가 Vercel 서버리스 IP를 차단해(2026-10, 실측) `/api/publish`, `/api/stats`(네이버 로그인 필요)는 Vercel에서 직접 돌리면 `LOGIN_FAIL`로 막힌다. `/api/state`(긴급브레이크, 네이버 호출 없음)만 Vercel 그대로 사용 가능.

1. 로컬 PC에서 `cd vercel && npm i --no-save playwright-core && node scripts/save-cookies.js` 실행 → 실제 Chrome 창에서 네이버 로그인 → `naver-cookies.json` 내용을 `NAVER_COOKIES` 환경변수로 저장(로컬 `.env`)
2. 로컬 PC에서 `node --env-file=.env vercel/local/server.js` 기동(`.env`에 `LOCAL_CHROME=1`, `NAVER_COOKIES`, `NAVER_BLOG_ID`, `API_SECRET` 필요)
3. 외부 공개: `cloudflared tunnel --url http://localhost:3000` — **고정 서브도메인을 쓰려면 [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/tunnel-useful-terms/)로 설정**(quick tunnel은 매번 URL이 바뀌어 n8n 노드를 재설정해야 함)
4. `naver-blog-daily-publish.json`의 "Playwright 발행" 노드, `naver-blog-monitor-alert.json`의 "Run Stats Script" 노드 `url`(현재 플레이스홀더 `REPLACE-WITH-CLOUDFLARED-TUNNEL-URL`)을 위 터널 도메인으로 교체
5. 로컬 PC/터널이 꺼지면 발행·통계 수집이 그대로 멈춘다 — Plan §7.2가 전제했던 "24시간 상시 구동, PC 종료 영향 없음"은 더 이상 성립하지 않음. 상시 가동 PC(또는 미니PC)로 운용할 것.

### 6. 동작 확인

1. n8n에서 워크플로우 수동 실행(Execute Workflow)
2. "Run Stats Script" 노드 출력에 `{"date":..., "visitors":N, "searchInflow":N}` 형태 JSON 확인
3. 전일 데이터가 없는 첫 실행은 `isCritical: false`가 정상(비교 대상 없음)
4. 급락 시나리오 테스트: n8n Static Data(`$getWorkflowStaticData`)를 수동으로 `lastStats.visitors`를 오늘 값의 2배로 편집 후 재실행 → 텔레그램 알림 수신 + `emergencyBrake: true` 저장 확인
5. 긴급브레이크 전파 확인(daily-publish와 공유): 4번 실행 후 `curl -H "x-api-secret: $API_SECRET" https://<vercel-url>/api/state`로 `{"emergencyBrake":true}`가 반환되는지 확인 → daily-publish를 수동 실행해 "긴급브레이크 확인" 분기에서 중단되는지 확인. 수동 해제는 `curl -X POST -H "x-api-secret: $API_SECRET" -H "Content-Type: application/json" -d '{"emergencyBrake":false}' https://<vercel-url>/api/state`로 끈다(운영 중 재개 절차).
6. 스크립트 실패 알림 테스트: `NAVER_ID`를 일부러 틀리게 설정하고 실행 → `LOGIN_FAIL`로 exit 1 → "텔레그램: 통계 수집 실패 알림" 수신 확인(`Run Stats Script`에 `continueOnFail: true`가 설정돼 있어 실패해도 워크플로우가 이어서 분기 처리함).

**Known Gap**: n8n 버전에 따라 `continueOnFail` 시 실패 아이템의 에러 필드 모양(`$json.error`)이 다를 수 있다(확인 필요, SETUP.md 작성 시점 미검증). 위 6번으로 반드시 실제 환경에서 확인할 것. daily-publish 쪽 Gemini/NIM/Playwright 발행 HTTP Request 노드는 아직 동일한 실패 알림 분기가 없다 — 필요시 같은 패턴으로 추가.

---

## module-2,3: naver-blog-daily-publish

### 1. 워크플로우 Import

`n8n/workflows/naver-blog-daily-publish.json`을 n8n UI에서 Import.

### 2. Credentials 등록

| Credential | 종류 | 용도 |
|---|---|---|
| `gemini-naver-blog` | HTTP Header Auth 또는 Custom | Gemini API 키(`geminiApi.apiKey`) — 본문 생성과 이미지 생성 두 노드가 공유 |
| `telegram-naver-blog` | Telegram API | 체크리스트 탈락 알림 (module-1과 동일 Credential 재사용) |

두 HTTP Request 노드("Gemini 본문 생성", "Gemini 이미지 생성")는 동일한 Gemini Credential을 공유하도록 구성돼 있다(n8n의 Generic Credential Type `httpHeaderAuth`). n8n UI에서 HTTP Header Auth credential을 하나 만들고:
- `gemini-naver-blog`: Header Name `x-goog-api-key`, Header Value = 실제 Gemini API 키

만든 뒤 해당 HTTP Request 노드를 열어 Credential을 위 이름으로 연결(워크플로우 JSON의 `id: "TBD"`를 n8n UI에서 실제 credential로 교체, Telegram credential과 동일한 방식).

### 3. Vercel API 호출 설정

"Playwright 발행" 노드는 Execute Command가 아니라 `vercel/api/publish.js`를 호출하는 HTTP Request 노드다(module-1 §3과 동일한 Vercel 프로젝트, 동일한 `naver-automation-api` credential 재사용). 노드의 `url`을 실제 Vercel URL(`.../api/publish`)로 교체할 것. 필요한 환경변수(Vercel 프로젝트 기준):

| 변수 | 설명 |
|---|---|
| `NAVER_ID` / `NAVER_PW` | module-1과 동일 자동화 전용 계정 |
| `NAVER_BLOG_ID` | 발행 대상 블로그 ID |
| `API_SECRET` | module-1과 동일 |
| `TELEGRAM_CHAT_ID` | n8n 환경변수, module-1과 동일(§3 참조) — "텔레그램: 체크리스트 탈락 알림" 노드가 사용 |

### 4. 키워드 풀 초기화 (필수, 1회)

`키워드 수집` 노드는 Static Data(`keywordPool`)에서 순차로 꺼내 쓴다. n8n UI에서 워크플로우 설정 → Static Data를 열고 최초 1회 아래처럼 채워야 한다(운영 중 소진되면 보충):

```json
{ "keywordPool": ["키워드1", "키워드2", "키워드3"] }
```

업그레이드 경로: 네이버 데이터랩/자동완성 자동 수집 노드로 교체(현재는 수동 큐 — YAGNI, §4.1 코드 주석 참조).

### 5. 실제 연동 전 TODO (이번 세션 범위 밖, 명시적으로 미구현)

- `vercel/api/publish.js`: 스마트에디터 ONE 셀렉터(제목/본문/이미지/발행 패널/최종 발행)는 실제 DOM에서 확인해 구현했다(카테고리는 기본값). **단, 실발행 런타임 테스트는 미수행** — Vercel IP에서 네이버 로그인이 캡차/2FA로 막힐 수 있고(`LOGIN_FAIL`), 에디터 셀렉터는 네이버 배포로 바뀔 수 있다. 첫 실행은 반드시 수동 1회로 검증하고, 검증 전에는 Cron을 켜지 말 것. 발행 성공은 글 URL로 이동했을 때만 `{ok:true}`를 반환한다.
- **비공개 시험 모드**: "Playwright 발행" 노드 jsonBody에 `visibility: 'private'`가 들어 있어 현재 모든 발행이 비공개다. 수동 검증 통과 후 이 필드를 제거하면 전체공개로 발행된다.
- 체크리스트의 "타 사이트 문장 유사도" 검사 — 외부 표절 검사 API(예: Copyscape) 연동 필요, 현재는 항상 통과 처리
- **이미지 생성**: NVIDIA 호스팅 Qwen-Image는 없고(셀프호스팅 전용), 호스팅 FLUX.1-schnell은 요청이 응답 없이 끊겨(2026-11 실측, 90초 이상 무응답) Gemini 이미지 생성(`gemini-2.5-flash-image`, 기존 Gemini credential)으로 교체했다. NIM credential/키는 더 이상 쓰지 않는다.
- **이미지 N장 생성** (2026-11-11 네이버 상위노출 경쟁글 벤치마킹 반영): "이미지 N장 분할 준비" 노드가 본문 문단 수에 맞춰 최대 4장까지 생성 요청을 분기(n8n이 아이템 단위로 반복 실행하는 특성 이용)하고, "이미지 수집" 노드가 `candidates[0].content.parts[].inlineData`(base64) 응답들을 data URI 배열로 모아 `imageUrls`로 전달한다. `vercel/api/publish.js`는 이 배열을 받아 본문 문단 사이사이에 고르게 분산 삽입한다(경쟁글처럼 텍스트-이미지 교차 배치).
- `제휴비중 게이트` 노드는 플래그만 결정하며, 실제 상품 링크/이미지 삽입은 쇼핑커넥트 연동 후 구현(§module-4 참조)

### 6. 동작 확인

1. keywordPool 채운 뒤 워크플로우 수동 실행
2. Gemini 본문/이미지 생성 노드 응답에 실제 본문 텍스트와 이미지(base64) 데이터가 오는지 확인
3. 체크리스트 노드 출력의 `checks`, `passed` 값 확인
4. `lastPublishedDate`는 Static Data에서, `emergencyBrake`는 module-1 §3.1에서 설정한 Vercel Edge Config를 통해 공유된다 — "공유상태 읽기" 노드 출력에 `emergencyBrake: true`가 찍히는지로 확인(module-1 §6-5 참조. 과거 공유 파일 방식 아님에 주의)

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
2. `vercel/api/publish.js`의 TODO(제휴비중 게이트 — module-4 주석) 부분에서 `isAffiliatePost` 분기로 셀러 제공 이미지/링크 삽입 구현
3. Gemini 본문 생성 프롬프트도 `isAffiliatePost`에 따라 후기·추천형 어투로 분기(현재는 정보성 프롬프트 고정)

Design 참조: [naver-blog-shopping-connect.design.md](../docs/02-design/features/naver-blog-shopping-connect.design.md)
