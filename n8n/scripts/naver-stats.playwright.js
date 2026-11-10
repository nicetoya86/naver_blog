#!/usr/bin/env node
// Design Ref: §4.2 monitor-alert node 2 — 통계 수집
// 네이버 블로그 통계(오늘의 방문자, 검색유입 수)를 가져와 JSON으로 stdout에 출력한다.
// n8n Execute Command 노드가 이 스크립트를 실행하고 stdout을 다음 노드(Parse & Compare)로 넘긴다.
//
// 필수 환경변수(n8n Credentials -> Execute Command 노드 Environment Variables로 주입):
//   NAVER_ID, NAVER_PW   : 자동화 전용 네이버 계정
//   NAVER_BLOG_ID        : 통계를 조회할 블로그 ID (예: myblogid)
//
// 2026-11-11 aside로 실제 DOM 1회 검증 완료(nicetoya 계정 로그인 상태):
// - `/home/visitstat` 경로는 사라졌다. 방문자수는 `/stat/uv`, 검색유입은 `/stat/referer`.
// - 검색유입은 "검색 유입 수"(절대값)가 아니라 유입경로 중 검색 비중(%)으로만 노출된다.
//   급락 판정(Parse & Compare 노드)은 day-over-day dropRate 비교라 % 값으로도 구조적으로는 동작하지만,
//   의미가 "검색 유입 건수 급락"이 아니라 "검색 유입 비중 급락"으로 바뀐다 — 운영 중 오탐 여부 확인 필요.
// ponytail: 선택자가 CSS 모듈 해시 클래스(`__xxxx`)라 네이버 배포 시 깨질 수 있다. 깨지면 재검증.

const { chromium } = require('playwright');

async function main() {
  const { NAVER_ID, NAVER_PW, NAVER_BLOG_ID } = process.env;
  if (!NAVER_ID || !NAVER_PW || !NAVER_BLOG_ID) {
    throw new Error('NAVER_ID, NAVER_PW, NAVER_BLOG_ID 환경변수가 필요합니다.');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', NAVER_ID);
    await page.fill('#pw', NAVER_PW);
    await page.click('.btn_login');
    await page.waitForLoadState('networkidle');

    // 로그인 실패(캡차/2FA 포함) 시 nidlogin 페이지에 그대로 남는다 — Design §6.1 LOGIN_FAIL
    if (page.url().includes('nidlogin')) {
      throw new Error('LOGIN_FAIL: 로그인 실패(캡차/2FA 의심) — 사람 개입 필요');
    }

    await page.goto(`https://admin.blog.naver.com/${NAVER_BLOG_ID}/stat/uv`);
    await page.waitForLoadState('networkidle');
    const statFrame = page.frameLocator('iframe[name="statmain"]');
    const visitors = await statFrame.locator('.u_ni_value_wrap__1vART span.u_ni_value__xjQzF').innerText().catch(() => null);

    await page.goto(`https://admin.blog.naver.com/${NAVER_BLOG_ID}/stat/referer`);
    await page.waitForLoadState('networkidle');
    await page.locator('a[data-nclk="search"]').click().catch(() => {});
    const searchInflow = await page.frameLocator('iframe[name="statmain"]').locator('span.u_ni_data__1FOoZ').innerText().catch(() => null);

    if (visitors === null || searchInflow === null) {
      throw new Error('통계 셀렉터를 찾지 못했습니다. Design §6.1 STATS_FETCH_FAIL 처리 필요 (페이지 구조 변경 가능성).');
    }

    const result = {
      date: new Date().toISOString().slice(0, 10),
      visitors: parseInt(visitors.replace(/[^0-9]/g, ''), 10),
      searchInflow: parseInt(searchInflow.replace(/[^0-9]/g, ''), 10)
    };

    if (Number.isNaN(result.visitors) || Number.isNaN(result.searchInflow)) {
      throw new Error('STATS_FETCH_FAIL: 통계 값을 숫자로 파싱하지 못했습니다 (페이지 구조 변경 가능성). visitors="' + visitors + '" searchInflow="' + searchInflow + '"');
    }

    process.stdout.write(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
