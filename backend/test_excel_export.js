/**
 * TEAM PULSE — Excel Export Verification Test
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const cookie = res.headers['set-cookie'];
        const contentType = res.headers['content-type'] || '';
        const disposition = res.headers['content-disposition'] || '';
        try {
          if (contentType.includes('application/json')) {
            resolve({ status: res.statusCode, data: JSON.parse(buffer.toString()), headers: res.headers, cookie, buffer });
          } else {
            resolve({ status: res.statusCode, data: null, headers: res.headers, cookie, buffer, contentType, disposition });
          }
        } catch (e) {
          resolve({ status: res.statusCode, body: buffer.toString(), cookie, buffer });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runExcelTests() {
  console.log('🧪 Testing Team Pulse Excel (.xlsx) Report Endpoints...\n');

  // 1. Login
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'sanjaysanjayt19@gmail.com', password: 'Siva1908', team_id: 1 });

  if (loginRes.status !== 200) {
    throw new Error('Login failed with status ' + loginRes.status);
  }
  const cookie = loginRes.cookie ? loginRes.cookie[0].split(';')[0] : '';
  console.log('✅ Logged in successfully as Super Admin');

  // 2. Test Daily Excel Export
  console.log('\n📊 1. Testing /api/reports/export/daily');
  const dailyRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/export/daily',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Status:', dailyRes.status);
  console.log('   Content-Type:', dailyRes.contentType);
  console.log('   Content-Disposition:', dailyRes.disposition);
  console.log('   File Size:', dailyRes.buffer.length, 'bytes');
  if (dailyRes.status !== 200 || dailyRes.buffer.length < 1000) {
    throw new Error('Daily Excel export failed');
  }
  console.log('   ✅ Daily Excel export verified!');

  // 3. Test Weekly Excel Export
  console.log('\n📊 2. Testing /api/reports/export/weekly');
  const weeklyRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/export/weekly',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Status:', weeklyRes.status);
  console.log('   Content-Type:', weeklyRes.contentType);
  console.log('   Content-Disposition:', weeklyRes.disposition);
  console.log('   File Size:', weeklyRes.buffer.length, 'bytes');
  if (weeklyRes.status !== 200 || weeklyRes.buffer.length < 1000) {
    throw new Error('Weekly Excel export failed');
  }
  console.log('   ✅ Weekly Excel export verified!');

  // 4. Test Monthly Excel Export
  console.log('\n📊 3. Testing /api/reports/export/monthly');
  const monthlyRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/export/monthly',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Status:', monthlyRes.status);
  console.log('   Content-Type:', monthlyRes.contentType);
  console.log('   Content-Disposition:', monthlyRes.disposition);
  console.log('   File Size:', monthlyRes.buffer.length, 'bytes');
  if (monthlyRes.status !== 200 || monthlyRes.buffer.length < 1000) {
    throw new Error('Monthly Excel export failed');
  }
  console.log('   ✅ Monthly Excel export verified!');

  // 5. Test Tasks Excel Export
  console.log('\n📊 4. Testing /api/tasks/export/excel');
  const tasksRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/export/excel',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Status:', tasksRes.status);
  console.log('   Content-Type:', tasksRes.contentType);
  console.log('   Content-Disposition:', tasksRes.disposition);
  console.log('   File Size:', tasksRes.buffer.length, 'bytes');
  if (tasksRes.status !== 200 || tasksRes.buffer.length < 1000) {
    throw new Error('Tasks Excel export failed');
  }
  console.log('   ✅ Tasks Excel export verified!');

  console.log('\n🎉 ALL 4 EXCEL EXPORT ENDPOINTS WORKING PERFECTLY!');
}

runExcelTests().catch(err => {
  console.error('❌ Excel Test error:', err);
  process.exit(1);
});
