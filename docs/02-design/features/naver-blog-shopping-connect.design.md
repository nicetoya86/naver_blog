---
template: design
version: 1.3
---

# naver-blog-shopping-connect Design Document

> **Summary**: n8n 2-워크플로우(daily-publish, monitor-alert) 구조로 신생 블로그 콘텐츠 자동 발행과 저품질 모니터링을 분리 구현한다.
>
> **Project**: naver_blog
> **Version**: 0.1
> **Author**: 장대광
> **Date**: 2026-10-28
> **Status**: Draft
> **Planning Doc**: [naver-blog-shopping-connect.plan.md](../../01-plan/features/naver-blog-shopping-connect.plan.md)

### Pipeline References

해당 없음 — n8n 워크플로우 자동화 프로젝트로 9-phase 코드 파이프라인 문서 미사용.

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

## 1. Overview

### 1.1 Design Goals

- "사람처럼 매일 하나씩" 발행 패턴을 코드/워크플로우 레벨에서 강제한다.
- 발행 파이프라인(daily-publish)과 모니터링 파이프라인(monitor-alert)을 독립 스케줄로 분리해 서로의 실패가 전파되지 않게 한다.
- 로드맵 단계(지수 성장기/최적화 진입/운영)에 따른 제휴 비중 게이트를 워크플로우 설정값(변수)으로 외부화해, 코드 변경 없이 운영자가 단계 전환을 승인할 수 있게 한다.

### 1.2 Design Principles

- YAGNI: 5개 역할(키워드수집/생성/검증/발행/모니터링)을 n8n Sub-workflow 분리 없이 2개 워크플로우 내부 노드로 구성(Option C)
- 실패 격리: 발행 워크플로우 에러가 모니터링 워크플로우를 막지 않도록 완전 독립 Cron
- 외부 설정화: 로드맵 단계·제휴 비중·급락 임계값은 n8n Set 노드/Static Data로 관리 — 재배포 없이 값만 수정

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 워크플로우 1개에 전체 노드 | 5개 모듈 완전 분리 + 서브워크플로우 | 발행/모니터링 2개로 분리 |
| **워크플로우 수** | 1 | 5 | 2 |
| **복잡도** | Low | High | Medium |
| **유지보수성** | Medium | High | High |
| **구현 비용** | Low | High | Medium |
| **리스크** | 모니터링 주기가 발행에 종속됨 | n8n 관리 포인트 과다 | 낮음 |
| **추천** | - | - | **기본 선택** |

**선택**: Option C — **근거**: 발행(1일 1회, 지터 포함)과 모니터링(통계 집계·급락 감지, 별도 주기 필요)은 트리거 주기가 본질적으로 다르다. 5개로 완전 쪼개는 Option B는 n8n 특성상 서브워크플로우 호출·Credentials 전파 관리 포인트만 늘고 실익이 적다(YAGNI).

> 아래 상세 설계는 Option C 기준.

### 2.1 Component Diagram

```
┌──────────────────────┐        ┌──────────────────────┐
│  daily-publish 워크플로우 │        │  monitor-alert 워크플로우 │
│  (Cron, 요일별 지터)      │        │  (Cron, 매일 1회)        │
├──────────────────────┤        ├──────────────────────┤
│ 1.키워드수집(데이터랩)     │        │ 1.블로그 통계 수집        │
│ 2.본문생성(Gemini)       │        │ 2.전일대비 급락(50%↑) 판정 │
│ 3.이미지생성(NIM)        │        │ 3.텔레그램 알림           │
│ 4.발행전체크리스트(Func)  │        │ 4.긴급브레이크 플래그 ON   │
│ 5.로드맵단계 비중 게이트   │        │   (daily-publish가 참조)  │
│ 6.Playwright 발행        │        └──────────────────────┘
│ 7.당일발행 플래그 기록     │
└──────────────────────┘
            │
            ▼ (조회)
   ┌──────────────────┐
   │ n8n Static Data /  │   ← 로드맵 단계, 당일발행 플래그, 긴급브레이크 플래그 공유 저장소
   │ 공유 DB(Airtable 등)│
   └──────────────────┘
```

### 2.2 Data Flow

