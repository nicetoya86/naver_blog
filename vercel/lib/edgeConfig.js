// n8n Cloud는 워크플로우마다 Code 노드가 샌드박스 처리되어 fs/os/path 같은 Node 내장
// 모듈에 접근할 수 없다(Execute Command 노드 미지원과 같은 정책). 그래서 두 워크플로우가
// 공유 파일(`$PROJECT_ROOT/.n8n-shared-state.json`)로 emergencyBrake를 주고받던 기존 방식은
// n8n Cloud에서 동작하지 않는다. 새 외부 서비스를 추가하는 대신, 이미 쓰고 있는 Vercel
// 프로젝트의 Edge Config(소규모 키-값 공유 저장소, 무료 티어 포함)를 재사용한다.
const { createClient } = require('@vercel/edge-config');

// Vercel이 "Edge Config"를 "Global Config"로 리브랜딩하면서 프로젝트에 연결 시
// 자동 주입되는 환경변수 이름이 EDGE_CONFIG가 아니라 GLOBAL_CONFIG로 나오는 경우가 있다.
// @vercel/edge-config의 기본 get()은 EDGE_CONFIG만 찾으므로, 둘 중 있는 값으로 직접
// 클라이언트를 만들어 이름 차이에 구애받지 않게 한다.
const connectionString = process.env.EDGE_CONFIG || process.env.GLOBAL_CONFIG;
const client = connectionString ? createClient(connectionString) : null;

async function getEmergencyBrake() {
  if (!client) {
    throw new Error('EDGE_CONFIG 또는 GLOBAL_CONFIG 환경변수가 없습니다 (n8n/SETUP.md §3.1 참조).');
  }
  const value = await client.get('emergencyBrake');
  return value === true;
}

async function setEmergencyBrake(value) {
  const { VERCEL_API_TOKEN, EDGE_CONFIG_ID, VERCEL_TEAM_ID } = process.env;
  if (!VERCEL_API_TOKEN || !EDGE_CONFIG_ID) {
    throw new Error('VERCEL_API_TOKEN, EDGE_CONFIG_ID 환경변수가 필요합니다 (n8n/SETUP.md §3.1 참조).');
  }
  const url = `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ''}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: 'emergencyBrake', value }] }),
  });
  if (!resp.ok) {
    throw new Error(`Edge Config 쓰기 실패: ${resp.status} ${await resp.text()}`);
  }
}

module.exports = { getEmergencyBrake, setEmergencyBrake };
