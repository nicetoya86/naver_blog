// @sparticuz/chromium은 require 시점에 AWS_EXECUTION_ENV로 AL2/AL2023 라이브러리(libnss3 등) 경로를 정한다.
// Vercel에서 값이 20.x/22.x가 아니면 libnss3 누락으로 기동 실패하므로 require 전에 고정한다(package.json engines=22.x와 맞춤).
process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs22.x';
const chromium = require('@sparticuz/chromium');
const { chromium: playwrightChromium } = require('playwright-core');

// ponytail: @sparticuz/chromium 버전은 Chromium 릴리스에 맞춰 자주 올라간다.
// playwright-core 버전과 호환 안 되면 launch()가 바로 실패하니, 배포 전 한 번 확인할 것.
async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

// 로그인: NAVER_COOKIES(사람이 로컬에서 로그인해 저장한 쿠키 JSON 배열)가 있으면 재사용, 없으면 ID/PW 로그인.
// 서버 IP에서는 캡차/기기인증으로 ID/PW 로그인이 막혀 쿠키 재사용이 기본 경로.
async function naverLogin(page) {
  const { NAVER_ID, NAVER_PW, NAVER_COOKIES } = process.env;
  if (NAVER_COOKIES) {
    await page.context().addCookies(JSON.parse(NAVER_COOKIES));
    await page.goto('https://nid.naver.com/user2/help/myInfoV2?lang=ko_KR');
  } else {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', NAVER_ID);
    await page.fill('#pw', NAVER_PW);
    await page.press('#pw', 'Enter');
  }
  await page.waitForLoadState('networkidle');
  if (page.url().includes('nidlogin')) {
    throw new Error('LOGIN_FAIL: 로그인 실패(캡차/2FA 또는 쿠키 만료) — 사람 개입 필요');
  }
}

function checkSecret(req, res) {
  if (!process.env.API_SECRET || req.headers['x-api-secret'] !== process.env.API_SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

module.exports = { launchBrowser, naverLogin, checkSecret };
