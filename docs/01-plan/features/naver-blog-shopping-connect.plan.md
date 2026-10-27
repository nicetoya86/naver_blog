---
template: plan
version: 1.3
---

# naver-blog-shopping-connect Planning Document

> **Summary**: 신생 네이버 블로그를 저품질 판정 없이 2~3개월에 걸쳐 키우고, n8n+Playwright 자동화로 쇼핑 커넥트 수익화까지 안전하게 연결한다.
>
> **Project**: naver_blog
> **Version**: 0.1
> **Author**: 장대광
> **Date**: 2026-10-28
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 신생 블로그는 발행 속도·제휴 비중을 성급히 올리면 상업성/어뷰징 블로그로 저품질 판정되어 수개월간 회복 불가 상태에 빠진다 |
| **Solution** | 4단계(준비기→지수 성장기→최적화 진입→쇼핑커넥트 운영) 게이트 기반 로드맵 + n8n/Playwright 자동화로 "사람처럼 매일 하나씩" 발행 패턴을 강제 |
| **Function/UX Effect** | 하루 1개 발행 하드리밋, 체크리스트 자동 검증, 지터 발행, 저품질 급락 텔레그램 알림으로 운영 개입 최소화 |
| **Core Value** | 저품질 리스크를 줄이면서 2~3개월 내 쇼핑 커넥트 수익화 안전 착륙 |

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

### 1.1 Purpose

신생 네이버 블로그를 저품질 판정 없이 성장시켜 쇼핑 커넥트 수익화까지 안전하게 연결하는 전체 파이프라인을 구축한다.

### 1.2 Background

2026년 네이버 검색은 포스팅 개수보다 신뢰성·체류시간·원본성을 더 비중 있게 평가한다. 기존 "빨리 많이" 식 자동화 블로그 운영은 저품질 판정 리스크가 크므로, "천천히 사람처럼"을 원칙으로 한 보수적 로드맵이 필요하다.

### 1.3 Related Documents

- Requirements: `네이버 블로그 개설 → 쇼핑 커넥트 연결 PRD.md` (본 프로젝트 루트, PRD 역할)

---

## 2. Scope

### 2.1 In Scope

- [ ] 블로그 개설·초기 세팅 가이드 (수동, 체크리스트화)
- [ ] 4단계 로드맵 상태 추적 (게이트 조건 포함)
- [ ] n8n 콘텐츠 자동화 워크플로우 (키워드 수집 → Gemini 본문 생성 → NIM 이미지 생성 → 발행 전 체크리스트 → Playwright 발행)
- [ ] 발행 안전장치: 하루 1회 하드리밋, ±30분 지터, 중복 발행 방지 플래그
- [ ] 2026년 알고리즘 대응 체크리스트 (이미지 원본성, 제목 규칙, 문단 길이, Q&A 소제목)
- [ ] 쇼핑 커넥트 연동 및 단계별 제휴 콘텐츠 비중 제어 (0%→20%→30~40%)
- [ ] 일일 모니터링(방문자/검색유입 급락 감지) + 텔레그램 알림 + 긴급 브레이크 로직

### 2.2 Out of Scope

