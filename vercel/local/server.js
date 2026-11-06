// 로컬 PC에서 Vercel 함수(api/publish, api/stats)를 그대로 실행하는 최소 서버.
// 실행: node --env-file=.env local/server.js   (.env: API_SECRET, NAVER_*, LOCAL_CHROME=1 등)
// 외부 공개는 cloudflared 터널: cloudflared tunnel --url http://localhost:3000
const http = require('http');
const routes = { '/api/publish': require('../api/publish'), '/api/stats': require('../api/stats') };

http.createServer((req, res) => {
  const handler = routes[req.url.split('?')[0]];
  if (!handler) return res.writeHead(404).end();
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (n) => { res.statusCode = n; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    try { await handler(req, res); } catch (e) { if (!res.writableEnded) res.status(500).json({ error: String(e.message || e) }); }
  });
}).listen(process.env.PORT || 3000, () => console.log('listening', process.env.PORT || 3000));
