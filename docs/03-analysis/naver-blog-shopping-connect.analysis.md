---
template: analysis
version: 1.3
---

# naver-blog-shopping-connect Analysis Report

> **Analysis Type**: Gap Analysis (Static — 실제 n8n/네이버 계정 미연결로 Runtime 검증 불가)
>
> **Project**: naver_blog
> **Version**: 0.1
> **Analyst**: 장대광
> **Date**: 2026-10-28 (최초) / 2026-11-11 재측정(§8)
> **Design Doc**: [naver-blog-shopping-connect.design.md](../02-design/features/naver-blog-shopping-connect.design.md)

### Pipeline References

해당 없음 — n8n 워크플로우 자동화 프로젝트.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 신생 블로그 저품질 판정 리스크(속도·제휴비중 급증)가 핵심 문제 |
| **WHO** | 블로그 운영자 본인(장대광), 자동화 파이프라인 |
| **RISK** | 네이버 알고리즘(C-Rank/DIA) 판정으로 수개월 회복 불가 저품질 전환 |
| **SUCCESS** | 게이트 통과(포스팅 수·검색유입·저품질 없음) + 쇼핑커넥트 유입 안정화 |
| **SCOPE** | 블로그 개설(수동) → 콘텐츠 자동화(n8n+Playwright) → 알고리즘 대응 체크리스트 → 쇼핑커넥트 연동 → 모니터링/긴급대응 |

---

## Strategic Alignment Check

### PRD/Plan Alignment

| 요소 | 기대 | 구현 상태 |
|---|---|:---:|
| 핵심 문제(WHY) | 발행 속도·제휴비중 급증으로 인한 저품질 리스크 | ✅ Addressed — 하드리밋/지터/게이트로 구조적 반영 |
| 대상(WHO) | 운영자 본인, 자동화 파이프라인 | ✅ Addressed |
| 가치제안 | 저품질 리스크 최소화하며 2~3개월 내 수익화 | ⚠️ Partial — 로직은 구현, 실제 운영 데이터로 검증 전 |

### Success Criteria Status (Plan §4)

| # | Criteria | Status | Evidence |
|---|---|:---:|---|
| SC-1 | 준비기 게이트(포스팅10+, 품질체크 통과) | N/A | 운영 데이터 필요, 코드 구현 대상 아님 |
| SC-2 | 지수성장기 게이트(검색유입 발생, 저품질 없음) | N/A | 운영 데이터 필요 |
| SC-3 | 최적화 게이트(포스팅30+, 유입 안정) | N/A | 운영 데이터 필요 |
| SC-4 | 쇼핑커넥트 제휴비중 단계적 확대가 설계대로 동작 | ⚠️ Partial | `n8n/workflows/naver-blog-daily-publish.json`의 "제휴비중 게이트" 노드가 `roadmapPhase`→`affiliateRatio`→`isAffiliatePost` 로직 구현. 단, 실제 상품 링크/이미지 삽입은 쇼핑커넥트 미연동으로 미구현(의도된 범위 제한) |
| SC-5 | 일일 모니터링·긴급브레이크·복구 절차 동작 확인 | ⚠️ Partial | `naver-blog-monitor-alert.json` 로직 구현 완료, 실제 네이버 계정/텔레그램으로 런타임 검증은 미실시(크리덴셜 없음) |

**Success Rate**: 0/5 확정 충족 (3개는 운영 데이터 필요로 N/A, 2개는 로직 구현 완료·런타임 미검증 Partial)

### Decision Record Verification

