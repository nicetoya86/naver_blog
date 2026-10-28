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

function checkSecret(req, res) {
  if (!process.env.API_SECRET || req.headers['x-api-secret'] !== process.env.API_SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

module.exports = { launchBrowser, checkSecret };
