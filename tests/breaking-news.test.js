const assert = require('assert');
const db = require('../database');

// ── Helpers ──
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); process.stdout.write(`  ✓ ${name}\n`); passed++; }
  catch (e) { process.stdout.write(`  ✕ ${name}\n    ${e.message}\n`); failed++; }
}

// Clean slate
db.query('breaking_news').forEach(r => db.delete('breaking_news', r.id));
db.saveNow('breaking_news');

const breaking = require('../modules/breaking-news');

// ── Seed test articles ──
if (!db.get('processed_content', 999)) {
  db.insert('processed_content', { id: 999, title: 'Breaking Test Article', body: 'Test', status: 'published' });
}

console.log('\n═══ Breaking News Module Tests ═══\n');

test('create: returns record with id', () => {
  const r = breaking.create({ title: 'خبر عاجل 1', created_by: 'test' });
  assert(r.id > 0);
});

test('create: sets correct fields', () => {
  const r = breaking.create({ title: 'خبر عاجل 2', url: 'https://example.com', created_by: 'editor' });
  assert.strictEqual(r.title, 'خبر عاجل 2');
  assert.strictEqual(r.url, 'https://example.com');
  assert.strictEqual(r.is_active, true);
  assert.strictEqual(r.created_by, 'editor');
});

test('create: sets created_at', () => {
  const r = breaking.create({ title: 'خبر عاجل 3' });
  assert(r.created_at);
});

test('create: rejects empty title', () => {
  assert.throws(() => breaking.create({ title: '' }), /مطلوب/);
});

test('list: returns items', () => {
  const res = breaking.list();
  assert(res.total >= 3);
});

test('list: filters by active', () => {
  const res = breaking.list({ is_active: true });
  assert(res.items.every(i => i.is_active === true));
});

test('list: filters by inactive', () => {
  const res = breaking.list({ is_active: false });
  assert(res.items.every(i => i.is_active === false));
});

test('list: search works', () => {
  const res = breaking.list({ search: 'عاجل 1' });
  assert(res.total >= 1);
});

test('priority: first gets 1', () => {
  breaking.create({ title: 'ترتيب اختبار 1' });
  const res = breaking.list();
  const created = res.items.find(i => i.title === 'ترتيب اختبار 1');
  assert(created);
  assert.strictEqual(created.priority, res.total);
});

test('update: title changes', () => {
  const r = breaking.create({ title: 'قابل للتحديث' });
  const updated = breaking.update(r.id, { title: 'تم التحديث' });
  assert.strictEqual(updated.title, 'تم التحديث');
});

test('update: is_active changes', () => {
  const r = breaking.create({ title: 'قابل للتعطيل' });
  const updated = breaking.update(r.id, { is_active: false });
  assert.strictEqual(updated.is_active, false);
});

test('update: sets updated_at', () => {
  const r = breaking.create({ title: 'وقت التحديث' });
  const updated = breaking.update(r.id, { title: 'محدث' });
  assert(updated.updated_at);
});

test('update: rejects non-existent', () => {
  assert.throws(() => breaking.update(99999, { title: 'x' }), /غير موجود/);
});

test('remove: returns success', () => {
  const r = breaking.create({ title: 'للمسح' });
  const result = breaking.remove(r.id);
  assert(result.success);
});

test('remove: removes record', () => {
  const before = breaking.list({ search: 'للمسح' });
  const r = breaking.create({ title: 'للمسح 2' });
  breaking.remove(r.id);
  const after = breaking.list({ search: 'للمسح 2' });
  assert.strictEqual(after.total, 0);
});

test('remove: rejects non-existent', () => {
  assert.throws(() => breaking.remove(99999), /غير موجود/);
});

test('getActive: returns only visible (active, not expired)', () => {
  breaking.create({ title: 'نشط ظاهر', is_active: true });
  const hidden = breaking.create({ title: 'غير نشط', is_active: false });
  const active = breaking.getActive();
  assert(active.every(i => i.is_active === true));
  assert(active.every(i => !i.expires_at || new Date(i.expires_at) > new Date()));
});

test('getActive: excludes expired', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  breaking.create({ title: 'منتهي', is_active: true, expires_at: past });
  const active = breaking.getActive();
  assert(!active.some(i => i.title === 'منتهي'));
});

test('getActive: respects starts_at in future', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  breaking.create({ title: 'مستقبلي', is_active: true, starts_at: future });
  const active = breaking.getActive();
  assert(!active.some(i => i.title === 'مستقبلي'));
});

test('reorder: swaps priorities', () => {
  const r1 = breaking.create({ title: 'إعادة ترتيب 1' });
  const r2 = breaking.create({ title: 'إعادة ترتيب 2' });
  const before = breaking.list();
  const idx1 = before.items.findIndex(i => i.id === r1.id);
  const idx2 = before.items.findIndex(i => i.id === r2.id);
  breaking.reorder(r2.id, 'up');
  const after = breaking.list();
  const newIdx1 = after.items.findIndex(i => i.id === r1.id);
  const newIdx2 = after.items.findIndex(i => i.id === r2.id);
  assert(newIdx2 < newIdx1);
});

