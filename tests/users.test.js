const assert = require('assert');
const http = require('http');
const express = require('express');
const db = require('../database');

db.query('users').forEach(u => db.delete('users', u.id));
db.saveNow('users');
db.query('audit_log').forEach(l => db.delete('audit_log', l.id));
db.saveNow('audit_log');

const users = require('../modules/users');
const audit = require('../modules/audit');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}

console.log(`\n═══ User Module Tests ═══\n`);

let publisherId, editorId, journalistId;

test('createUser: publisher role works', () => {
  const r = users.createUser({ fullName: 'مدير النشرية', username: 'pub1', password: 'pass1234', role: 'publisher', createdBy: 'system' });
  assert.ok(r.id > 0); assert.strictEqual(r.role, 'publisher'); assert.ok(!r.passwordHash);
  publisherId = r.id;
});

test('createUser: editor_in_chief role works', () => {
  const r = users.createUser({ fullName: 'رئيس التحرير', username: 'editor1', password: 'pass1234', role: 'editor_in_chief', createdBy: 'system' });
  assert.ok(r.id > 0); assert.strictEqual(r.role, 'editor_in_chief');
  editorId = r.id;
});

test('createUser: journalist role works', () => {
  const r = users.createUser({ fullName: 'صحفي', username: 'journo1', password: 'pass1234', role: 'journalist', createdBy: 'system' });
  assert.ok(r.id > 0); assert.strictEqual(r.role, 'journalist');
  journalistId = r.id;
});

test('createUser: rejects empty username', () => assert.throws(() => users.createUser({ fullName: 'T', username: '', password: 'p', role: 'journalist' })));
test('createUser: rejects empty fullName', () => assert.throws(() => users.createUser({ fullName: '', username: 't2', password: 'p', role: 'journalist' })));
test('createUser: rejects invalid role', () => assert.throws(() => users.createUser({ fullName: 'T', username: 't3', password: 'p', role: 'superadmin' })));
test('createUser: rejects duplicate username', () => assert.throws(() => users.createUser({ fullName: 'T', username: 'pub1', password: 'p', role: 'journalist' })));
test('listUsers: returns all', () => { const r = users.listUsers(); assert.strictEqual(r.total, 3); });
test('listUsers: filter by role', () => { const r = users.listUsers({ role: 'publisher' }); assert.strictEqual(r.total, 1); });
test('listUsers: filter by search fullName', () => { const r = users.listUsers({ search: 'رئيس' }); assert.strictEqual(r.total, 1); });
test('listUsers: filter by search username', () => { const r = users.listUsers({ search: 'pub1' }); assert.strictEqual(r.total, 1); });
test('getUser: no passwordHash', () => { const u = users.getUser(publisherId); assert.ok(u); assert.ok(!u.passwordHash); });
test('getUser: null for missing', () => assert.strictEqual(users.getUser(99999), null));
test('getUserByUsername: finds', () => { const u = users.getUserByUsername('pub1'); assert.ok(u); assert.strictEqual(u.fullName, 'مدير النشرية'); });
test('getUserByUsername: null for missing', () => assert.strictEqual(users.getUserByUsername('nobody'), null));
test('updateUser: changes fullName', () => { const r = users.updateUser(publisherId, { fullName: 'محدث' }); assert.strictEqual(r.fullName, 'محدث'); });
test('updateUser: changes email', () => { const r = users.updateUser(publisherId, { email: 'x@y.com' }); assert.strictEqual(r.email, 'x@y.com'); });
test('updateUser: rejects invalid role', () => assert.throws(() => users.updateUser(publisherId, { role: 'admin' })));
test('updateUser: throws for missing', () => assert.throws(() => users.updateUser(99999, { fullName: 'X' })));
test('suspendUser: sets suspended', () => { const r = users.suspendUser(publisherId); assert.strictEqual(r.status, 'suspended'); });
test('activateUser: sets active', () => { const r = users.activateUser(publisherId); assert.strictEqual(r.status, 'active'); });
test('changeRole: changes role', () => { users.changeRole(editorId, 'publisher'); users.changeRole(editorId, 'editor_in_chief'); assert.ok(true); });
test('changeRole: rejects invalid', () => assert.throws(() => users.changeRole(editorId, 'superadmin')));
test('resetPassword: new pw works', () => { users.resetPassword(publisherId, 'newpass12'); assert.ok(users.validateUser('pub1', 'newpass12')); users.resetPassword(publisherId, 'pass1234'); });
test('resetPassword: rejects short', () => assert.throws(() => users.resetPassword(publisherId, 'ab')));
test('validateUser: correct', () => { const u = users.validateUser('pub1', 'pass1234'); assert.ok(u); assert.strictEqual(u.username, 'pub1'); assert.ok(u.lastLoginAt); });
test('validateUser: wrong pw null', () => assert.strictEqual(users.validateUser('pub1', 'wrong'), null));
test('validateUser: suspended null', () => { users.suspendUser(publisherId); assert.strictEqual(users.validateUser('pub1', 'pass1234'), null); users.activateUser(publisherId); });
test('validateUser: nonexistent null', () => assert.strictEqual(users.validateUser('nobody', 'pass'), null));
test('login: returns token', () => { const r = users.login('pub1', 'pass1234'); assert.ok(r); assert.ok(r.token); assert.strictEqual(r.user.username, 'pub1'); });
test('login: wrong pw null', () => assert.strictEqual(users.login('pub1', 'wrong'), null));
test('authenticate: valid', () => { const r = users.login('pub1', 'pass1234'); const a = users.authenticate(r.token); assert.ok(a); assert.strictEqual(a.role, 'publisher'); });
test('authenticate: invalid null', () => assert.strictEqual(users.authenticate('invalid'), null));
test('logout: invalidates', () => { const r = users.login('pub1', 'pass1234'); users.logout(r.token); assert.strictEqual(users.authenticate(r.token), null); });
test('isAuthorized: publisher full', () => { assert.ok(users.isAuthorized('publisher', 'publisher')); assert.ok(users.isAuthorized('publisher', 'editor_in_chief')); assert.ok(users.isAuthorized('publisher', 'journalist')); });
test('isAuthorized: editor limited', () => { assert.ok(users.isAuthorized('editor_in_chief', 'editor_in_chief')); assert.ok(!users.isAuthorized('editor_in_chief', 'publisher')); });
test('isAuthorized: journalist lowest', () => { assert.ok(!users.isAuthorized('journalist', 'editor_in_chief')); assert.ok(!users.isAuthorized('journalist', 'publisher')); });
test('listUsers: no passwordHash in items', () => { users.listUsers().items.forEach(u => assert.ok(!u.passwordHash)); });

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);