| Source | Decision | Followed? | Deviation |
|---|---|:---:|---|
| Plan | n8n 오케스트레이션, 별도 서버/클라우드 실행 | ✅ | 워크플로우 JSON 구조로 구현, 서버 배포는 운영자 작업 영역 |
| Plan | Gemini 한국어 본문 / NIM 이미지 | ✅ | HTTP Request 노드로 반영 |
| Design | Option C(발행/모니터링 2-워크플로우 분리) | ✅ | 정확히 2개 워크플로우로 구현 |
| Design | 상태 공유는 n8n Static Data(YAGNI, DB 미도입) | ✅ | `$getWorkflowStaticData('global')` 사용 |

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Design 문서(§2~§11) 대비 `n8n/` 디렉토리 구현물의 구조적·기능적 일치도를 확인하고, 운영 투입 전 보완이 필요한 항목을 식별한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/naver-blog-shopping-connect.design.md`
- **Implementation Path**: `n8n/workflows/`, `n8n/scripts/`, `n8n/SETUP.md`
- **Analysis Date**: 2026-10-28
- **제약**: 실제 n8n 인스턴스, 네이버 계정, Gemini/NIM/Telegram 크리덴셜이 연결되지 않아 Runtime(L1~L3) 검증은 수행 불가 — Static 분석만 수행

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 노드 스펙 일치 (Design §4 API Spec 대체)

| Design 노드 (§4.1 daily-publish) | 구현 | 상태 |
|---|---|:---:|
| Cron Trigger(지터) | Daily Trigger + Wait(0~60분) | ✅ Match |
| 긴급브레이크 확인 | IF(emergencyBrake) | ✅ Match |
| 중복발행 확인 | IF(lastPublishedDate) | ✅ Match |
| 키워드 수집 | Code(수동 큐, 자동완성 크롤링 아님) | ⚠️ Shallow — Design 의도(데이터랩/자동완성)와 다른 단순화, SETUP.md에 업그레이드 경로 명시 |
| 본문 생성(Gemini) | HTTP Request | ✅ Match (엔드포인트/스키마 미검증) |
| 이미지 생성(NIM) | HTTP Request | ⚠️ Shallow — 엔드포인트 URL 실물 미검증 |
| 발행전 체크리스트 | Code(최소길이/이미지존재/키워드반복 구현, 유사도는 스텁) | ⚠️ Shallow |
| 제휴비중 게이트 | Code(roadmapPhase→affiliateRatio→isAffiliatePost) | ✅ Match |
| Playwright 발행 | Execute Command | ⚠️ Shallow — 본문/이미지 미전달(키워드만), 셀렉터 placeholder |
| 상태 기록 | Code(lastPublishedDate 갱신) | ✅ Match |

| Design 노드 (§4.2 monitor-alert) | 구현 | 상태 |
|---|---|:---:|
| Cron Trigger(매일 1회) | Schedule Trigger | ✅ Match |
| 통계 수집 | Execute Command(Playwright) | ⚠️ Shallow — 셀렉터 placeholder |
| 급락 판정 | Code(dropRate≥0.5) | ✅ Match |
| 텔레그램 알림 | Telegram 노드 | ✅ Match |
| 긴급브레이크 설정 | Code(emergencyBrake=true) | ✅ Match |

### 2.2 공유 상태 모델 (Design §3.1)

| 필드 | Design | 구현 | 상태 |
|---|---|---|:---:|
| roadmapPhase | enum 4종 | 구현(기본값 '지수성장기') | ✅ |
| affiliateRatio | 단계별 매핑 | RATIO_BY_PHASE 매핑(0/0/20/35) | ✅ (Plan 테이블 30~40 범위 중 35로 고정값 선택 — 운영 중 조정 가능하게 상수화되어 수정 용이) |
| lastPublishedDate | 중복방지 | 구현 | ✅ |
| emergencyBrake | 긴급중단 | 구현 | ✅ |
| lastStats | 급락비교 | 구현 | ✅ |

### 2.3 Functional Depth Analysis

| File | Depth Score | Placeholder Indicators | 비고 |
|---|:---:|---|---|
| `n8n/workflows/naver-blog-monitor-alert.json` | 85 | 2일 연속 확인 등 오탐방지 로직 없음(Design §5 Risk에서 "검토 필요"로 명시한 수준) | 핵심 로직 완성 |
| `n8n/workflows/naver-blog-daily-publish.json` | 80 | 체크리스트 유사도 스텁, 제휴 링크 미삽입(의도된 범위) | 핵심 로직 완성 |
| `n8n/scripts/naver-stats.playwright.js` | 40 | 통계 페이지 셀렉터 TODO, 로그인 성공 검증 TODO | SETUP.md에 명시된 1회 검증 필요 항목 |
| `n8n/scripts/naver-publish.playwright.js` | 30 | 에디터 셀렉터 TODO, **Gemini 본문/NIM 이미지가 스크립트로 전달되지 않음**(키워드만 인자 전달), 이미지 삽입/카테고리선택/발행버튼 TODO | Design §2.2 Data Flow상 "체크리스트 검증→...→Playwright 발행"은 본문/이미지가 실려야 하나 현재 끊김 |

```
Scoring: 0=empty, 20=skeleton, 40=mock data, 60=partial logic, 80=mostly complete, 100=fully implemented
Threshold: <60 = SHALLOW
```

**Shallow File Count**: 2/4 (50%)

**Functional Match Rate**: (85+80+40+30)/4 ≈ **59%**

### 2.4 Contract 검증 (Design §4 노드 스펙 ↔ 실제 HTTP Request 노드)

| # | 대상 | Design | 구현 | Contract |
|---|---|:---:|:---:|:---:|
| 1 | Gemini API 엔드포인트/모델명 | generateContent, gemini 계열 | `gemini-2.5-flash:generateContent` | ⚠️ 실제 API 스펙 대비 미검증 |
| 2 | NIM Qwen-Image 엔드포인트 | 상업적 이용 허용 이미지 생성 | `ai.api.nvidia.com/v1/genai/qwen/qwen-image` (추정 URL) | ❌ 실제 NIM API 경로 미검증, 오류 가능성 |
| 3 | Telegram sendMessage | 텔레그램 알림 | n8n Telegram 노드(chatId/text) | ✅ n8n 표준 노드 사용, 구조적으로 안전 |
| 4 | 워크플로우 간 상태 공유(Static Data) | emergencyBrake 등 5개 필드 | 양쪽 워크플로우에서 동일 키로 읽기/쓰기 | ✅ |

**Contract Match Rate**: 2.5/4 ≈ **63%** (NIM 엔드포인트 미검증을 Fail로, Gemini를 Partial로 처리)

### 2.5 Match Rate Summary

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:   59%                │
│  Contract Match Rate:     63%                │
│  Runtime Match Rate:      N/A (미검증)        │
│  ─────────────────────────────────────────── │
│  Overall Match Rate (Static-only):  69%      │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)                        │
├─────────────────────────────────────────────┤
│  ✅ Match:           11 항목                  │
│  ⚠️ Shallow/Partial:  7 항목                  │
│  ❌ Fail:             1 항목 (NIM 엔드포인트)  │
└─────────────────────────────────────────────┘
```

---

## 3. 발견 사항 (Findings)

### 3.1 Important (확신도 높음, 설계 의도와 어긋남)

| # | 항목 | 파일 | 문제 | 권장 조치 |
|---|---|---|---|---|
| 1 | 본문/이미지가 발행 스크립트로 전달 안 됨 | `naver-publish.playwright.js`, `naver-blog-daily-publish.json` | Gemini 본문·NIM 이미지를 생성해놓고 Playwright 발행 단계에는 키워드만 넘어감 — 현재 상태로는 실제 콘텐츠가 발행될 수 없음 | Code 노드로 body/imageUrl을 임시 파일로 저장 후 스크립트에 경로 전달(각 파일에 이미 TODO로 명시됨) |
| 2 | NIM API 엔드포인트 미검증 | `naver-blog-daily-publish.json` | 추정 URL이라 실제 호출 시 404/스펙 불일치 가능성 높음 | NVIDIA NIM 콘솔에서 실제 엔드포인트 확인 후 교체 |

### 3.2 Known & Approved Deferrals (Do phase에서 운영자 승인하에 명시적으로 범위 제외)

| 항목 | 사유 |
|---|---|
| 네이버 통계/에디터 셀렉터 placeholder | 실제 페이지 DOM 1회 수동 검증 필요(SETUP.md §5) |
| 문장 유사도 체크 스텁(항상 통과) | 외부 표절 검사 API 미연동, 수동 검수로 보완 중 |
| 키워드 자동완성 크롤링 미구현 | 수동 큐(Static Data)로 대체, YAGNI |
| 쇼핑커넥트 실제 링크/이미지 삽입 미구현 | 커넥트 연동 승인 전이라 범위 밖 |
| 급락 감지 2일 연속 확인 등 오탐 방지 로직 없음 | Plan §5 Risk에서 "운영 중 필요시 추가 검토"로 명시된 항목 |