```
[daily-publish]
Cron(지터) → 긴급브레이크 플래그 확인(ON이면 중단) → 당일발행 플래그 확인(이미 발행시 중단)
→ 키워드 수집 → Gemini 본문 생성 → NIM 이미지 생성
→ 체크리스트 검증(Fail시 발행 중단+알림) → 제휴 비중 게이트(로드맵 단계 조회)
→ Playwright 발행 → 당일발행 플래그 기록

[monitor-alert]
Cron(매일 1회, 발행과 다른 시각) → 네이버 블로그 통계 조회
→ 전일 대비 방문자/검색유입 하락률 계산 → 50% 이상 급락?
  → Yes: 텔레그램 알림 + 긴급브레이크 플래그 ON
  → No: 종료
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| daily-publish | 공유 Static Data(긴급브레이크 플래그) | monitor-alert의 긴급 중단 신호 수신 |
| daily-publish | Gemini API, NVIDIA NIM API | 본문·이미지 생성 |
| daily-publish | Playwright(네이버 블로그 로그인 세션) | 실제 발행 |
| monitor-alert | 네이버 블로그 통계(크롤링 또는 통계 페이지 Playwright 조회) | 방문자/검색유입 수치 |
| monitor-alert | 텔레그램 Bot API | 알림 발송 |

---

## 3. Data Model

### 3.1 공유 상태 정의 (n8n Static Data 기준)

```typescript
interface BlogAutomationState {
  roadmapPhase: '준비기' | '지수성장기' | '최적화진입' | '운영';   // 운영자가 게이트 통과 후 수동 전환
  affiliateRatio: number;        // 로드맵 단계별 제휴 콘텐츠 비중(%) — 0/20/30~40
  lastPublishedDate: string;     // 'YYYY-MM-DD', 당일 중복 발행 방지용
  emergencyBrake: boolean;       // true면 daily-publish 즉시 중단
  lastStats: { visitors: number; searchInflow: number; date: string };
}
```

### 3.2 관계

```
[roadmapPhase] 1 ── 결정 ──→ [affiliateRatio]  (Plan §로드맵 테이블 그대로 매핑)
[monitor-alert 실행 결과] ──→ [emergencyBrake] ──→ [daily-publish 실행 여부]
```

### 3.3 저장소 선택

DB 신규 구축 없이 n8n Workflow Static Data(`$getWorkflowStaticData('global')`)로 충분(YAGNI). 운영자가 로드맵 단계를 수동 전환할 UI가 필요해지면 그때 Airtable/Google Sheet 연동을 추가한다 — 현재는 n8n Set 노드로 수동 편집.

---

## 4. 노드 스펙 (API Spec 대체)

### 4.1 daily-publish 워크플로우 노드 목록

| # | 노드 | 타입 | 설명 |
|---|------|------|------|
| 1 | Cron Trigger | Schedule Trigger | 요일별 시각 다르게 설정 + Function 노드로 ±30분 랜덤 지연 |
| 2 | 긴급브레이크 확인 | IF | `emergencyBrake === true`면 워크플로우 종료 |
| 3 | 중복발행 확인 | IF | `lastPublishedDate === today`면 종료 |
| 4 | 키워드 수집 | HTTP Request / Function | 네이버 데이터랩·자동완성 API 또는 크롤링 |
| 5 | 본문 생성 | HTTP Request(Gemini API) | 매번 다른 구조/어투 프롬프트 변주 |
| 6 | 이미지 생성 | HTTP Request(NIM Qwen-Image) | 지수성장기: 개념 이미지, 쇼핑커넥트 이후: 셀러 제공 이미지로 분기 |
| 7 | 발행전 체크리스트 | Function | 최소 글자수/사진개수/유사도/키워드반복 검사 → Fail시 중단+텔레그램 알림 |
| 8 | 제휴비중 게이트 | Function | `affiliateRatio` 조회해 이번 글을 정보성/제휴성 중 무엇으로 생성할지 결정 |
| 9 | Playwright 발행 | Execute Command / Code | 네이버 블로그 에디터 로그인 후 발행 |
| 10 | 상태 기록 | Function | `lastPublishedDate` 갱신 |

### 4.2 monitor-alert 워크플로우 노드 목록

| # | 노드 | 타입 | 설명 |
|---|------|------|------|
| 1 | Cron Trigger | Schedule Trigger | 매일 1회(발행과 다른 시각) |
| 2 | 통계 수집 | HTTP Request / Playwright | 네이버 블로그 통계(방문자/검색유입) 조회 |
| 3 | 급락 판정 | Function | `(전일 - 금일) / 전일 >= 0.5` 여부 계산 |
| 4 | 텔레그램 알림 | HTTP Request(Telegram Bot API) | 급락 시 알림 발송 |
| 5 | 긴급브레이크 설정 | Function | 급락 시 `emergencyBrake = true` 기록 |
| 6 | 상태 저장 | Function | `lastStats` 갱신 |

### 4.3 에러 응답(알림 메시지) 포맷

```json
{
  "level": "WARN | CRITICAL",
  "workflow": "daily-publish | monitor-alert",
  "message": "사람이 읽을 메시지",
  "detail": { "field": "value" }
}
```

---

## 5. 운영 흐름(UI/UX 대체 — 네이버 블로그 에디터 조작 플로우)

### 5.1 Playwright 발행 플로우

```
로그인 페이지 → 자동화 전용 계정 로그인 → 글쓰기 에디터 진입
→ 제목 입력 → 본문/이미지 삽입 → 카테고리 선택 → 발행 버튼 클릭 → 발행 확인
```

### 5.2 User Flow (운영자 개입 시점)

```
평상시: 운영자 개입 없음(완전 자동)
급락 감지: 텔레그램 알림 수신 → 운영자가 최근 글 검토 → 원인글 비공개 전환
         → 2주 발행빈도 주2~3회로 n8n Cron 수정 → emergencyBrake 수동 해제
