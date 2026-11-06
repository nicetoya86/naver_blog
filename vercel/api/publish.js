// n8n Cloud는 Execute Command 노드를 지원하지 않아, naver-publish.playwright.js를
// 이 Vercel 함수로 옮겼다. n8n의 "Playwright 발행" 노드가 draft를 파일이 아니라
// 요청 본문(JSON)으로 직접 보낸다(서버리스 환경은 n8n과 파일시스템을 공유하지 않음).
// 필수 환경변수(Vercel 프로젝트 설정): NAVER_ID, NAVER_PW, NAVER_BLOG_ID, API_SECRET
const { launchBrowser, naverLogin, checkSecret } = require('../lib/browser');

module.exports = async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  if (!NAVER_BLOG_ID || (!process.env.NAVER_COOKIES && (!NAVER_ID || !NAVER_PW))) {
    res.status(500).json({ error: 'NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.' });
    return;
  }

  const { keyword, body, imageUrl, visibility } = req.body || {};
  if (!keyword || !body) {
    res.status(400).json({ error: 'keyword/body가 필요합니다.' });
    return;
  }

  // Design Ref: §4.1 node 8 제휴비중 게이트 — module-4
  // TODO: 쇼핑커넥트 연동 후 isAffiliatePost=true일 때 셀러 제공 상품 이미지/링크를
  // 본문에 삽입하는 로직 추가 (현재는 플래그만 전달받음, naver-publish.playwright.js와 동일 범위)

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await naverLogin(page);

    await page.goto(`https://blog.naver.com/${NAVER_BLOG_ID}?Redirect=Write`);
    await page.waitForLoadState('networkidle');

    // 셀렉터는 2026-11 실제 에디터 DOM에서 확인(해시 붙은 CSS 클래스 대신 data 속성 사용).
    const frame = page.frameLocator('iframe#mainFrame');
    // 도움말 오버레이가 뜨면 닫는다(없으면 무시)
    await frame.getByRole('button', { name: '닫기' }).first().click({ timeout: 3000 }).catch(() => {});

    await frame.locator('.se-documentTitle .se-text-paragraph').click();
    await page.keyboard.type(keyword, { delay: 10 });
    await frame.locator('[data-a11y-title="본문"] .se-text-paragraph').first().click();
    await page.keyboard.type(body, { delay: 2 });

    // imageUrl은 n8n이 보내는 data URI(base64 JPEG). 파일 선택창에 버퍼로 주입.
    const m = imageUrl && /^data:(image\/\w+);base64,(.+)$/.exec(imageUrl);
    if (m) {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        frame.locator('button[data-name="image"]').click(),
      ]);
      await chooser.setFiles({ name: 'image.jpg', mimeType: m[1], buffer: Buffer.from(m[2], 'base64') });
      await page.waitForTimeout(3000); // 업로드 완료 대기
    }

    // ponytail: 카테고리는 기본값 사용. 지정 필요 시 발행 패널의 '.option_category__* button'(해시 클래스) 클릭 추가.
    await frame.locator('button[data-click-area="tpb.publish"]').click();
    // 테스트용: visibility === 'private'이면 비공개로 발행(기본은 패널 기본값=전체공개)
    if (visibility === 'private') await frame.locator('label[for="open_private"]').click();
    await frame.locator('button[data-testid="seOnePublishBtn"]').click();
    // 발행 성공 = 글 보기 URL(logNo)로 이동. 안 되면 실패로 처리(발행 안 된 글을 성공 기록하지 않기 위함).
    await page.waitForURL(/logNo=|\/\d{6,}/, { timeout: 30000 });
    res.status(200).json({ ok: true, url: page.url() });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  } finally {
    await browser.close();
  }
};