---

## 4. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate (Static-only): 69%       │
├─────────────────────────────────────────────┤
│  구조(파일 존재):        100%                │
│  기능 완성도:             59%                │
│  외부 연동 계약:          63%                │
│  런타임 검증:             미실시(환경 없음)   │
└─────────────────────────────────────────────┘
```

> 90% 기준에는 못 미치지만, 격차의 대부분은 "운영자 승인하에 의도적으로 미룬 항목"(§3.2)이며
> 신규 결함은 §3.1의 2건(본문 미전달, NIM 엔드포인트)이다.

---

## 5. Next Steps

- [x] §3.1-#1 수정 완료: "콘텐츠 임시저장" Code 노드 추가, body/imageUrl을 임시 JSON 파일로 Playwright 스크립트에 전달하도록 변경(`naver-blog-daily-publish.json`, `naver-publish.playwright.js`)
- [x] §3.1-#2 완화: NIM 노드명에 "TODO: 엔드포인트 검증 필요" 명시, SETUP.md §5에 go-live 전 필수 확인 항목으로 등록(실제 API 키/콘솔 접근이 없어 엔드포인트 자체 검증은 운영자 몫)
- [ ] 실제 n8n/네이버 계정/API 키로 런타임 검증(L1~L3)은 운영자 환경에서만 가능 — Check phase 자동화 한계
- [ ] §3.2 승인된 유예 항목은 Plan/Design 변경 없이 그대로 두고 운영 중 순차 보완

---

## 6. Re-verification (버그 수정 반영, 2026-10-28 2차)

code-analyzer/gap-detector 재측정 결과 및 적용한 코드 수정 사항.

### 6.1 측정치 변화

| 지표 | 1차 | 2차(수정 후) |
|---|:-:|:-:|
| codeQualityScore | 62 | 76 |
| criticalIssueCount | 3 | 1 (아래 6.2 추가 수정으로 추가 해소, 실측 재확인 안 함) |
| Structural Match | 100% | 100% |
| Functional Match | 59% | 68% |
| Contract Match | 63% | 75% |
| apiComplianceRate | 42% | 67% |
| Overall Match Rate | 69% | 77%(2차 agent 측정) — 아래 6.2의 추가 수정은 미반영 수치 |

### 6.2 적용한 수정 (코드만으로 해결 가능한 항목)

- **emergencyBrake 워크플로우 간 미공유**: `$getWorkflowStaticData('global')`는 워크플로우별로 분리되어 monitor-alert → daily-publish 전달이 안 되던 버그. `$PROJECT_ROOT/.n8n-shared-state.json` 공유 파일로 변경.
- **발행 미구현인데 성공 처리**: `naver-publish.playwright.js`가 카테고리/발행버튼 미구현 상태에서 exit 0으로 끝나 "상태 기록"이 거짓으로 `lastPublishedDate`를 기록하던 버그. 미구현 상태면 `PUBLISH_NOT_IMPLEMENTED`로 exit 1 하도록 수정(발행 검증 전까지 워크플로우가 의도적으로 실패).
- **Telegram chatId 참조 오류**: Telegram credential에 없는 `chatId` 필드를 참조하던 버그. `$env.TELEGRAM_CHAT_ID`로 교체(2곳).
- **Gemini/NIM HTTP 인증 미연결**: `$credentials.geminiApi.apiKey` 등은 노드에 해당 이름의 credential이 연결돼 있지 않아 작동할 수 없는 구조였음. `genericCredentialType`/`httpHeaderAuth` 패턴으로 재구성(실제 API 키 입력은 운영자 몫 — SETUP.md에 안내).
- **긴급브레이크 ON이 텔레그램 발송 성공에 종속**: 연결 순서를 "급락 판정→긴급브레이크 ON→텔레그램"으로 변경해 알림 실패와 무관하게 브레이크가 먼저 켜지도록 수정.
- **키워드 반복 검사식 오류**: 점유율 계산식을 `kw.length * count / body.length`로 정정(기존엔 사실상 항상 통과).
- **통계 NaN 미검증**: `STATS_FETCH_FAIL`로 명시 처리하도록 추가(기존엔 NaN이 그대로 lastStats에 저장돼 모니터링이 조용히 오염).
- **로그인 실패 판정**: 불확실한 DOM 클래스명 대신 URL(`nidlogin` 잔류) 기반으로 교체(두 스크립트).
- **상대경로 Execute Command**: `$env.PROJECT_ROOT` 기반 절대경로로 교체.
- **STATS_FETCH_FAIL/LOGIN_FAIL 알림 없음**: "Run Stats Script"에 `continueOnFail` 추가 + 실패 분기 Telegram 알림 노드 신설(Design §6.1 준수).

### 6.3 코드로 해결 불가 — 운영자 입력 필요 (범위 밖, 의도적으로 보류)

- Gemini/NIM credential의 실제 API 키 값 (n8n UI에서 직접 입력)
- NIM 이미지 생성 엔드포인트 실물 검증 (NVIDIA NIM 콘솔 접근 필요)
- 네이버 에디터/통계 페이지 실제 DOM 셀렉터 (실제 계정 로그인 후 1회 수동 검증 필요)
- 문장 유사도 검사용 외부 표절 검사 API 연동
- `continueOnFail` 실패 시 에러 필드 모양이 n8n 버전마다 다를 수 있어 실제 환경에서 재확인 필요(SETUP.md §6-6 테스트 절차 참조)

> 6.2 수정 이후 Match Rate는 재측정하지 않았다(6.3이 모두 라이브 환경 필요 항목이라 큰 변동은 없을 것으로 추정). 운영자가 §6.3을 완료하면 `/pdca analyze naver-blog-shopping-connect`로 재측정 권장.

---

## 7. Re-verification (Vercel 전환 후속 버그 수정, 2026-10-29)

같은 세션의 "n8n Execute Command를 Vercel 서버리스 API로 전환" 작업(`5f861b2`)이 Execute Command만 Vercel로 옮기고, **§6.2에서 추가한 `emergencyBrake` 공유 파일 방식은 그대로 남겨둔 것**을 발견해 수정.

### 7.1 발견한 결함

n8n Cloud가 Execute Command 노드를 지원하지 않는다는 사실이 확인된 이상, 같은 샌드박스 정책상 Code 노드의 `fs`/`os`/`path` 접근도 막혀있을 가능성이 높다(SETUP.md §3.1-구버전에서도 "n8n Cloud 사용 시 지원 안 될 수 있음"으로 이미 명시됐던 항목). 즉 §6.2에서 추가한 "공유상태 읽기 (긴급브레이크)"/"긴급브레이크 ON" 두 Code 노드(`$PROJECT_ROOT/.n8n-shared-state.json` 파일 I/O)는 n8n Cloud에서 실행 시점에 에러로 멈출 가능성이 높은 신규 결함이었다 — 긴급브레이크가 두 워크플로우 간 전혀 전파되지 않는 silent failure 위험.

### 7.2 적용한 수정

- `vercel/api/state.js` 신규: `vercel/lib/edgeConfig.js`(Vercel Edge Config)를 통해 emergencyBrake를 GET/POST로 공유. 이미 채택된 "n8n Cloud 제약은 Vercel로 우회" 패턴을 그대로 재사용(새 외부 서비스 없음, Vercel 프로젝트 내 Edge Config는 무료 티어 포함).
- `naver-blog-daily-publish.json`의 "공유상태 읽기 (긴급브레이크)": Code 노드(fs 읽기) → HTTP Request(GET `/api/state`)로 교체.
- `naver-blog-monitor-alert.json`의 "긴급브레이크 ON": Code 노드(fs 쓰기) → HTTP Request(POST `/api/state`, `continueOnFail: true`)로 교체. Telegram 알림보다 먼저 호출되는 순서(§6.2에서 정한 "브레이크 먼저, 알림은 그 다음")는 그대로 유지.
- `n8n/SETUP.md`: `PROJECT_ROOT`/`NODE_FUNCTION_ALLOW_BUILTIN=fs,os,path` 요구사항 제거(더 이상 어떤 Code 노드도 fs/os/path를 쓰지 않음), Vercel Edge Config 설정 절차(§3.1) 신규 추가, 중복돼 있던 두 개의 "### 6." 제목 정리.
- `.gitignore`의 `.n8n-shared-state.json` 항목 제거(더 이상 생성되지 않는 파일).

### 7.3 코드로 해결 불가 — 운영자 입력 필요

- Vercel 대시보드에서 Edge Config 생성·Connect, API 토큰 발급(`VERCEL_API_TOKEN`, `EDGE_CONFIG_ID`) — SETUP.md §3.1 참조
- 두 워크플로우 HTTP Request 노드의 `url`을 실제 배포된 Vercel URL로 교체(기존부터 있던 TODO와 동일 작업)

> 이번 수정도 §6.3과 마찬가지로 라이브 환경(Vercel 배포, 실제 Edge Config) 없이는 런타임 검증이 불가능하다. Static 분석 관점에서는 "코드가 가리키는 두 엔드포인트의 계약이 일치한다"(state.js가 반환하는 `{emergencyBrake}` 필드명이 IF 노드가 읽는 `$json.emergencyBrake`와 일치)는 점만 확인했다.

---

## 8. Re-verification (Gemini 이미지/실발행 플로우 완성 + 로컬실행 전환, 2026-11-11)

pull로 반영된 10/29~11/11 커밋 16건(Vercel 서버리스 전환 이후 작업) 기준 재측정. `/pdca analyze` 재실행 지시에 따라 Plan/Design 원본과 현재 `n8n/`+`vercel/` 구현을 다시 비교했다.

### 8.1 Strategic/Decision Record 재확인

| Source | Decision | Followed? | Deviation |
|---|---|:---:|---|
| Plan §7.2 | 실행 환경: 별도 서버/클라우드(24시간 상시 구동) | ❌ | **네이버가 Vercel 서버리스 IP를 차단**한다는 사실이 운영 중 발견돼(`946f4e2`), `vercel/local/server.js` + cloudflared 터널로 로컬 PC 상시 구동이 필요해짐 — Plan의 "PC 종료 영향 없음" 전제가 깨짐. Design 문서 미반영 |
| Plan §7.2 | 이미지 생성: NVIDIA NIM Qwen-Image 우선 | ❌ | NIM 미호스팅 확인 + FLUX.1-schnell 무응답으로 Gemini 이미지 생성(`gemini-2.5-flash-image`)으로 완전 대체(이미 §6~7에서 추적 중이던 변경, 이번 재측정에서 최종 확정) |
| Design §4.1 node 9 | Playwright 발행: Execute Command/Code | ❌ | n8n Cloud가 Execute Command 미지원이라 `vercel/api/publish.js`(HTTP Request 호출)로 전환 — 이미 §7에서 식별됐으나 Design 문서 자체는 아직도 "Execute Command"로 기술 |
| Design §3.1/3.3 | 공유 상태: n8n Static Data 단일 저장소 | ⚠️ | `emergencyBrake`만 Vercel Edge Config, 나머지(`roadmapPhase`/`affiliateRatio`/`lastPublishedDate`/`lastStats`)는 Static Data로 이원화 — §7에서 적용했지만 Design §3 데이터 모델 절은 미갱신 |

### 8.2 Gap Analysis 갱신

| 항목 | 10/28 상태 | 11/11 현재 상태 |
|---|---|---|
| 본문/이미지가 발행 단계로 전달 안 됨(§3.1-#1, Critical) | ❌ Fail | ✅ **해결** — `vercel/api/publish.js`가 `body`/`imageUrl`을 받아 실제 타이핑·파일첨부(`setFiles`)까지 구현 |
| Playwright 발행 셀렉터 placeholder | ⚠️ Shallow | ✅ **대부분 해결** — 제목/본문/이미지버튼/카테고리/발행버튼/비공개토글 셀렉터 모두 실제 DOM 기반(`data-*` 속성)으로 교체, 발행 성공 판정도 URL 전이 확인으로 구현 |
| 통계 수집 셀렉터 placeholder | ⚠️ Shallow | ✅ **해결** — `vercel/api/stats.js` 실제 DOM 셀렉터 적용. 단 `searchInflow`가 Design 의도(검색유입 "건수")와 달리 실제론 "검색 유입 비중(%)" 값으로 노출됨을 확인 — 급락률 계산(상대 비교)엔 영향 없으나 변수명/문서가 의미를 오도함(Minor) |
| n8n Cloud 샌드박스로 emergencyBrake 전파 깨짐 | ❌ Fail(§7에서 발견) | ✅ 해결(Vercel Edge Config로 전환, §7 그대로 유지) |
| 실행 환경(서버리스 IP 차단) | 미식별 | ❌ **신규 발견(Critical)** — `vercel/api/publish.js`/`stats.js`는 네이버 로그인이 필요해 Vercel에서 그대로 돌리면 IP 차단으로 실패할 가능성이 높다. 로컬+터널 전환 코드(`local/server.js`, `save-cookies.js`)는 추가됐으나, 두 워크플로우의 HTTP Request 노드 `url`은 여전히 `https://naverblog-vercel.vercel.app/...`로 고정 — **cloudflared 터널 URL로 교체 전까지는 운영 투입 시 LOGIN_FAIL이 반복될 구조** |
| 죽은 코드 | - | ❌ **신규 발견** — `n8n/scripts/naver-publish.playwright.js`, `naver-stats.playwright.js`가 Vercel 전환 이후 어떤 워크플로우에서도 참조되지 않음(`grep` 확인). Design §11.1 파일 트리는 아직 이 두 파일 기준으로 기술돼 있어 신규 합류자에게 혼란 유발 |
| 실제 네이버 계정 E2E 클릭 테스트 | 미실시 | 미실시(그대로) — 선택자는 실DOM 조사로 교체됐으나 실제 클릭→발행 성공까지 1회도 실행된 적 없음(Design §8.4 L3-#1 미이행) |

### 8.3 Match Rate 재계산 (Static-only, Runtime 미실행)

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:   90%                │
│  Functional Match Rate:   80%                │
│  Contract Match Rate:     70%                │
│  Runtime Match Rate:      N/A (미검증)        │
│  ─────────────────────────────────────────── │
│  Overall Match Rate (Static-only):  78%      │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)                        │
└─────────────────────────────────────────────┘
```

- **Structural 90%**: 핵심 컴포넌트는 모두 존재하나, Design 문서가 Vercel/로컬터널 레이어 자체를 기술하지 않아 설계서↔구현 구조 문서 괴리가 있음(−10)
- **Functional 80%**: 발행/통계/체크리스트/게이트 로직은 실질적으로 완성됐으나(§8.2), 죽은 스크립트 2개와 미검증 E2E가 감점 요인
- **Contract 70%**: `/api/publish`, `/api/stats`를 같은 Vercel 도메인 URL로 호출하도록 고정돼 있는데, 두 엔드포인트는 네이버 로그인이 필요해 **로컬 터널 URL이어야 계약이 성립**한다(`/api/state`는 Vercel 그대로 가능). 현재 JSON의 URL 그대로는 런타임에서 깨질 가능성이 높아 계약 불일치로 평가

### 8.4 Findings (이번 재측정 신규/갱신)

| # | Severity | 항목 | 파일 | 문제 | 권장 조치 |
|---|:---:|---|---|---|---|
| 1 | 🔴 Critical | 발행/통계 엔드포인트가 Vercel IP 차단 구조에 안 맞음 | `n8n/workflows/naver-blog-daily-publish.json`, `naver-blog-monitor-alert.json` | `exec-publish`/`exec-1` 노드의 `url`이 `https://naverblog-vercel.vercel.app/...`로 고정 — 네이버 로그인이 Vercel IP에서 막히는 게 이미 확인된 상태(`946f4e2`)라 이대로는 LOGIN_FAIL 반복 예상 | 두 노드 url을 cloudflared 터널 URL로 교체(SETUP.md에 변수화 가이드 추가 권장). `/api/state`는 Naver 호출이 없으므로 Vercel 유지 가능 |
| 2 | 🔴 Critical | 실제 클릭 E2E 미검증 | `vercel/api/publish.js` | 선택자는 실DOM 조사 완료했지만 실제 계정으로 글쓰기→발행까지 1회도 실행 안 됨 — 캡차/2FA, 선택자 드리프트 위험 상존 | SETUP.md §6 절차대로 `visibility:'private'` 상태로 1회 수동 실행 검증 후 전체공개 전환 |
| 3 | 🟡 Important | Design 문서가 Vercel/로컬터널 아키텍처를 반영 못함 | `docs/02-design/features/naver-blog-shopping-connect.design.md` §3,§4.1,§11.1 | "Execute Command", "n8n Static Data 단일 저장소", 파일트리에 `vercel/` 없음 — 8.1 Decision Record 4건 모두 문서 미반영 | Design §3/§4/§11 갱신(Vercel 레이어, Edge Config 이원화, 로컬+터널 실행 명시) |
| 4 | 🟡 Important | 죽은 코드 잔존 | `n8n/scripts/naver-publish.playwright.js`, `naver-stats.playwright.js` | 어떤 워크플로우도 참조하지 않음(확인됨) — 유지보수 혼란 | 삭제하거나 `docs/archive/`로 이동, Design §11.1 파일 트리에서 제거 |
| 5 | 🟢 Minor | `searchInflow` 의미 변경 미문서화 | `vercel/api/stats.js:22` | 실제로는 검색유입 "비중(%)"인데 변수명/Design은 "건수"로 암시 | 주석은 이미 있음(코드 레벨 OK) — Design §3.1 Data Model 타입 설명에 "%" 명시만 추가 |