test('reorder: boundary first up throws', () => {
  const items = breaking.list().items;
  if (items.length > 0) {
    assert.throws(() => breaking.reorder(items[0].id, 'up'), /أول عنصر/);
  }
});

test('reorder: boundary last down throws', () => {
  const items = breaking.list().items;
  if (items.length > 0) {
    assert.throws(() => breaking.reorder(items[items.length - 1].id, 'down'), /آخر عنصر/);
  }
});

test('archiveExpired: archives expired items', () => {
  const past = new Date(Date.now() - 3600000).toISOString();
  breaking.create({ title: 'منتهي للأرشفة', is_active: true, expires_at: past });
  const result = breaking.archiveExpired();
  assert(result.archived >= 1);
  const active = breaking.getActive();
  assert(!active.some(i => i.title === 'منتهي للأرشفة'));
});

test('archiveExpired: returns 0 when none expired', () => {
  const result = breaking.archiveExpired();
  assert.strictEqual(typeof result.archived, 'number');
});

test('validate: rejects empty title', () => {
  const errors = breaking.validate({ title: '' });
  assert(errors.length > 0);
});

test('validate: accepts valid data', () => {
  const errors = breaking.validate({ title: 'خبر صحيح', starts_at: null, expires_at: null });
  assert.strictEqual(errors.length, 0);
});

test('validate: rejects starts_at after expires_at', () => {
  const errors = breaking.validate({
    title: 'خطأ',
    starts_at: '2026-06-20T00:00:00Z',
    expires_at: '2026-06-19T00:00:00Z',
  });
  assert(errors.length > 0);
});

test('delete normalizes: remaining items get correct priorities', () => {
  const r1 = breaking.create({ title: 'حذف ترتيب 1' });
  const r2 = breaking.create({ title: 'حذف ترتيب 2' });
  breaking.remove(r1.id);
  const res = breaking.list();
  const remaining = res.items.find(i => i.id === r2.id);
  assert(remaining);
  assert.strictEqual(remaining.priority, res.items.length);
});

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);

// ── API Tests ──
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Setup auth middleware for tests
const usersModule = require('../modules/users');
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-auth'];
  const user = usersModule.authenticate(token);
  if (user) { req.user = user; return next(); }
  res.status(401).json({ error: 'Unauthorized' });
}
function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (usersModule.isAuthorized(req.user?.role, role)) return next();
      res.status(403).json({ error: 'Forbidden' });
    });
  };
}

const audit = require('../modules/audit');
const breakingAPI = require('../modules/breaking-news');

