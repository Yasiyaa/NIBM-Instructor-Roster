export {};

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_DATABASE_URL_UNPOOLED) {
  console.error('❌ TEST_DATABASE_URL / TEST_DATABASE_URL_UNPOOLED are not set.');
  process.exit(1);
}

function ensureConnectTimeout(urlStr: string): string {
  if (urlStr.includes('connect_timeout=')) return urlStr;
  const separator = urlStr.includes('?') ? '&' : '?';
  return `${urlStr}${separator}connect_timeout=20`;
}

process.env.DATABASE_URL = ensureConnectTimeout(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL_UNPOOLED = ensureConnectTimeout(process.env.TEST_DATABASE_URL_UNPOOLED);

try {
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  } as unknown as NodeModule;
} catch {}

async function runMobileApiVerification() {
  console.log('====================================================');
  console.log('📱 VERIFYING MOBILE COMPANION API ENDPOINTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  const { POST: loginHandler } = await import('../src/app/api/mobile/auth/login/route');
  const { GET: meHandler } = await import('../src/app/api/mobile/auth/me/route');
  const { POST: pushTokenPost, DELETE: pushTokenDelete } = await import('../src/app/api/mobile/push-token/route');
  const { GET: scheduleHandler } = await import('../src/app/api/mobile/schedule/route');
  const { GET: leavesGet } = await import('../src/app/api/mobile/leaves/route');
  const { GET: dashboardHandler } = await import('../src/app/api/mobile/dashboard/route');




  // 1. Mobile Login: Invalid credentials
  const badLoginReq = new Request('http://localhost/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kithnuka', password: 'wrongpassword' }),
  });
  const badLoginRes = await loginHandler(badLoginReq);
  assert(badLoginRes.status === 401, 'Bad credentials correctly rejected with 401');

  // 2. Mobile Login: Valid credentials
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'demo1234';
  const validLoginReq = new Request('http://localhost/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const validLoginRes = await loginHandler(validLoginReq);
  const loginData = await validLoginRes.json();
  assert(validLoginRes.status === 200, 'Valid credentials login returns 200 OK');
  assert(typeof loginData.token === 'string' && loginData.token.length > 20, 'Login response contains signed JWT token');
  assert(loginData.user && loginData.user.username === username.toLowerCase(), 'Login response returns user profile');

  const token = loginData.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. /api/mobile/auth/me with Bearer token
  const meReq = new Request('http://localhost/api/mobile/auth/me', {
    headers: authHeaders,
  });
  const meRes = await meHandler(meReq);
  const meData = await meRes.json();
  assert(meData.user && meData.user.username === username.toLowerCase(), 'Authenticated user profile matches identity');

  // 4. Register mock Expo Push Token
  const mockToken = 'ExponentPushToken[mock-test-token-12345]';
  const pushPostReq = new Request('http://localhost/api/mobile/push-token', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ token: mockToken, device: 'iPhone 15 Pro' }),
  });
  const pushPostRes = await pushTokenPost(pushPostReq);
  assert(pushPostRes.status === 200, 'Push token successfully registered via API');

  // 5. Query schedule
  const schedReq = new Request('http://localhost/api/mobile/schedule?startDate=2026-10-05', {
    headers: authHeaders,
  });
  const schedRes = await scheduleHandler(schedReq);
  const schedData = await schedRes.json();
  assert(schedRes.status === 200, 'Schedule endpoint returns 200 OK');
  assert(Array.isArray(schedData.instructors) && schedData.instructors.length === 9, 'Schedule contains 9 instructors');
  assert(Array.isArray(schedData.mergedDuties), 'Schedule returns pre-merged duty assignments');

  // 6. Query leaves
  const leavesReq = new Request('http://localhost/api/mobile/leaves', {
    headers: authHeaders,
  });
  const leavesRes = await leavesGet(leavesReq);
  const leavesData = await leavesRes.json();
  assert(leavesRes.status === 200, 'Leaves endpoint returns 200 OK');
  assert(Array.isArray(leavesData.leaves), 'Leaves endpoint returns array of leave requests');

  // 7. Query executive dashboard status
  const dashReq = new Request('http://localhost/api/mobile/dashboard?date=2026-10-06', {
    headers: authHeaders,
  });
  const dashRes = await dashboardHandler(dashReq);
  const dashData = await dashRes.json();
  assert(dashRes.status === 200, 'Dashboard endpoint returns 200 OK');
  assert(dashData.report && Array.isArray(dashData.report.onDuty), 'Dashboard contains onDuty array');
  assert(dashData.report && Array.isArray(dashData.report.freeStandby), 'Dashboard contains freeStandby array');

  // 8. Delete mock push token on logout
  const pushDeleteReq = new Request('http://localhost/api/mobile/push-token', {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ token: mockToken }),
  });
  const pushDeleteRes = await pushTokenDelete(pushDeleteReq);
  assert(pushDeleteRes.status === 200, 'Push token successfully removed on logout');

  // 9. Public Board endpoint (no auth required)
  const { GET: publicBoardGet } = await import('../src/app/api/mobile/public-board/route');
  const pubReq = new Request('http://localhost/api/mobile/public-board');
  const pubRes = await publicBoardGet(pubReq);
  const pubData = await pubRes.json();
  assert(pubRes.status === 200, 'Public Board endpoint returns 200 without authentication');
  assert(pubData.executiveReport && Array.isArray(pubData.instructors), 'Public board contains live executive report and instructors');

  // 10. Update own profile
  const { PATCH: profilePatch } = await import('../src/app/api/mobile/auth/profile/route');
  const profReq = new Request('http://localhost/api/mobile/auth/profile', {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ phone: '+94 77 123 4567' }),
  });
  const profRes = await profilePatch(profReq);
  const profData = await profRes.json();
  assert(profRes.status === 200, 'Profile update returns 200 OK');
  assert(profData.user && profData.user.phone === '+94 77 123 4567', 'Profile update persisted new phone number');

  // 11. Duty Allocation & Deletion (Admin/Demonstrator)
  const { POST: dutyPost, DELETE: dutyDelete } = await import('../src/app/api/mobile/schedule/duty/route');
  const firstInstId = schedData.instructors[0].id;
  const weekId = schedData.week.id;
  const newDutyReq = new Request('http://localhost/api/mobile/schedule/duty', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rosterWeekId: weekId,
      instructorId: firstInstId,
      dutyDate: '2026-10-06',
      slotLabel: 'Test Mobile Slot (16:30 - 19:30)',
      startTime: '16:30',
      endTime: '19:30',
      dutyType: 'Student Support',
      batchName: 'TEST-BATCH',
      roomLab: 'Lab Test',
    }),
  });
  const newDutyRes = await dutyPost(newDutyReq);
  const newDutyData = await newDutyRes.json();
  assert(newDutyRes.status === 200, 'Assign duty returns 200 OK');
  assert(newDutyData.assignment && newDutyData.assignment.id, 'Duty assignment created with ID');

  const assignedDutyId = newDutyData.assignment.id;
  const delDutyReq = new Request(`http://localhost/api/mobile/schedule/duty?id=${encodeURIComponent(assignedDutyId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const delDutyRes = await dutyDelete(delDutyReq);
  assert(delDutyRes.status === 200, 'Delete duty assignment returns 200 OK');

  // 12. Roster Publish toggle
  const { POST: publishPost } = await import('../src/app/api/mobile/schedule/publish/route');
  const pubToggleReq = new Request('http://localhost/api/mobile/schedule/publish', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ weekId, action: 'publish' }),
  });
  const pubToggleRes = await publishPost(pubToggleReq);
  const pubToggleData = await pubToggleRes.json();
  assert(pubToggleRes.status === 200, 'Publish roster endpoint returns 200 OK');
  assert(pubToggleData.week && pubToggleData.week.status === 'PUBLISHED', 'Roster week status transitioned to PUBLISHED');

  console.log('\n====================================================');
  console.log(`🎯 MOBILE API RESULTS: ${passed}/${total} TESTS PASSED!`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMobileApiVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