### 8.5 Success Criteria 재확인 (변동 없음)

§"Success Criteria Status" 표의 SC-4/SC-5는 여전히 ⚠️ Partial — 로직은 완성됐으나 8.4-#1(엔드포인트 라우팅) 해결 전까지는 런타임 통과를 주장할 수 없음.

---

## 9. Iterate (§8 발견사항 수정, 2026-11-11)

운영자가 "지금 모두 수정"을 선택해 Critical 2건 중 코드로 해결 가능한 1건 + Important 2건을 수정했다.

| # | 조치 | 상태 |
|---|---|---|
| 8.4-#1 발행/통계 엔드포인트 라우팅 | `naver-blog-daily-publish.json`/`naver-blog-monitor-alert.json`의 `url`을 `https://REPLACE-WITH-CLOUDFLARED-TUNNEL-URL/...`로 교체해 "Vercel 도메인 그대로 두면 안 된다"를 노드 자체에서 강제 노출. `/api/state`는 Vercel 유지. SETUP.md §5.1에 named tunnel 설정 절차 신규 추가 | ⚠️ **부분 해결** — 실제 터널 URL 값 입력은 로컬 PC/cloudflared 접근이 있는 운영자만 가능(코드로 완결 불가) |
| 8.4-#2 실계정 E2E 클릭 테스트 | — | ❌ **코드로 해결 불가** — 실제 네이버 계정 로그인 필요, 운영자 수행 항목(SETUP.md §5.1 순서대로 1회 수동 실행 필요) |
| 8.4-#3 Design 문서 미반영 | §2.1 공유상태 다이어그램, §3.3 저장소 분리 설명, §4.1 node 9, §11.1 파일트리를 현재 Vercel+로컬터널 구조로 갱신 | ✅ 해결 |
| 8.4-#4 죽은 코드 | `n8n/scripts/naver-publish.playwright.js`, `naver-stats.playwright.js` 삭제, SETUP.md module-4 참조를 `vercel/api/publish.js`로 정정 | ✅ 해결 |
| 8.4-#5 searchInflow 의미 | SETUP.md §5에 "비중(%)" 의미 명시(이미 코드 주석에 있던 내용을 문서에도 반영) | ✅ 해결 |

