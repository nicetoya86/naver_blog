// n8n Cloud는 Execute Command 노드를 지원하지 않아, naver-stats.playwright.js를
// 이 Vercel 함수로 옮겼다. n8n의 "Run Stats Script" 노드가 HTTP Request로 이 엔드포인트를 호출한다.
// 필수 환경변수(Vercel 프로젝트 설정): NAVER_ID, NAVER_PW, NAVER_BLOG_ID, API_SECRET
const { launchBrowser, naverLogin, checkSecret } = require('../lib/browser');

module.exports = async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  if (!NAVER_BLOG_ID || (!process.env.NAVER_COOKIES && (!NAVER_ID || !NAVER_PW))) {
    res.status(500).json({ error: 'NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.' });
    return;
  }

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await naverLogin(page);

    // 2026-11-11 aside로 실제 DOM 검증 완료: `/home/visitstat` 경로는 사라졌다.
    // 검색유입은 절대 건수가 아니라 유입경로 중 검색 비중(%)으로만 노출됨(아래 searchInflow는 %값).
    await page.goto(`https://admin.blog.naver.com/${NAVER_BLOG_ID}/stat/uv`);
    await page.waitForLoadState('networkidle');
    const visitors = await page.frameLocator('iframe[name="statmain"]').locator('.u_ni_value_wrap__1vART span.u_ni_value__xjQzF').innerText().catch(() => null);

    await page.goto(`https://admin.blog.naver.com/${NAVER_BLOG_ID}/stat/referer`);
    await page.waitForLoadState('networkidle');
    await page.locator('a[data-nclk="search"]').click().catch(() => {});
    const searchInflow = await page.frameLocator('iframe[name="statmain"]').locator('span.u_ni_data__1FOoZ').innerText().catch(() => null);

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