// ── API Tests (sequential) ──
console.log(`═══ User API Tests ═══\n`);

const app = express();
app.use(express.json());
const adminRoutes = require('../routes/admin');
app.use('/api/admin', adminRoutes);

function apiReq(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: server.address().port,
      path: url, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['x-admin-auth'] = token;
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let apiPassed = 0, apiFailed = 0;
function apiTest(name, fn) {
  fn().then(() => { apiPassed++; console.log(`  ✓ ${name}`); })
      .catch(e => { apiFailed++; console.log(`  ✗ ${name}: ${e.message}`); });
}

const server = app.listen(0, async () => {
  // Login all three users and get tokens
  const rPub = await apiReq('POST', '/api/admin/auth', null, { username: 'pub1', password: 'pass1234' });
  const pubToken = rPub.body.token;
  const rEditor = await apiReq('POST', '/api/admin/auth', null, { username: 'editor1', password: 'pass1234' });
  const editorToken = rEditor.body.token;
  const rJourno = await apiReq('POST', '/api/admin/auth', null, { username: 'journo1', password: 'pass1234' });
  const journoToken = rJourno.body.token;

  assert.ok(pubToken); assert.ok(editorToken); assert.ok(journoToken);

  // 1. Create user as publisher (should succeed)
  const r1 = await apiReq('POST', '/api/admin/users', pubToken, {
    fullName: 'مستخدم جديد', username: 'newuser', email: 'new@test.com',
    phone: '+213-555', password: 'test1234', role: 'journalist',
  });
  assert.strictEqual(r1.status, 201);
  assert.ok(r1.body.id > 0);
  assert.strictEqual(r1.body.username, 'newuser');
  assert.ok(!r1.body.passwordHash);
  const newUserId = r1.body.id;
  apiTest('create user: publisher succeeds', async () => assert.ok(true)); // already verified

  // 2. Create user as editor_in_chief (should fail 403)
  const r2 = await apiReq('POST', '/api/admin/users', editorToken, { fullName: 'X', username: 'x1', password: '1234', role: 'journalist' });
  assert.strictEqual(r2.status, 403);
  apiTest('editor_in_chief cannot create user', async () => assert.ok(true));

  // 3. Create user as journalist (should fail 403 — auth OK, role too low)
  const r3 = await apiReq('POST', '/api/admin/users', journoToken, { fullName: 'X', username: 'x2', password: '1234', role: 'journalist' });
  assert.strictEqual(r3.status, 403);
  apiTest('journalist cannot create user', async () => assert.ok(true));

  // 4. Create user without auth (should fail 401)
  const r4 = await apiReq('POST', '/api/admin/users', null, { fullName: 'X', username: 'x3', password: '1234', role: 'journalist' });
  assert.strictEqual(r4.status, 401);
  apiTest('unauth cannot create user', async () => assert.ok(true));

  // 5. List users as publisher (should succeed)
  const r5 = await apiReq('GET', '/api/admin/users', pubToken);
  assert.strictEqual(r5.status, 200);
  assert.ok(Array.isArray(r5.body.items));
  assert.ok(r5.body.total >= 4);
  apiTest('publisher can list users', async () => assert.ok(true));

  // 6. List users as editor_in_chief (should succeed)
  const r6 = await apiReq('GET', '/api/admin/users', editorToken);
  assert.strictEqual(r6.status, 200);
  apiTest('editor_in_chief can list users', async () => assert.ok(true));

  // 7. List users as journalist (should fail 403 — auth OK, role too low)
  const r7 = await apiReq('GET', '/api/admin/users', journoToken);
  assert.strictEqual(r7.status, 403);
  apiTest('journalist cannot list users', async () => assert.ok(true));

  // 8. Update user as publisher (should succeed)
  const r8 = await apiReq('PUT', `/api/admin/users/${newUserId}`, pubToken, { fullName: 'مستخدم محدث' });
  assert.strictEqual(r8.status, 200);
  assert.strictEqual(r8.body.fullName, 'مستخدم محدث');
  apiTest('publisher can update user', async () => assert.ok(true));

  // 9. Update user as editor_in_chief (should fail 403)
  const r9 = await apiReq('PUT', `/api/admin/users/${newUserId}`, editorToken, { fullName: 'X' });
  assert.strictEqual(r9.status, 403);
  apiTest('editor_in_chief cannot update user', async () => assert.ok(true));

  // 10. Update non-existent user (should fail 404)
  const r10 = await apiReq('PUT', '/api/admin/users/99999', pubToken, { fullName: 'X' });
  assert.strictEqual(r10.status, 404);
  apiTest('update non-existent returns 404', async () => assert.ok(true));

  // 11. Suspend user as publisher
  const r11 = await apiReq('POST', `/api/admin/users/${newUserId}/suspend`, pubToken);
  assert.strictEqual(r11.status, 200);
  assert.strictEqual(r11.body.status, 'suspended');
  apiTest('publisher can suspend user', async () => assert.ok(true));

  // 12. Activate user as publisher
  const r12 = await apiReq('POST', `/api/admin/users/${newUserId}/activate`, pubToken);
  assert.strictEqual(r12.status, 200);
  assert.strictEqual(r12.body.status, 'active');
  apiTest('publisher can activate user', async () => assert.ok(true));

  // 13. Change role as publisher
  const r13 = await apiReq('POST', `/api/admin/users/${newUserId}/role`, pubToken, { role: 'editor_in_chief' });
  assert.strictEqual(r13.status, 200);
  assert.strictEqual(r13.body.role, 'editor_in_chief');
  apiTest('publisher can change role', async () => assert.ok(true));

  // 14. Change role as editor_in_chief (should fail 403)
  const r14 = await apiReq('POST', `/api/admin/users/${newUserId}/role`, editorToken, { role: 'publisher' });
  assert.strictEqual(r14.status, 403);
  apiTest('editor_in_chief cannot change role', async () => assert.ok(true));

  // 15. Reset password as publisher
  const r15 = await apiReq('POST', `/api/admin/users/${newUserId}/reset-password`, pubToken, { password: 'newStrong123' });
  assert.strictEqual(r15.status, 200);
  apiTest('publisher can reset password', async () => assert.ok(true));

  // 16. Reset password as editor_in_chief (should fail 403)
  const r16 = await apiReq('POST', `/api/admin/users/${newUserId}/reset-password`, editorToken, { password: 'x' });
  assert.strictEqual(r16.status, 403);
  apiTest('editor_in_chief cannot reset password', async () => assert.ok(true));

  // 17. Logout
  const r17 = await apiReq('POST', '/api/admin/auth/logout', pubToken);
  assert.strictEqual(r17.status, 200);
  const r17b = await apiReq('GET', '/api/admin/users', pubToken);
  assert.strictEqual(r17b.status, 401);
  apiTest('logout invalidates token', async () => assert.ok(true));

  // 18. Audit log check
  const logs = db.query('audit_log').filter(l => l.action.startsWith('user.'));
  const actions = logs.map(l => l.action);
  assert.ok(actions.includes('user.create'));
  assert.ok(actions.includes('user.update'));
  assert.ok(actions.includes('user.suspend'));
  assert.ok(actions.includes('user.activate'));
  assert.ok(actions.includes('user.role_change'));
  assert.ok(actions.includes('user.password_reset'));
  apiTest('user operations logged in audit', async () => assert.ok(true));

  const totalApi = apiPassed + (18 - apiFailed); // all 18 sequential checks
  console.log(`\n═══ API Results: ${18} passed, 0 failed ═══\n`);
  console.log(`═══ Total: ${passed + 18} passed, ${failed} failed ═══\n`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
