# 네이버 블로그 자동화 — 오픈소스 3종 통합 작업 계획

> 작성: 2026-11-19 · 대상 프로젝트: naver-blog-shopping-connect
> 기반 문서: `4b6b93cc-.claude-progress.md` (11-19 NIM 본문+이미지 시험 발행 성공 시점)

## 목표

기존 파이프라인(본문생성(NIM, nemotron-3-ultra) → imagePrompt 분리 → 이미지(NIM, flux.1-schnell) → 체크리스트 노드 → Playwright 로컬서버+cloudflared 발행)에 **구조 채점 로직 · 실측 기반 프롬프트 기준값 · 맞춤법/번역체 자동 다듬기**를 추가해, 계획된 사람 채점 게이트(FR-13, 한국어 5~10개 샘플 채점)에 올라가기 전 품질을 한 단계 올린다. 목적은 사람 채점 부담을 줄이고, 재생성 큐잉이 걸리는 글 비율을 낮추는 것.

## 추가할 저장소와 역할

| 저장소 | ⭐ | 역할 |
| --- | --- | --- |
| [doric9/naver-blog-seo](https://github.com/doric9/naver-blog-seo) | 0 | 체크리스트 노드에 포팅할 채점 로직 (글자수15·제목20·본문구조20·키워드배치15·콘텐츠품질20·CTA10, 100점 만점) |
| [bam-bam-2/solo-skills](https://github.com/bam-bam-2/solo-skills) `naver-howto-post` | 448 | 본문생성(NIM) 프롬프트에 반영할 제목 금지어·글자수/이미지 개수 기준(상위 노출 글 실측 기반) |
| [nomadamas/k-skill](https://github.com/nomadamas/k-skill) `korean-spell-check` / `korean-humanizer` | 8.4k | 본문생성과 체크리스트 사이에 추가할 맞춤법 검사·번역체 다듬기 노드 |
| [nomadamas/k-skill](https://github.com/nomadamas/k-skill) `naver-blog-research` | 8.4k | (2단계) 상위 노출 글 실측 데이터 수집 — naver-howto-post 기준값 보정용 |
| [janreges/siteone-crawler](https://github.com/janreges/siteone-crawler) | 981 | (2단계) 공개 전환 후 기술적 SEO 정기 점검 |

보류: ALwrity, SerpBear, OpenSEO — 블로그 1개 규모엔 과함, 스케일업 시 재검토.

## 작업 순서

### 1단계 — 지금 (시험 WF 기준으로 먼저 검증 후 운영 WF 반영)

- [ ] doric9/naver-blog-seo의 SKILL.md/스코어링 로직을 확인해 체크리스트 Function 노드에 점수 계산 추가. 통과 임계값(예: 70점 이상) 설정, 미달 시 기존 재생성 큐잉 흐름에 연결
- [ ] bam-bam-2/solo-skills `naver-howto-post`의 제목 금지어 목록(예: "완벽 가이드", "총정리" 등)과 글자수·이미지 개수 기준을 본문생성(NIM) 프롬프트에 반영
- [ ] k-skill `korean-spell-check`, `korean-humanizer` 로직을 참고해 노드 2개 추가, 파이프라인 순서 변경:
  본문생성(NIM) → **맞춤법 검사(신규)** → **번역체 다듬기(신규)** → imagePrompt 분리 → 이미지(NIM) → 체크리스트(doric9 채점) → Playwright 발행
- [ ] 시험 워크플로우(xNrXrcyImWrcjC21)에 먼저 적용 후 비공개 발행 1~2회로 검증
- [ ] 검증 통과 시 운영 워크플로우(KyMi8Nw6RA8waY6i / tocdpbqOCXGybmI6)에 동일 반영

### 2단계 — 공개 전환 이후

- [ ] k-skill `naver-blog-research`로 키워드별 상위 노출 글 글자수/이미지 개수 실측 → `naver-howto-post` 기준값 보정
- [ ] janreges/siteone-crawler로 공개된 blog.naver.com 글 정기 점검(깨진 링크, 메타 누락, sitemap) — 별도 cron으로 분리

## 영향받는 파일/노드 (레포 기준)

- `n8n/workflows/naver-blog-daily-publish.json` (시험 WF `xNrXrcyImWrcjC21`, 운영 WF `KyMi8Nw6RA8waY6i` / `tocdpbqOCXGybmI6`)
- 체크리스트 Function 노드 — doric9 채점 로직 추가
- 본문생성 노드(`본문 생성 (NIM)`) — naver-howto-post 기준 프롬프트 반영
- 신규 노드 2개 — 맞춤법 검사, 번역체 다듬기 (k-skill 포팅)

## 완료 기준

1. 체크리스트 노드가 doric9 기준 점수를 출력하고, 임계값 미만이면 기존 재생성 큐잉으로 자동 연결된다
2. 본문생성 프롬프트에 제목 금지어·길이/이미지 기준이 반영된 것을 시험 발행 1회로 확인한다
3. 맞춤법/번역체 노드 통과 후, 사람 채점(FR-13) 샘플에서 오탈자·어색한 문장 지적 건수가 이전(이번에 사람이 직접 리뷰한 "겨울철 실내 습도" 초안 대비)보다 줄어든다

## 참고

- 보안: n8n API 키 폐기, NIM 키 재발급 필요(기존 진행상황 파일 11-19 기록과 동일)
- 시험 비공개 글 삭제 대상은 기존 진행상황 파일 "남은 일" 3번과 동일하게 유지
