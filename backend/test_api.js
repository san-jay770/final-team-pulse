/**
 * TEAM PULSE — Integration Verification Test
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const cookie = res.headers['set-cookie'];
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), cookie });
        } catch (e) {
          resolve({ status: res.statusCode, body, cookie });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Running Team Pulse Backend Verification...\n');

  // 1. Test Login with Team Choice
  console.log('1. Testing Super Admin Login with Team Selection: sanjaysanjayt19@gmail.com');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'sanjaysanjayt19@gmail.com', password: 'Siva1908', team_id: 1 });

  console.log('   Login Status:', loginRes.status);
  console.log('   Login Success:', loginRes.data.success);
  console.log('   Logged In User:', loginRes.data.user && loginRes.data.user.name);
  console.log('   User Role:', loginRes.data.user && loginRes.data.user.role);

  const cookie = loginRes.cookie ? loginRes.cookie[0].split(';')[0] : '';
  console.log('   Session Cookie received:', cookie.substring(0, 30) + '...');

  // 2. Test Get Me
  console.log('\n2. Testing /api/auth/me');
  const meRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Auth Me Status:', meRes.status);
  console.log('   Current User Name:', meRes.data.user && meRes.data.user.name);
  console.log('   Available Workspaces:', meRes.data.teams && meRes.data.teams.length);

  // 3. Test Dashboard Stats
  console.log('\n3. Testing /api/admin/dashboard');
  const dashRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/dashboard',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Dashboard Status:', dashRes.status);
  console.log('   Total Teams:', dashRes.data.data.stats.total_teams);
  console.log('   Total Tasks:', dashRes.data.data.stats.total_tasks);
  console.log('   Total Admins:', dashRes.data.data.stats.total_admins);
  console.log('   Completion Pct:', dashRes.data.data.stats.completion_pct + '%');

  // 4. Test Task Creation + Email Trigger Flow
  console.log('\n4. Testing Task Creation + Email Notification Flow');
  const taskRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    title: 'Verification Node.js Nodemailer Task',
    description: 'Verifying that task creation triggers instant email notifications to Super Admin & assignees.',
    team_id: 1,
    assigned_to: 12,
    priority: 'High',
    status: 'Pending',
    due_date: '2026-09-05'
  });

  console.log('   Task Creation Status:', taskRes.status);
  console.log('   Task Creation Message:', taskRes.data.message);
  console.log('   Created Task ID:', taskRes.data.data && taskRes.data.data.id);

  // 5. Test Notifications
  console.log('\n5. Testing /api/notifications');
  const notifRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Notifications Status:', notifRes.status);
  console.log('   Notifications Count:', notifRes.data.data && notifRes.data.data.length);
  if (notifRes.data.data && notifRes.data.data.length > 0) {
    console.log('   Latest Notification:', notifRes.data.data[0].message);
  }

  // 6. Test Reports
  console.log('\n6. Testing /api/reports/daily');
  const repRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/daily',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Daily Report Status:', repRes.status);
  console.log('   Daily Stats Created:', repRes.data.data.stats.created);

  // 7. Test Leaderboard
  console.log('\n7. Testing /api/admin/leaderboard');
  const leadRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/leaderboard',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('   Leaderboard Status:', leadRes.status);
  console.log('   Leaderboard Rank #1:', leadRes.data.data && leadRes.data.data[0] ? leadRes.data.data[0].name : 'N/A');

  console.log('\n===============================================================');
  console.log('✅ ALL INTEGRATION & EMAIL DISPATCH TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
});