### 9.1 재측정

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:   95%  (90→95)       │
│  Functional Match Rate:   82%  (80→82, 죽은파일 제거)│
│  Contract Match Rate:     75%  (70→75, URL 플레이스홀더로 silent-fail 방지)│
│  ─────────────────────────────────────────── │
│  Overall Match Rate (Static-only):  81%      │
└─────────────────────────────────────────────┘
```

90% 미도달 — 잔여 격차는 전부 **운영자만 수행 가능한 항목**(실제 터널 URL 입력, 실계정 1회 수동 발행 검증)이라 추가 자동 iterate로는 해소되지 않는다. 운영자가 SETUP.md §5.1을 완료한 뒤 `/pdca analyze`로 재측정 권장.

---

## 10. Runtime Verification — 실계정 E2E (2026-11-11, aside)

§9.1에서 "운영자만 수행 가능"으로 남겨뒀던 마지막 두 항목 중 실계정 E2E 클릭 테스트를 aside(사용자 브라우저 자동화)로 직접 수행했다. 네이버 로그인은 운영자가 직접 처리(자동 로그인 금지 원칙 준수), 이후 제목 입력→본문 입력→이미지 업로드→발행 패널→비공개 선택→발행 확정까지 전 과정을 1회 실행했다.

### 10.1 결과: ✅ 성공 (비공개 발행)

- **발행된 글**: https://blog.naver.com/nicetoya/224473107110 (비공개 확인됨 — 글 하단 "비공개" 표시 + 포스트 목록 `[비공개]` 태그 이중 확인)
- 제목 입력(`.se-documentTitle .se-text-paragraph`), 본문 입력(`[data-a11y-title="본문"] .se-text-paragraph`), 이미지 업로드(`button[data-name="image"][data-group="documentToolbar"]` → filechooser), 발행 패널 오픈(`button[data-click-area="tpb.publish"]`), 비공개 토글(`label[for="open_private"]`), 최종 발행(`button[data-testid="seOnePublishBtn"]`), 성공 판정(URL에 포스트 번호 포함) — `vercel/api/publish.js`가 구현한 셀렉터/흐름 그대로 실제 계정에서 **전부 동작 확인**.

### 10.2 신규 발견 (Important) — SmartEditor 자동 번호매기기가 타이핑 중 텍스트를 깨뜨림

Gemini가 생성한 본문에 `1. `, `2. ` 형식의 번호 목록이 포함돼 있었는데, 글자 단위로 타이핑하는 동안 스마트에디터 ONE이 이를 자동으로 번호 목록 서식으로 변환하면서 **숫자 자체가 사라지고 일부 빈 줄(문단 구분)도 합쳐지는 현상**을 확인했다. `vercel/api/publish.js`는 `page.keyboard.type(body, { delay: 2 })`로 가공 없이 그대로 타이핑하므로, 운영 환경에서도 번호 목록이 포함된 글은 **동일하게 깨질 위험**이 있다(지금까지는 코드 레벨에서 인지하지 못했던 결함).

**적용한 수정**: `naver-blog-daily-publish.json`의 "Gemini 본문 생성" 프롬프트에 "줄 맨 앞에 숫자+마침표+공백 형식의 번호 목록을 쓰지 말 것(스마트에디터 자동변환으로 깨짐)" 지시를 추가하고, 열거 표현을 "첫째,/둘째," 같은 문장형으로 유도하도록 변경(근본 원인인 타이핑 이벤트 자체를 바꾸지 않고, 그 패턴이 생성되지 않게 프롬프트 레벨에서 선제 차단 — Playwright 코드 변경보다 훨씬 작은 변경, YAGNI). 부수적으로 쓰이지 않던 `title` 파싱 로직(`[제목]/[본문]` 포맷, 실제 발행은 `keyword`를 제목으로 그대로 씀)도 제거해 "본문 추출" 노드를 실제 동작과 일치시켰다.

**잔여 리스크**: 프롬프트 지시는 LLM이 100% 준수한다는 보장이 없다 — 운영 중 번호 목록이 다시 나타나면 Playwright 타이핑 방식 자체(클립보드 붙여넣기로 전환 등)를 바꾸는 코드 레벨 대응이 필요할 수 있음(다음 iterate 후보로 기록).

### 10.3 n8n Cloud 배포본과의 드리프트 발견

실행 중 n8n Cloud API로 실제 배포된 `naver-blog-daily-publish`(id `KyMi8Nw6RA8waY6i`)를 조회해보니, 로컬 git 저장소의 JSON과 "Gemini 본문 생성" 프롬프트/추출 로직이 서로 달랐다(배포본은 이미 단순화된 버전, 로컬은 쓰이지 않는 title 파싱이 남은 구버전). §10.2 수정으로 로컬 파일을 배포본 방식에 맞춰 통일했지만, **이번 세션에서 바꾼 모든 JSON(§9의 URL 플레이스홀더 포함)은 아직 n8n Cloud에 재-Import 되지 않았다** — SETUP.md 절차대로 운영자가 n8n UI에서 다시 Import해야 반영된다.

### 10.4 Match Rate 재계산

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:   95%                │
│  Functional Match Rate:   85%  (82→85, 실제 클릭 플로우 런타임 검증 완료)│
│  Contract Match Rate:     75%                │
│  Runtime Match Rate:      90%  (NEW — L3 시나리오 1건 실행, 1건 중 1건 성공)│
│  ─────────────────────────────────────────── │
│  Overall Match Rate:  (Structural×0.15)+(Functional×0.25)+(Contract×0.25)+(Runtime×0.35) │
│                     = 14.25 + 21.25 + 18.75 + 31.5 = 85.75% ≈ 86%         │
└─────────────────────────────────────────────┘
```