- 네이버 아이디 발급, 블로그 주제·닉네임·소개글 작성 자체(사람이 1회 수동 처리, 자동화 대상 아님)
- 다중 블로그/다계정 운영
- 쇼핑 커넥트 정산·세무 처리

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | n8n Cron이 요일별 변동 시각으로 매일 1회 트리거 | High | Pending |
| FR-02 | 네이버 데이터랩/자동완성에서 롱테일 키워드 수집 | High | Pending |
| FR-03 | Gemini로 한국어 본문 생성(매번 구조·어투 변주 프롬프트) | High | Pending |
| FR-04 | NVIDIA NIM(Qwen-Image, 상업적 이용 허용)으로 개념 이미지 생성 | High | Pending |
| FR-05 | 발행 전 Function 노드 체크리스트: 최소 글자 수, 사진 개수, 타 사이트 문장 유사도, 키워드 반복 과다 검사 | High | Pending |
| FR-06 | Playwright가 네이버 블로그 에디터 로그인 후 발행, 발행 시각 ±30분 지터 | High | Pending |
| FR-07 | 하루 1개 발행 하드리밋 + "오늘 이미 발행함" 플래그로 중복 실행 방지 | High | Pending |
| FR-08 | 로드맵 단계별(지수 성장기/최적화 진입/운영) 정보성·제휴성 콘텐츠 비중 제어(100/0 → 80/20 → 60~70/30~40) | High | Pending |
| FR-09 | 일일 방문자·검색유입 수집, 전일 대비 50% 이상 급락 시 텔레그램 알림 | High | Pending |
| FR-10 | 급락 감지 시 발행 자동화 일시 중단(긴급 브레이크) | High | Pending |
| FR-11 | 원인 확인 후 해당 글 비공개 전환 + 2주간 발행 빈도 주 2~3회로 축소하는 복구 모드 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 저품질 리스크 관리 | 게이트 미통과 시 다음 단계(제휴 연동 등) 자동 진행 차단 | 로드맵 상태값 검증 |
| 콘텐츠 원본성 | AI 이미지/본문 매번 고유 생성, 타 사이트 문장 유사도 체크 통과 | 발행 전 체크리스트 Pass/Fail |
| 라이선스 준수 | FLUX 사용 시 schnell만 허용(dev 비상업 라이선스 금지), 타인 사진 무단 재업로드 금지 | 이미지 생성 노드 설정 검증 |
| 운영 안전성 | 저품질 급락 감지 후 알림까지 지연 최소화 | n8n 실행 로그 타임스탬프 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 준비기 게이트: 포스팅 10개 이상 + 품질체크 통과
- [ ] 지수 성장기 게이트: 검색유입 발생, 저품질 징후 없음
- [ ] 최적화 진입 게이트: 포스팅 30개 이상, 유입 안정적
- [ ] 쇼핑 커넥트 연동 후 제휴 비중 단계적 확대가 설계대로 동작
- [ ] 일일 모니터링·긴급 브레이크·복구 절차가 실제 동작 확인됨

### 4.2 Quality Criteria

- [ ] 발행 전 체크리스트(글자수/사진개수/유사도/키워드반복) 모두 자동 검증
- [ ] 하루 1개 발행 하드리밋 위반 0건
- [ ] 저품질 급락 오탐/누락 없이 텔레그램 알림 도달

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 완전 자동화로 발행 패턴이 기계적으로 드러남 | High | Medium | Cron 지터, 어투 변주 프롬프트, 하루 1개 하드리밋으로 완화 |
| 제휴 콘텐츠 비중을 초반부터 과도하게 높임 | High | Medium | 단계별 비중 테이블을 코드 레벨 게이트로 강제 |
| FLUX dev 등 비상업 라이선스 이미지 사용 | Medium | Low | 이미지 생성 노드에서 schnell/NIM만 허용하도록 고정 |
| 네이버 로그인 자동화(캡차/2FA) 차단 | High | Medium | 자동화 전용 계정 분리, 실패 시 사람 개입 알림(텔레그램) |
| 저품질 급락 오탐으로 불필요한 발행 중단 | Medium | Low | 50% 급락 임계값 + 연속 2일 확인 등 추가 검증 로직 검토(Design에서 확정) |

---

## 6. Impact Analysis

> 신규 프로젝트(그린필드)로 기존 코드/시스템에 대한 변경이 아니므로 기존 소비자(Consumer) 목록은 해당 없음.

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| n8n 워크플로우 | 신규 | 콘텐츠 생성·발행·모니터링 전체 파이프라인 신규 구축 |
| 네이버 블로그 계정 | 외부 리소스 | 자동화 전용 계정으로 Playwright가 로그인·발행 |

### 6.2 Current Consumers

해당 없음 (신규 구축, 기존 소비자 없음)

### 6.3 Verification

