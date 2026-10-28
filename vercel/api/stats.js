// n8n Cloud는 Execute Command 노드를 지원하지 않아, naver-stats.playwright.js를
// 이 Vercel 함수로 옮겼다. n8n의 "Run Stats Script" 노드가 HTTP Request로 이 엔드포인트를 호출한다.
// 필수 환경변수(Vercel 프로젝트 설정): NAVER_ID, NAVER_PW, NAVER_BLOG_ID, API_SECRET
const { launchBrowser, checkSecret } = require('../lib/browser');

module.exports = async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  if (!NAVER_ID || !NAVER_PW || !NAVER_BLOG_ID) {
    res.status(500).json({ error: 'NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.' });
    return;
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', NAVER_ID);
    await page.fill('#pw', NAVER_PW);
    await page.click('.btn_login');
    await page.waitForLoadState('networkidle');

    // 로그인 실패(캡차/2FA 포함) 시 nidlogin 페이지에 그대로 남는다
    if (page.url().includes('nidlogin')) {
      throw new Error('LOGIN_FAIL: 로그인 실패(캡차/2FA 의심) — 사람 개입 필요');
    }

    await page.goto(`https://admin.blog.naver.com/${NAVER_BLOG_ID}/home/visitstat`);
    await page.waitForLoadState('networkidle');

    // TODO: 아래 셀렉터는 실제 통계 페이지 구조에 맞춰 재검증 필요 (SETUP.md §5)
    const visitors = await page.locator('[data-stat="today-visitors"]').innerText().catch(() => null);
    const searchInflow = await page.locator('[data-stat="today-search-inflow"]').innerText().catch(() => null);

    if (visitors === null || searchInflow === null) {
      throw new Error('통계 셀렉터를 찾지 못했습니다. STATS_FETCH_FAIL (페이지 구조 변경 가능성).');
    }

    const result = {
      date: new Date().toISOString().slice(0, 10),
      visitors: parseInt(visitors.replace(/[^0-9]/g, ''), 10),
      searchInflow: parseInt(searchInflow.replace(/[^0-9]/g, ''), 10),
    };

    if (Number.isNaN(result.visitors) || Number.isNaN(result.searchInflow)) {
      throw new Error(`STATS_FETCH_FAIL: 통계 값을 숫자로 파싱하지 못했습니다. visitors="${visitors}" searchInflow="${searchInflow}"`);
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  } finally {
    await browser.close();
  }
};