Runtime 실행이 생겨 §2.5/§9.1의 static-only 공식에서 공식 자체를 runtime-포함 공식으로 전환했다(skill 기준). 90% 문턱에는 아직 못 미치지만, 남은 격차는 §10.3(n8n Cloud 재-Import, 운영자 전용)과 §10.2 잔여 리스크(번호 목록 재발 감시, 운영 중 모니터링) 정도로 좁혀졌다.

## 11. 네이버 상위노출 경쟁글 벤치마킹 반영 (2026-11-11)

Design/Plan에는 없던 추가 품질 개선. `naver-blog-research` 스킬(Node stdlib 기반 자체 구현, python3 미설치로 대체)로 파이프라인 테스트 키워드("겨울철 실내 적정 온도와 난방비 절약 팁") 네이버 모바일검색 상위 5개 글을 수집·분석한 결과, 현재 파이프라인 산출물과 아래 격차를 확인:

| 지표 | 상위5개 평균 | 현재 파이프라인(실측) | 격차 |
|---|---|---|---|
| 본문 길이 | ~12,700자(태그제거 텍스트 기준) | 1,751자 | 압도적으로 짧음 |
| 이미지 수 | 6.2장 | 1장 | 크게 부족 |
| 질문형 소제목/문장 빈도 | ~7회 | 1개 이상(하한만 충족) | 부족 |

