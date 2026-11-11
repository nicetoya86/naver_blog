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

  const { keyword, body, imageUrls, visibility } = req.body || {};
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
    // 이전 발행이 중간에 끊겨 자동저장된 임시글이 있으면 복원 팝업이 뜬다 -> 취소(새 글로 시작)
    await frame.getByRole('button', { name: '취소', exact: true }).click({ timeout: 3000 }).catch(() => {});

    await frame.locator('.se-documentTitle .se-text-paragraph').click();
    await page.keyboard.type(keyword, { delay: 10 });
    await frame.locator('[data-a11y-title="본문"] .se-text-paragraph').first().click();

    // Design Ref: §4.1 node 9 — 본문을 문단 단위로 나눠 이미지를 중간중간 삽입
    // (2026-11-11 네이버 상위노출 경쟁글 벤치마킹: 이미지가 텍스트 사이사이 배치된 패턴, n8n 쪽 문단분할과 동일 기준 /\n{2,}/)
    const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim());
    const urls = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean);
    const insertAfter = new Set(
      urls.map((_, k) => Math.max(0, Math.round(((k + 1) * paragraphs.length) / (urls.length + 1)) - 1)),
    );

    for (let i = 0; i < paragraphs.length; i++) {
      await page.keyboard.type(paragraphs[i], { delay: 2 });
      if (i === paragraphs.length - 1) break;

      if (insertAfter.has(i) && urls.length) {
        await page.keyboard.press('Enter');
        const m = /^data:(image\/\w+);base64,(.+)$/.exec(urls.shift());
        if (m) {
          const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            frame.locator('button[data-name="image"][data-group="documentToolbar"]').click(),
          ]);
          await chooser.setFiles({ name: `image-${i}.jpg`, mimeType: m[1], buffer: Buffer.from(m[2], 'base64') });
          await page.waitForTimeout(3000); // 업로드 완료 대기
          // 업로드 후 "라이브러리" 팝업이 뜰 때가 있다(2026-11-11 aside 실측) — 포커스를 뺏어가 이후 타이핑이
          // 엉뚱한 곳에 들어갈 수 있어 뜨면 닫는다(없으면 무시).
          await frame.getByRole('button', { name: '팝업 닫기' }).click({ timeout: 2000 }).catch(() => {});
        }
      }
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
    }

    // Plan FR 품질 게이트와 별개로, 타이핑 자체가 중간에 깨지는지 발행 직전에 확인한다.
    // (2026-11-11 aside 실측: 이미지 삽입 직후 팝업 처리 중 포커스 유실로 문단이 조용히 누락된 사례 발견)
    // 문단이 실제로 에디터에 들어갔는지 각 문단 앞부분으로 검증하고, 빠진 게 있으면 발행 없이 바로 실패 처리한다.
    const typedText = await frame.locator('[data-a11y-title="본문"]').innerText();
    const missing = paragraphs.filter((p) => !typedText.includes(p.slice(0, 15)));
    if (missing.length) {
      throw new Error(`본문 타이핑 검증 실패: ${missing.length}개 문단이 에디터에 반영되지 않음(포커스 유실 의심)`);
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
