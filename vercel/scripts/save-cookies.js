// 로컬에서 실행: 실제 Chrome 창이 뜨면 네이버에 직접 로그인(캡차/2FA 포함)한다.
// 로그인 완료 후 터미널에서 Enter -> naver-cookies.json 저장. 내용을 Vercel 환경변수 NAVER_COOKIES에 붙여넣는다.
// 사용: npm i --no-save playwright-core && node scripts/save-cookies.js
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://nid.naver.com/nidlogin.login');
  console.log('브라우저에서 네이버 로그인 완료 후 이 터미널에서 Enter...');
  await new Promise((r) => process.stdin.once('data', r));
  const cookies = (await ctx.cookies()).filter((c) => c.domain.endsWith('naver.com'));
  require('fs').writeFileSync('naver-cookies.json', JSON.stringify(cookies));
  console.log(`저장: naver-cookies.json (${cookies.length}개)`);
  await browser.close();
  process.exit(0);
})();