**적용한 수정**:
- `naver-blog-daily-publish.json` "Gemini 본문 생성" 프롬프트: 최소 2500자 이상, 질문형 소제목 3개 이상(구체적 정보/수치 포함) 지시 추가.
- 같은 워크플로우 "발행전 체크리스트" 노드: `MIN_LENGTH` 500→2000(목표치보다 여유를 둬 과탈락 방지).
- 이미지 1장→최대 4장: 신규 노드 "이미지 N장 분할 준비"(본문 문단 수 기준 분기 생성, n8n의 아이템별 반복실행 특성 이용) + "이미지 수집"(응답 N개를 배열로 재조립) 추가. 상위권(6~9장) 전부 재현은 Gemini 이미지 API 호출당 최대 90초 소요와 트레이드오프라 4장으로 타협(ponytail 주석으로 확장 경로 기록).
- `vercel/api/publish.js`: `imageUrl`(단일) → `imageUrls`(배열)로 계약 변경. 본문을 문단 단위(`/\n{2,}/`, n8n과 동일 기준)로 나눠 타이핑하고, 이미지를 문단 사이사이 균등 분산 삽입(경쟁글의 텍스트-이미지 교차 배치 패턴 재현). 기존 "본문 전체 한 번에 타이핑 후 이미지 1장 끝에 추가" 방식을 대체.

**잔여 리스크(§12에서 검증 완료로 해소)**: §10에서 실계정 E2E 검증을 마친 것은 구 버전(이미지 1장, 본문 한 번에 타이핑)이었다. 이번 변경(문단 분할 타이핑 + 이미지 N장 교차 삽입)은 작성 당시 아직 실계정으로 재검증되지 않은 상태였다.

## 12. Runtime Verification — 멀티이미지/문단분할 플로우 실계정 E2E (2026-11-11, aside)

§11에서 변경한 `vercel/api/publish.js`(imageUrls 배열, 문단분할 교차삽입)를 aside로 실계정 비공개 발행 재검증했다. 임시 n8n 웹훅 워크플로우로 신규 키워드("겨울철 차량 유리 김서림 방지 팁") 실제 Gemini 본문(5,319자)+이미지 4장을 생성한 뒤, `publish.js`와 동일한 알고리즘(문단 26개, 인덱스 4/9/15/20 뒤에 이미지 삽입)을 aside가 그대로 재현했다. 임시 워크플로우는 테스트 직후 비활성화+삭제, 재조회로 완전 삭제 확인.

### 12.1 결과: ✅ 성공 (비공개 발행)

- **발행된 글**: https://blog.naver.com/nicetoya/224473414795 — 제목/카테고리("생활정보", 같은 날 블로그 프로필 정리 작업으로 "OUR STORY"에서 개명한 카테고리가 기본값으로 정상 선택됨)/비공개 표시 모두 확인
- 문단 사이 빈 줄: 의도대로 유지(일반 문단 사이 빈 줄 1개, 이미지 삽입 직후는 에디터 자동 빈문단+지시한 Enter 2회가 겹쳐 빈 줄 2개 — 4곳 전부 일관되게 발생, 기능상 문제 아님)
- 이미지 4장 전부 지정 위치(인덱스 4/9/15/20 뒤)에 정확히 삽입, 본문 타이핑 끊김 없음

### 12.2 신규 발견(Important) — 마크다운 문법이 리터럴 텍스트로 그대로 노출됨

