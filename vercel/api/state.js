// daily-publish/monitor-alert 두 n8n 워크플로우가 emergencyBrake를 공유하기 위한 엔드포인트.
// monitor-alert의 "긴급브레이크 ON" 노드가 POST로 설정하고,
// daily-publish의 "공유상태 읽기 (긴급브레이크)" 노드가 GET으로 조회한다.
// 필수 환경변수: API_SECRET(공통), EDGE_CONFIG(읽기), VERCEL_API_TOKEN/EDGE_CONFIG_ID(쓰기)
const { checkSecret } = require('../lib/browser');
const { getEmergencyBrake, setEmergencyBrake } = require('../lib/edgeConfig');

module.exports = async (req, res) => {
  if (!checkSecret(req, res)) return;

  if (req.method === 'GET') {
    const emergencyBrake = await getEmergencyBrake();
    res.status(200).json({ emergencyBrake });
    return;
  }

  if (req.method === 'POST') {
    const { emergencyBrake } = req.body || {};
    if (typeof emergencyBrake !== 'boolean') {
      res.status(400).json({ error: 'emergencyBrake(boolean)가 필요합니다.' });
      return;
    }
    await setEmergencyBrake(emergencyBrake);
    res.status(200).json({ ok: true, emergencyBrake });
    return;
  }

  res.status(405).json({ error: 'GET 또는 POST만 지원합니다.' });
};
