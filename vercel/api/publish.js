// n8n Cloud는 Execute Command 노드를 지원하지 않아, naver-publish.playwright.js를
// 이 Vercel 함수로 옮겼다. n8n의 "Playwright 발행" 노드가 draft를 파일이 아니라
// 요청 본문(JSON)으로 직접 보낸다(서버리스 환경은 n8n과 파일시스템을 공유하지 않음).
// 필수 환경변수(Vercel 프로젝트 설정): NAVER_ID, NAVER_PW, NAVER_BLOG_ID, API_SECRET
const { launchBrowser, checkSecret } = require('../lib/browser');

module.exports = async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  if (!NAVER_ID || !NAVER_PW || !NAVER_BLOG_ID) {
    res.status(500).json({ error: 'NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.' });
    return;
  }

  const { keyword, title, body, imageUrl } = req.body || {};
  if (!keyword || !body) {
    res.status(400).json({ error: 'keyword/body가 필요합니다.' });
    return;
  }
  const postTitle = title || keyword; // Gemini가 제목 형식을 안 지켰을 때의 fallback

  // Design Ref: §4.1 node 8 제휴비중 게이트 — module-4
  // TODO: 쇼핑커넥트 연동 후 isAffiliatePost=true일 때 셀러 제공 상품 이미지/링크를
  // 본문에 삽입하는 로직 추가 (현재는 플래그만 전달받음, naver-publish.playwright.js와 동일 범위)

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', NAVER_ID);
    await page.fill('#pw', NAVER_PW);
    await page.click('.btn_login');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('nidlogin')) {
      throw new Error('LOGIN_FAIL: 로그인 실패(캡차/2FA 의심) — 사람 개입 필요');
    }

    await page.goto(`https://blog.naver.com/${NAVER_BLOG_ID}?Redirect=Write`);
    await page.waitForLoadState('networkidle');

    // 2026-11-11 aside로 실제 DOM 검증 완료(읽기 전용 조회). 제목/본문 선택자 교체.
    const frame = page.frameLocator('iframe#mainFrame');
    await frame.locator('.se-documentTitle .se-title-text').click();
    await page.keyboard.type(postTitle, { delay: 30 });
    await frame.locator('.se-component.se-text').first().click();
    await page.keyboard.type(body, { delay: 5 });

    if (imageUrl) {
      // TODO: 이미지 삽입 버튼은 frame.locator('button[data-name="image"]')로 식별됨.
      // 업로드/URL 입력 다이얼로그 흐름은 아직 조사 안 함 — 별도 구현 필요.
    }

    // 카테고리(frame.locator('.se-flayer-unified-category-dropdown-trigger')) /
    // 발행(frame.locator('.publish_btn__v_kS9')) 선택자는 확인했으나 실제 클릭 테스트는 안 했다.
    // 발행 버튼 클릭이 검증되기 전까지는 성공으로 끝내면 안 된다 — 발행 안 된 글을
    // 발행된 것으로 기록해 키워드 소진/중복발행 방지 로직이 오작동하는 사고 방지.
    throw new Error('PUBLISH_NOT_IMPLEMENTED: 카테고리 선택/발행 버튼 클릭은 선택자만 확인됐고 실제 클릭 검증이 안 됐습니다 — 운영자가 1회 감독 하에 테스트 후 구현 필요(SETUP.md §5 참조)');
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  } finally {
    await browser.close();
  }
};