- [ ] N/A — 신규 프로젝트

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | 단순 구조 | 정적 사이트 | ☐ |
| **Dynamic** | 기능별 모듈, 외부 API/BaaS 연동 | n8n 워크플로우 + 외부 AI API 연동 자동화 | ☑ |
| **Enterprise** | MSA, 엄격 레이어 분리 | 대규모 시스템 | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 오케스트레이션 | n8n / 직접 스크립트 | n8n | 기존 쇼핑 커넥트 설계서의 콘텐츠 생성 블록 재사용, 비개발자도 유지보수 가능 |
| 실행 환경 | 로컬 PC / 별도 서버·클라우드 | 별도 서버/클라우드 | 24시간 상시 구동 필요(Cron, 모니터링), PC 종료 영향 없음 |
| 한국어 본문 생성 | Gemini / NVIDIA NIM | Gemini | 한국어 자연스러움이 지수 평가 핵심, 번역체 리스크 회피 |
| 이미지 생성 | NIM Qwen-Image / FLUX schnell | NIM Qwen-Image 우선, FLUX는 schnell만 | 상업적 이용 명시 허용 + 다국어 텍스트 렌더링 |
| 발행 자동화 | Playwright / 네이버 공식 API | Playwright | 네이버 블로그 에디터에 공식 발행 API 부재 |
| 알림 채널 | 이메일 / Slack / 텔레그램 | 텔레그램 | 운영자 확정 선택, 즉시성 높음 |
| API 키 관리 | 환경변수 / n8n Credentials | n8n Credentials | n8n 표준 기능으로 신규 의존성 없이 해결(YAGNI) |

### 7.3 Clean Architecture Approach

```
Selected Level: Dynamic

n8n 워크플로우 구성(모듈 단위):
┌─────────────────────────────────────────────────────┐
│ 1. keyword-collector   (데이터랩/자동완성 수집)       │
│ 2. content-generator   (Gemini 본문 + NIM 이미지)     │
│ 3. publish-guard       (발행 전 체크리스트 Function)  │
│ 4. naver-publisher     (Playwright 발행 + 지터/리밋)  │
│ 5. monitor-alert       (통계 수집 + 급락 감지 + 텔레그램) │
└─────────────────────────────────────────────────────┘
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] CLAUDE.md 코딩 컨벤션: 사용자 글로벌 CLAUDE.md(YAGNI/최소변경) 적용
- [ ] docs/01-plan/conventions.md: 미존재(신규 그린필드, 별도 생성 불필요 — n8n 워크플로우 중심이라 코드 컨벤션 최소)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| n8n 워크플로우 네이밍 | 없음 | `naver-blog-{module}` 형식 | Medium |
| Credentials 관리 | 없음 | n8n Credentials에 Gemini/NIM/텔레그램 키 등록, 코드/문서에 평문 키 금지 | High |
| 발행 로그 | 없음 | 발행 성공/실패/스킵 사유를 n8n 실행 로그로 추적 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `GEMINI_API_KEY` | 한국어 본문 생성 | n8n Credentials | ☑ (보유, 등록만) |
| `NIM_API_KEY` | NVIDIA NIM 이미지/보조 생성 | n8n Credentials | ☑ (보유, 등록만) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | 급락 알림 발송 | n8n Credentials | ☐ (Design에서 발급 절차 확정) |
| `NAVER_BLOG_LOGIN` | Playwright 자동 로그인 계정 | n8n Credentials(암호화) | ☐ |

### 8.4 Pipeline Integration

해당 없음 — bkit 9-phase 코드 개발 파이프라인이 아닌 n8n 워크플로우 자동화 프로젝트이므로 생략.

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`naver-blog-shopping-connect.design.md`) — n8n 워크플로우별 노드 설계, 텔레그램 알림 발급 절차 포함
2. [ ] 운영자 리뷰 및 승인
3. [ ] 구현 시작(Do phase): keyword-collector → content-generator → publish-guard → naver-publisher → monitor-alert 순

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-10-28 | 최초 작성 | 장대광 |
