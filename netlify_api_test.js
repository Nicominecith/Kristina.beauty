const http = require('http');
function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: 8888, path, agent: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}
function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: 8888, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, agent: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
(async () => {
  try {
    console.log('GET /api/coupon/SAVE5-A8K2P');
    console.log(await get('/api/coupon/SAVE5-A8K2P'));
    console.log('POST /api/redeem');
    console.log(await post('/api/redeem', { codes: ['SAVE5-A8K2P'] }));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