게이트 통과: 운영자가 로드맵 단계 확인 후 Static Data의 roadmapPhase 수동 전환
```

### 5.3 Page UI Checklist

해당 없음 — 사용자 대면 UI 없음(n8n/Playwright 백엔드 자동화). 네이버 블로그 에디터는 서드파티 화면으로 자체 UI 설계 대상 아님.

---

## 6. Error Handling

### 6.1 오류 정의

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| CHECKLIST_FAIL | 발행전 체크리스트 통과 실패 | 글자수/사진수/유사도/키워드반복 기준 미달 | 발행 중단, 텔레그램 알림, 해당 회차 스킵 |
| LOGIN_FAIL | 네이버 로그인 실패 | 캡차/2FA/계정 잠김 | 발행 중단, 텔레그램 긴급 알림(사람 개입 필요) |
| API_FAIL | Gemini/NIM API 오류 | 키 만료/레이트리밋 | 1회 재시도 후 실패 시 스킵+알림 |
| STATS_FETCH_FAIL | 통계 수집 실패 | 네이버 통계 페이지 구조 변경 등 | 알림만 발송, emergencyBrake 변경 안 함(오탐 방지) |

### 6.2 알림 포맷

§4.3 참조.

---

## 7. Security Considerations

- [ ] API 키(Gemini/NIM/Telegram)는 n8n Credentials에만 저장, 워크플로우 JSON export 시 평문 노출 금지
- [ ] 네이버 자동화 계정 비밀번호는 n8n Credentials 암호화 저장, 코드/문서에 평문 기재 금지
- [ ] FLUX 사용 시 schnell(상업적 허용)만 사용 — dev 버전(비상업 라이선스) 노드 설정 차단
- [ ] 타인 사진 무단 재업로드 금지 — 이미지 소스는 NIM 생성/셀러 제공 공식 이미지로 제한
- [ ] Rate Limiting: Gemini/NIM 호출 실패 시 무한 재시도 금지(최대 1회 재시도)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: 노드 단위 테스트 | 각 HTTP Request 노드(Gemini/NIM/Telegram) | n8n 수동 실행(Execute Node) | Do |
| L2: 워크플로우 액션 테스트 | 체크리스트 Fail/Pass 분기, 제휴비중 게이트 분기 | n8n Pin Data + 수동 실행 | Do |
| L3: E2E 시나리오 | 전체 발행 1회전, 급락 감지→알림→브레이크 1회전 | n8n 수동 트리거 + Playwright 비-headless 관찰 | Do |

### 8.2 L1: 노드 테스트 시나리오

| # | 노드 | 테스트 설명 | 기대 결과 |
|---|------|-------------|-----------|
| 1 | Gemini 본문생성 | 키워드 1개로 본문 생성 호출 | 본문 텍스트 반환, 500자 이상 |
| 2 | NIM 이미지생성 | 프롬프트 1개로 이미지 생성 호출 | 이미지 URL/파일 반환 |
| 3 | Telegram 알림 | 테스트 메시지 발송 | 텔레그램 채팅에 메시지 도착 |
| 4 | 발행전 체크리스트 | 글자수 부족 데이터 입력 | Fail 반환, 발행 노드로 진행 안 함 |

### 8.3 L2: 워크플로우 액션 테스트

| # | 대상 | 액션 | 기대 결과 | 검증 |
|---|------|------|-----------|------|
| 1 | daily-publish | emergencyBrake=true 상태로 실행 | 2번 노드에서 즉시 종료 | 이후 노드 미실행 로그 확인 |
| 2 | daily-publish | lastPublishedDate=오늘로 실행 | 3번 노드에서 즉시 종료 | 중복 발행 없음 |
| 3 | daily-publish | 제휴비중 게이트, affiliateRatio=20 | 5회 중 1회 꼴로 제휴성 콘텐츠 분기 | 분기 로직 로그 확인 |
| 4 | monitor-alert | 전일대비 60% 하락 데이터 주입 | 텔레그램 알림 발송 + emergencyBrake=true 기록 | Static Data 값 확인 |

### 8.4 L3: E2E 시나리오 테스트

| # | 시나리오 | 단계 | 성공 기준 |
|---|----------|------|-----------|
| 1 | 정상 발행 1회전 | Cron 트리거(수동) → 키워드수집 → 생성 → 체크리스트 Pass → Playwright 발행 | 네이버 블로그에 실제 글 1건 발행 확인 |
| 2 | 급락 대응 1회전 | monitor-alert에서 급락 주입 → 알림 발송 → daily-publish 재실행 시 브레이크로 중단 | daily-publish가 발행 없이 즉시 종료 |
| 3 | 체크리스트 탈락 | 유사도 높은 본문 주입 | 발행 중단 + 알림, 블로그에 글 미발행 |

### 8.5 Seed Data Requirements

| Entity | 최소 개수 | 필수 필드 |
|--------|:--------:|-----------|
| 테스트용 키워드 | 3 | 키워드명, 경쟁도 |
| 테스트용 통계 샘플 | 2(급락/정상) | visitors, searchInflow, date |

---

## 9. Clean Architecture

n8n 워크플로우 자동화 프로젝트 특성상 Presentation/Application/Domain/Infrastructure 코드 레이어 구조는 적용하지 않는다(YAGNI — n8n 자체가 노드 기반 오케스트레이션 레이어). 대신 워크플로우 간 책임 분리로 대체한다:

| 책임 | 담당 워크플로우/노드 |
|------|---------------------|
| 트리거/스케줄링 | 각 워크플로우의 Schedule Trigger 노드 |
| 비즈니스 규칙(게이트, 체크리스트) | Function 노드 |
| 외부 연동(Gemini/NIM/Telegram/Playwright) | HTTP Request / Execute Command 노드 |
| 상태 저장 | n8n Static Data |

---

## 10. Coding Convention Reference

### 10.1 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 워크플로우명 | kebab-case, `naver-blog-{역할}` | `naver-blog-daily-publish`, `naver-blog-monitor-alert` |
| n8n Credentials명 | `{서비스명}-naver-blog` | `gemini-naver-blog`, `telegram-naver-blog` |
| Function 노드명 | 역할을 한국어로 명확히 | "발행전 체크리스트", "급락 판정" |

### 10.2 Credentials 관리

- 모든 API 키는 n8n Credentials 기능 사용, Function/Set 노드에 평문 하드코딩 금지
- 워크플로우 export/백업 시 Credentials는 별도 분리 보관

### 10.3 Environment Variables

해당 없음 — n8n Credentials로 대체(§3.3, §7 Security 참조).

---

## 11. Implementation Guide

### 11.1 워크플로우 구조

```
n8n/
├── workflows/
│   ├── naver-blog-daily-publish.json
│   └── naver-blog-monitor-alert.json
└── scripts/
    └── naver-publish.playwright.js   (Playwright 발행 스크립트, Execute Command로 호출)