// Mount admin routes with our auth
const adminRouter = express.Router();
adminRouter.get('/breaking-news', requireAuth, (req, res) => {
  try {
    const result = breakingAPI.list({ search: req.query.search, is_active: req.query.is_active, limit: req.query.limit, offset: req.query.offset });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
adminRouter.post('/breaking-news', requireRole('editor'), (req, res) => {
  try {
    const { title, url, is_active, starts_at, expires_at } = req.body;
    const record = breakingAPI.create({ title, url, is_active, starts_at, expires_at, created_by: req.user?.username || 'test' });
    audit.log(req.user?.username || 'test', 'breaking.create', 'breaking_news', record.id, { title });
    res.status(201).json(record);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
adminRouter.put('/breaking-news/:id', requireRole('editor'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = breakingAPI.update(id, req.body);
    audit.log(req.user?.username || 'test', 'breaking.update', 'breaking_news', id, req.body);
    res.json(record);
  } catch (e) { res.status(e.message.includes('غير موجود') ? 404 : 400).json({ error: e.message }); }
});
adminRouter.delete('/breaking-news/:id', requireRole('editor'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = breakingAPI.remove(id);
    audit.log(req.user?.username || 'test', 'breaking.delete', 'breaking_news', id, {});
    res.json(result);
  } catch (e) { res.status(e.message.includes('غير موجود') ? 404 : 400).json({ error: e.message }); }
});
adminRouter.post('/breaking-news/reorder', requireRole('editor'), (req, res) => {
  try {
    const { id, direction } = req.body;
    const result = breakingAPI.reorder(parseInt(id), direction);
    audit.log(req.user?.username || 'test', 'breaking.reorder', 'breaking_news', id, { direction });
    res.json(result);
  } catch (e) { res.status(e.message.includes('غير موجود') ? 404 : 400).json({ error: e.message }); }
});
adminRouter.post('/breaking-news/archive-expired', requireRole('editor'), (req, res) => {
  try {
    const result = breakingAPI.archiveExpired();
    if (result.archived > 0) audit.log(req.user?.username || 'test', 'breaking.archive', 'breaking_news', 0, { count: result.archived });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const publicRouter = express.Router();
publicRouter.get('/breaking-news', (req, res) => {
  try {
    const items = breakingAPI.getActive();
    res.json({ items, total: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);

let server;
function startServer(done) {
  server = app.listen(0, () => done(null, server.address().port));
}

const httpReq = (method, url, port, headers, body) => {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port, path: url, method, headers: headers || {} };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

console.log('\n═══ Breaking News API Tests ═══\n');

let apiPassed = 0, apiFailed = 0;
async function apiTest(name, fn) {
  try { await fn(); process.stdout.write(`  ✓ ${name}\n`); apiPassed++; }
  catch (e) { process.stdout.write(`  ✕ ${name}\n    ${e.message}\n`); apiFailed++; }
}

startServer(async (err, port) => {
  if (err) { console.error('Server start failed:', err); process.exit(1); }

  let createdId = null;
  let AUTH_TOKEN;

  // Create test user and get real auth token
  usersModule.createUser({ fullName: 'Test Admin', username: 'testadmin', password: 'testpass123', role: 'publisher', createdBy: 'system' });
  const authResult = usersModule.login('testadmin', 'testpass123');
  AUTH_TOKEN = authResult.token;

  const AUTH = (extra) => ({ 'Content-Type': 'application/json', 'x-admin-auth': AUTH_TOKEN, ...extra });

  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 200));

  await apiTest('api create: returns 201 with id', async () => {
    const res = await httpReq('POST', '/api/admin/breaking-news', port, AUTH(), { title: 'API Breaking News' });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body?.id) throw new Error('No id returned');
    createdId = res.body.id;
  });

  await apiTest('api create: rejects empty title', async () => {
    const res = await httpReq('POST', '/api/admin/breaking-news', port, AUTH(), { title: '' });
    if (res.status === 201) throw new Error('Should have rejected empty title');
  });

  await apiTest('api list: returns 200', async () => {
    const res = await httpReq('GET', '/api/admin/breaking-news', port, AUTH());
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api list: has items', async () => {
    const res = await httpReq('GET', '/api/admin/breaking-news', port, AUTH());
    if (!res.body?.items) throw new Error('No items in response');
  });

  await apiTest('api list: returns total', async () => {
    const res = await httpReq('GET', '/api/admin/breaking-news', port, AUTH());
    if (typeof res.body?.total !== 'number') throw new Error('Total not a number');
  });

  await apiTest('api update: returns 200', async () => {
    if (!createdId) throw new Error('No created item to update');
    const res = await httpReq('PUT', `/api/admin/breaking-news/${createdId}`, port, AUTH(), { title: 'API Updated' });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api update: changes title', async () => {
    if (!createdId) throw new Error('No created item');
    const res = await httpReq('PUT', `/api/admin/breaking-news/${createdId}`, port, AUTH(), { title: 'API Updated Final' });
    if (res.body?.title !== 'API Updated Final') throw new Error(`Title not updated: ${res.body?.title}`);
  });

  await apiTest('api reorder: returns 200', async () => {
    const r1 = breakingAPI.create({ title: 'Reorder A' });
    const r2 = breakingAPI.create({ title: 'Reorder B' });
    const res = await httpReq('POST', '/api/admin/breaking-news/reorder', port, AUTH(), { id: r2.id, direction: 'up' });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api delete: returns 200', async () => {
    if (!createdId) throw new Error('No created item to delete');
    const res = await httpReq('DELETE', `/api/admin/breaking-news/${createdId}`, port, AUTH());
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api delete: success true', async () => {
    const newRec = breakingAPI.create({ title: 'To Delete' });
    const res = await httpReq('DELETE', `/api/admin/breaking-news/${newRec.id}`, port, AUTH());
    if (!res.body?.success) throw new Error('Delete did not return success: ' + JSON.stringify(res.body));
  });

  await apiTest('api archive expired: returns 200', async () => {
    const res = await httpReq('POST', '/api/admin/breaking-news/archive-expired', port, AUTH(), {});
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api public breaking-news: returns 200', async () => {
    const res = await httpReq('GET', '/api/breaking-news', port, {});
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await apiTest('api public breaking-news: items is array', async () => {
    const res = await httpReq('GET', '/api/breaking-news', port, {});
    if (!Array.isArray(res.body?.items)) throw new Error('items is not an array');
  });

  await apiTest('api unauth list: returns 401', async () => {
    const res = await httpReq('GET', '/api/admin/breaking-news', port, {});
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await apiTest('api unauth create: returns 401', async () => {
    const res = await httpReq('POST', '/api/admin/breaking-news', port, { 'Content-Type': 'application/json' }, { title: 'No Auth Test' });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  console.log(`\n═══ API Results: ${apiPassed} passed, ${apiFailed} failed ═══\n`);
  console.log(`═══ Total: ${passed + apiPassed} passed, ${failed + apiFailed} failed ═══\n`);

  const totalFailed = failed + apiFailed;
  if (totalFailed > 0) {
    console.error(`❌ ${totalFailed} test(s) failed`);
    process.exit(1);
  }

  server.close();
  process.exit(0);
});