Gemini가 생성한 본문에 `## 제목`, `### 소제목`, `*   **굵게**` 같은 마크다운 문법이 포함돼 있었는데, 플레인 텍스트 에디터에 그대로 타이핑되다 보니 `<h1>~<h6>`, `<ul>/<ol>` 태그로 변환되지 않고 `#`, `*`, `**` 문자가 글자 그대로 노출됨을 확인(DOM 검사로 `se-text-paragraph`에 리터럴 문자 그대로 들어있음을 재확인). §10.2에서 고친 "1. " 번호목록 자동변환 버그와는 반대로, 이번엔 에디터가 아무 것도 자동변환해주지 않아서 생기는 문제.

**적용한 수정**: "Gemini 본문 생성" 프롬프트에 마크다운 문법(#, ##, ###, *, **, -, 1.) 전면 금지 지시 추가 — 소제목은 기호 없는 문장 자체로, 강조도 자연스러운 문장으로 풀어쓰도록 변경.

**잔여 리스크(§13에서 코드 레벨로 해소)**: 이 수정 자체는 아직 실계정 재검증 전(다음 발행 때 마크다운 문자가 안 나오는지 확인 필요). 또한 이번 실행 중 aside가 이미지 삽입 직후 뜨는 "라이브러리" 팝업을 닫다 에디터 포커스를 잃어 문단 5개가 누락되는 사고가 있었고(DOM 전수검사로 자체 발견·복구), `publish.js`는 이런 자가검증/복구 로직이 없어 운영 중 포커스 이슈가 나면 조용히 텍스트가 누락될 수 있다 — §10.2에서 이미 기록한 "키스트로크 타이핑 방식의 구조적 한계"와 동일 계열 리스크로, 클립보드 붙여넣기 전환이 근본 해결책 후보로 남아있음.

## 13. 잔여 리스크 해소 + n8n Cloud 라이브 반영 (2026-11-11)

### 13.1 publish.js 포커스 유실 리스크 수정

§12.2에서 발견한 "이미지 업로드 후 포커스 유실로 문단 조용히 누락" 리스크를 코드 레벨로 수정했다(클립보드 붙여넣기로의 전면 전환은 추가 실계정 검증이 필요한 더 큰 변경이라 보류, 대신 관측된 구체적 실패 지점 2곳을 직접 막음):

1. 이미지 업로드 직후 뜨는 "라이브러리" 팝업을 기존 "도움말 오버레이 닫기"와 동일한 패턴(soft-dismiss, 없으면 무시)으로 자동으로 닫는다.
2. 문단 타이핑 루프가 끝난 직후, 발행 버튼을 누르기 전에 에디터 본문의 실제 텍스트를 읽어 각 문단이 실제로 반영됐는지 검증한다. 하나라도 빠졌으면 **발행하지 않고 에러로 실패 처리**한다 — 조용히 깨진 글이 발행되는 것보다 발행 실패가 낫다는 판단(YAGNI: 완전한 자가복구 로직 대신 "발행 전 탐지"만 구현).

아직 미검증: 이 수정 자체의 실계정 재테스트는 하지 않음(팝업 유실 재현 자체가 비결정적이라 다음 정기 발행에서 자연 발생 여부로 관찰).

### 13.2 n8n Cloud 라이브 워크플로우 재-Import

§9/§10.3/§11에서 "운영자만 수행 가능"으로 남아있던 로컬 git ↔ n8n Cloud 드리프트를, n8n 공개 REST API(`PUT /api/v1/workflows/{id}`, 기존 `.env`의 `N8N_API_KEY`로 이번 세션 내내 사용해온 것과 동일 키)로 직접 반영했다. `naver-blog-daily-publish`(`KyMi8Nw6RA8waY6i`)와 `naver-blog-monitor-alert`(`tocdpbqOCXGybmI6`) 둘 다 PUT 후 재조회로 노드/프롬프트 내용이 로컬 파일과 일치함을 확인(예: 마크다운 금지 프롬프트, 이미지 N장 분할 노드 2개 전부 반영됨). 두 워크플로우 모두 기존에 `active:false` 상태였으므로 활성화 상태 변경 없이 정의만 갱신했다.

**남은 유일한 운영자 전용 항목**: "Playwright 발행"/"Run Stats Script" 노드의 URL이 여전히 `REPLACE-WITH-CLOUDFLARED-TUNNEL-URL` 플레이스홀더다 — 이건 운영자가 실제로 로컬 PC+cloudflared 터널을 띄워야만 나오는 값이라 API로 대신 넣을 수 없음(SETUP.md §5.1 그대로).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.9 | 2026-11-11 | publish.js 포커스유실 리스크 코드 레벨 수정(팝업자동닫기+발행전 타이핑검증), n8n Cloud 워크플로우 2개 API로 직접 재-Import 완료 (§13) | Claude |
| 0.8 | 2026-11-11 | 멀티이미지/문단분할 publish.js 실계정 E2E 재검증 성공, 마크다운 리터럴 노출 버그 발견 및 프롬프트 수정 (§12) | Claude |
| 0.7 | 2026-11-11 | 네이버 상위노출 경쟁글 벤치마킹(분량/이미지수/질문형소제목) 반영 — 프롬프트·체크리스트·이미지 N장 분할 생성·publish.js 문단분할 교차삽입 구현, 실계정 재검증은 미완료 (§11) | Claude |
| 0.6 | 2026-11-11 | aside로 실계정 E2E 발행 테스트 실행(성공, 비공개 확인), SmartEditor 자동번호매기기 버그 발견 및 프롬프트 레벨 수정, n8n Cloud 배포본과의 드리프트 해소, Runtime 포함 Match Rate 81→86% (§10) | Claude |
| 0.5 | 2026-11-11 | §8 발견사항 중 코드로 해결 가능한 3건 수정, 재측정 69→81% (§9) | Claude |
| 0.4 | 2026-11-11 | Gemini 이미지/실발행 플로우 완성 후 재측정, Vercel IP 차단에 따른 엔드포인트 라우팅 결함 신규 발견 (§8) | Claude |
| 0.3 | 2026-10-29 | Vercel 전환 후 emergencyBrake 공유 방식이 n8n Cloud에서 깨지는 결함 수정 (§7) | Claude |
| 0.2 | 2026-10-28 | 코드 레벨 버그 9건 수정 반영, 재측정치 기록 (§6) | Claude |
| 0.1 | 2026-10-28 | 최초 Gap 분석 (Static-only) | 장대광 |
