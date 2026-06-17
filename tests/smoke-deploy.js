const http = require('http');
const assert = require('assert');

const BASE = 'http://localhost:3000';
const API = `${BASE}/api/admin`;
let passed = 0, failed = 0;
let publisherToken, editorToken, journalistToken;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method, headers: { 'Content-Type': 'application/json', ...headers }
    };
    const h = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    h.on('error', reject);
    if (body) h.write(JSON.stringify(body));
    h.end();
  });
}

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}: ${detail}`); }
}

(async () => {
  console.log('\n═══════════════════════════════════════════');
  console.log('  LOCAL SMOKE VERIFICATION');
  console.log('═══════════════════════════════════════════\n');

  // ── 1. Publisher login ──
  r = await req('POST', '/api/admin/auth', { username: 'pub1', password: 'pass1234' });
  publisherToken = r.body?.token;
  check('1. Publisher login', r.status === 200 && !!publisherToken, `status=${r.status}, token=${!!publisherToken}`);

  // ── 2. Editor login ──
  r = await req('POST', '/api/admin/auth', { username: 'editor1', password: 'pass1234' });
  editorToken = r.body?.token;
  check('2. Editor login', r.status === 200 && !!editorToken, `status=${r.status}`);

  // ── 3. Journalist login ──
  r = await req('POST', '/api/admin/auth', { username: 'journo1', password: 'pass1234' });
  journalistToken = r.body?.token;
  check('3. Journalist login', r.status === 200 && !!journalistToken, `status=${r.status}`);

  // ── 4. User creation (publisher only) — use unique username ──
  const smokeUser = 'smoke' + Date.now();
  r = await req('POST', '/api/admin/users', { fullName: 'Smoke Test', username: smokeUser, password: 'smokepass123', role: 'journalist' }, { 'x-admin-auth': publisherToken });
  check('4. User creation', r.status === 201, `status=${r.status}`);
  const smokeUserId = r.body?.id;
  if (!smokeUserId) console.log('  ⚠ No user ID returned for new user');

  // ── 5. User suspension/activation ──
  r = await req('POST', `/api/admin/users/${smokeUserId}/suspend`, {}, { 'x-admin-auth': publisherToken });
  check('5a. User suspension', r.status === 200, `status=${r.status}`);
  r = await req('POST', `/api/admin/users/${smokeUserId}/activate`, {}, { 'x-admin-auth': publisherToken });
  check('5b. User activation', r.status === 200, `status=${r.status}`);

  // ── 6. Role assignment ──
  r = await req('POST', `/api/admin/users/${smokeUserId}/role`, { role: 'editor_in_chief' }, { 'x-admin-auth': publisherToken });
  check('6. Role assignment', r.status === 200, `status=${r.status}`);

  // ── 7. Password reset ──
  r = await req('POST', `/api/admin/users/${smokeUserId}/reset-password`, { password: 'newpass1234' }, { 'x-admin-auth': publisherToken });
  check('7. Password reset', r.status === 200, `status=${r.status}`);

  // ── 8. Suspended user login blocked ──
  r = await req('POST', `/api/admin/users/${smokeUserId}/suspend`, {}, { 'x-admin-auth': publisherToken });
  r = await req('POST', '/api/admin/auth', { username: smokeUser, password: 'newpass1234' });
  check('8. Suspended user login blocked', r.status === 401 || r.status === 403, `status=${r.status}`);

  // ── 9. Failed-login lockout (using journalist to avoid locking publisher) ──
  let fails = 0;
  for (let i = 0; i < 6; i++) {
    r = await req('POST', '/api/admin/auth', { username: 'journo1', password: 'wrongpass' });
    if (r.status !== 200) fails++;
  }
  check('9. Failed-login lockout', fails >= 5, `${fails} rejects out of 6 attempts`);
  // Also verify correct password for locked user returns 401 or 429
  r = await req('POST', '/api/admin/auth', { username: 'journo1', password: 'pass1234' });
  check('9b. Locked user cannot auth even with correct pw', r.status !== 200, `status=${r.status}`);

  // ── 10. Audit log ──
  const dbCheck = require('../database');
  const auditLog = dbCheck.query('audit_log');
  const hasUserActions = auditLog.some(e => e.action && (e.action.includes('user.create') || e.action.includes('user.update') || e.action.includes('user.suspend')));
  check('10. Audit log generation', hasUserActions, `audit entries: ${auditLog.length}`);

  // ── 11. Featured Stories access control ──
  r = await req('GET', '/api/admin/featured-stories', null, { 'x-admin-auth': publisherToken });
  check('11a. Featured list (publisher)', r.status === 200, `status=${r.status}`);
  r = await req('GET', '/api/admin/featured-stories', null, { 'x-admin-auth': journalistToken });
  check('11b. Featured list (journalist view)', r.status === 200, `status=${r.status}`);
  // Journalist cannot create featured stories
  r = await req('POST', '/api/admin/featured-stories', { article_id: 99999 }, { 'x-admin-auth': journalistToken });
  check('11c. Featured create (journalist blocked)', r.status === 403, `status=${r.status}`);

  // ── 12. Breaking News access control ──
  r = await req('GET', '/api/admin/breaking-news', null, { 'x-admin-auth': publisherToken });
  check('12a. Breaking News list (publisher)', r.status === 200, `status=${r.status}`);
  r = await req('GET', '/api/admin/breaking-news', null, { 'x-admin-auth': journalistToken });
  check('12b. Breaking News list (journalist view)', r.status === 200, `status=${r.status}`);
  // Journalist cannot create breaking news
  r = await req('POST', '/api/admin/breaking-news', { title: 'test', content: 'test' }, { 'x-admin-auth': journalistToken });
  check('12c. Breaking News create (journalist blocked)', r.status === 403, `status=${r.status}`);

  // ── Summary ──
  console.log(`\n───────────────────────────────────────────`);
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`);
  console.log(`───────────────────────────────────────────`);
  if (failed > 0) {
    console.log(`\n❌ DEPLOYMENT BLOCKED`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL CHECKS PASSED — READY TO DEPLOY`);
  }
})().catch(e => { console.error('Smoke test error:', e.message); process.exit(1); });
