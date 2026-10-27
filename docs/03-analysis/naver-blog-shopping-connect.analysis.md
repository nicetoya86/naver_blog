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
> **Date**: 2026-10-28
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

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-10-28 | 최초 Gap 분석 (Static-only) | 장대광 |
