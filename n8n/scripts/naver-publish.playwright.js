#!/usr/bin/env node
// Design Ref: §4.1 daily-publish node 9 — Playwright 발행
// n8n Execute Command 노드가 호출. argv[2]에 "콘텐츠 임시저장" 노드가 쓴
// draft JSON 파일 경로를 받아 키워드/본문/이미지를 읽어 발행한다.
//
// Plan FR-06: 네이버 블로그 에디터 로그인 후 발행
// Design §6.1 LOGIN_FAIL: 로그인 실패(캡차/2FA) 시 비정상 종료 코드로 n8n에 알리고,
//   n8n 쪽에서 별도 Telegram 알림 노드 연결 필요(다음 세션에서 §6 에러 핸들링 보강 예정).
//
// 필수 환경변수:
//   NAVER_ID, NAVER_PW : 자동화 전용 네이버 계정
//   NAVER_BLOG_ID      : 발행 대상 블로그 ID
//
// 입력: argv[2] = draft JSON 파일 경로 { keyword, body, imageUrl, isAffiliatePost }

const fs = require('fs');
const { chromium } = require('playwright');

async function main() {
  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  const draftFilePath = process.argv[2];
  if (!NAVER_ID || !NAVER_PW || !NAVER_BLOG_ID) {
    throw new Error('NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.');
  }
  if (!draftFilePath) {
    throw new Error('draft JSON 파일 경로 인자가 필요합니다: node naver-publish.playwright.js "<draftFilePath>"');
  }

  const draft = JSON.parse(fs.readFileSync(draftFilePath, 'utf8'));
  const { keyword, title, body, imageUrl, isAffiliatePost } = draft;
  if (!keyword || !body) {
    throw new Error('draft 파일에 keyword/body가 없습니다: ' + draftFilePath);
  }
  const postTitle = title || keyword; // Gemini가 제목 형식을 안 지켰을 때의 fallback

  // Design Ref: §4.1 node 8 제휴비중 게이트 — module-4
  // TODO: 쇼핑커넥트 연동 후 isAffiliatePost=true일 때 셀러 제공 상품 이미지/링크를
  // 본문에 삽입하는 로직 추가 (Plan §쇼핑 커넥트 연동 게이트, 현재는 플래그만 전달)

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', NAVER_ID);
    await page.fill('#pw', NAVER_PW);
    await page.click('.btn_login');
    await page.waitForLoadState('networkidle');

    // 로그인 실패(캡차/2FA 포함) 시 nidlogin 페이지에 그대로 남는다 — DOM 클래스명보다
    // URL 기반 판정이 네이버 UI 변경에 더 강건하다 (Design §6.1 LOGIN_FAIL)
    if (page.url().includes('nidlogin')) {
      throw new Error('LOGIN_FAIL: 로그인 실패(캡차/2FA 의심) — 사람 개입 필요');
    }

    await page.goto(`https://blog.naver.com/${NAVER_BLOG_ID}?Redirect=Write`);
    await page.waitForLoadState('networkidle');

    // 2026-11-11 aside로 실제 DOM 1회 검증 완료(nicetoya 계정, 읽기 전용 조회): iframe#mainFrame은 맞았고,
    // 제목/본문 선택자는 실제와 달라 아래로 교체함. 카테고리 선택·발행 버튼 클릭은
    // "직접 입력해 발행까지" 되는 실결과 검증은 아직 안 했으므로 의도적으로 미구현 유지(아래 참조).
    const frame = page.frameLocator('iframe#mainFrame');
    await frame.locator('.se-documentTitle .se-title-text').click();
    await page.keyboard.type(postTitle, { delay: 30 });
    await frame.locator('.se-component.se-text').first().click();
    await page.keyboard.type(body, { delay: 5 });

    if (imageUrl) {
      // TODO: 이미지 삽입 버튼은 frame.locator('button[data-name="image"]')로 식별됨(확인 완료).
      // 클릭 후 열리는 업로드/URL 입력 다이얼로그 흐름은 아직 조사 안 함 — 별도 구현 필요.
    }

    // TODO: 카테고리 선택(frame.locator('.se-flayer-unified-category-dropdown-trigger')),
    // 발행 버튼(frame.locator('.publish_btn__v_kS9')) 선택자는 확인했으나 실제 클릭 테스트는 안 했다.
    // 발행 버튼 클릭이 검증되기 전까지는 성공(exit 0)으로 끝내면 안 된다 — n8n의
    // "상태 기록" 노드가 실제로 발행되지 않은 글을 발행된 것으로 기록해 키워드가
    // 소진되고 중복발행 방지 로직이 오작동한다.
    throw new Error('PUBLISH_NOT_IMPLEMENTED: 카테고리 선택/발행 버튼 클릭은 선택자만 확인됐고 실제 클릭 검증이 안 됐습니다 — 운영자가 1회 감독 하에 테스트 후 구현 필요(SETUP.md §5 참조)');
  } finally {
    await browser.close();
    fs.unlink(draftFilePath, () => {});
  }
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