```

### 11.2 Implementation Order

1. [ ] monitor-alert 워크플로우 먼저 구축(통계 수집 → 급락 판정 → 텔레그램 알림) — 독립적이라 먼저 검증 가능
2. [ ] daily-publish: 키워드 수집 → Gemini 본문 생성 → NIM 이미지 생성 (콘텐츠 생성 체인)
3. [ ] daily-publish: 발행전 체크리스트 Function 노드
4. [ ] daily-publish: Playwright 발행 스크립트 + 지터/중복방지
5. [ ] 제휴비중 게이트 + 로드맵 단계 Static Data 연동
6. [ ] emergencyBrake 연동 테스트(monitor-alert ↔ daily-publish)

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---------------:|
| 모니터링 워크플로우 | `module-1` | monitor-alert: 통계수집+급락감지+텔레그램 | 15-20 |
| 콘텐츠 생성 체인 | `module-2` | 키워드수집+Gemini본문+NIM이미지 | 20-25 |
| 발행 가드+Playwright | `module-3` | 체크리스트+지터+중복방지+실제발행 | 25-30 |
| 로드맵 게이트 연동 | `module-4` | affiliateRatio 게이트, emergencyBrake 연동 | 10-15 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1` | 15-20 |
| Session 3 | Do | `--scope module-2,module-3` | 40-50 |
| Session 4 | Do | `--scope module-4` | 10-15 |
| Session 5 | Check + Report | 전체 | 20-30 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-10-28 | 최초 작성 (Option C 선택) | 장대광 |
