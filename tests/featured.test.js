process.env.NODE_ENV = 'test';

const featured = require('../modules/featured');
const db = require('../database');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`); }
}

function assertEqual(a, b, label) {
  if (a === b) { passed++; console.log(`  ✓ ${label} (${JSON.stringify(a)})`); }
  else { failed++; console.log(`  ✗ ${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
}

function assertMatch(actual, expectedFields, label) {
  let ok = true;
  const diffs = [];
  for (const [k, v] of Object.entries(expectedFields)) {
    if (actual[k] !== v) { ok = false; diffs.push(`${k}=${JSON.stringify(actual[k])} (expected ${JSON.stringify(v)})`); }
  }
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}: ${diffs.join(', ')}`); }
}

function assertError(fn, expectedMsg, label) {
  try { fn(); failed++; console.log(`  ✗ ${label}: no error thrown`); }
  catch (e) {
    if (e.message.includes(expectedMsg)) { passed++; console.log(`  ✓ ${label}`); }
    else { failed++; console.log(`  ✗ ${label}: expected "${expectedMsg}", got "${e.message}"`); }
  }
}

// ── Setup ──

function cleanData() {
  db.tables['featured_stories'] = [];
  db.saveNow('featured_stories');
}

// Insert a test article for reference
function ensureTestArticle() {
  let article = db.findOne('processed_content', i => i.title === 'Featured Test Article');
  if (!article) {
    article = db.insert('processed_content', {
      title: 'Featured Test Article',
      body: 'Test body for featured stories',
      category: 'أخبار محلية',
      status: 'published',
      source_name: 'Test',
      published_at: new Date().toISOString(),
    });
  }
  return article;
}

function ensureSecondArticle() {
  let article = db.findOne('processed_content', i => i.title === 'Second Featured Article');
  if (!article) {
    article = db.insert('processed_content', {
      title: 'Second Featured Article',
      body: 'Another test article',
      category: 'رياضة محلية',
      status: 'published',
      source_name: 'Test',
      published_at: new Date().toISOString(),
    });
  }
  return article;
}

// ── Tests ──

console.log('\n═══ Featured Module Tests ═══\n');

// 1. Create
(function testCreate() {
  cleanData();
  const article = ensureTestArticle();
  const record = featured.create({ article_id: article.id, created_by: 'test' });
  assert(record.id > 0, 'create: returns record with id');
  assertMatch(record, { article_id: article.id, title: 'Featured Test Article', featured_order: 1, is_active: true, created_by: 'test' }, 'create: sets correct fields');
  assert(record.created_at, 'create: sets created_at');
})();

// 2. Duplicate prevention
(function testDuplicatePrevention() {
  const article = ensureTestArticle();
  assertError(
    () => featured.create({ article_id: article.id }),
    'مضاف مسبقاً',
    'duplicate: prevents duplicate article_id'
  );
})();

// 3. Non-existent article
(function testNonExistentArticle() {
  assertError(
    () => featured.create({ article_id: 99999 }),
    'غير موجود',
    'non-existent: rejects non-existent article'
  );
})();

// 4. List
(function testList() {
  cleanData();
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();
  featured.create({ article_id: article.id, created_by: 'test' });
  featured.create({ article_id: a2.id, created_by: 'test', is_active: false });

  let result = featured.list();
  assertEqual(result.total, 2, 'list: returns 2 items');

  result = featured.list({ is_active: true });
  assertEqual(result.total, 1, 'list: filters by active');

  result = featured.list({ is_active: false });
  assertEqual(result.total, 1, 'list: filters by inactive');

  result = featured.list({ search: 'Second' });
  assertEqual(result.total, 1, 'list: searches by title');
})();

// 5. Order auto-assignment
(function testOrderAssignment() {
  cleanData();
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();
  const r1 = featured.create({ article_id: article.id });
  assertEqual(r1.featured_order, 1, 'order: first gets 1');
  const r2 = featured.create({ article_id: a2.id });
  assertEqual(r2.featured_order, 2, 'order: second gets 2');
})();

// 6. Update
(function testUpdate() {
  cleanData();
  const article = ensureTestArticle();
  const record = featured.create({ article_id: article.id });
  const updated = featured.update(record.id, { is_active: false, featured_order: 5 });
  assert(updated.updated_at, 'update: sets updated_at');
  const result = featured.list();
  assertEqual(result.items.find(i => i.id === record.id).is_active, false, 'update: changes is_active');
})();

// 7. Remove
(function testRemove() {
  cleanData();
  const article = ensureTestArticle();
  const record = featured.create({ article_id: article.id });
  const rem = featured.remove(record.id);
  assert(rem.success, 'remove: returns success');
  assertEqual(featured.list().total, 0, 'remove: removes record');
})();

// 8. Remove non-existent
(function testRemoveNonExistent() {
  assertError(
    () => featured.remove(99999),
    'غير موجود',
    'remove-non-existent: rejects non-existent'
  );
})();

// 9. getActive
(function testGetActive() {
  cleanData();
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();
  featured.create({ article_id: article.id, is_active: true });
  featured.create({ article_id: a2.id, is_active: false });
  const active = featured.getActive();
  assertEqual(active.length, 1, 'getActive: returns only active');
  assert(active[0].article, 'getActive: enriches with article data');
  assertEqual(active[0].article.title, 'Featured Test Article', 'getActive: correct article attached');
})();

// 10. Reorder
(function testReorder() {
  cleanData();
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();
  const r1 = featured.create({ article_id: article.id });       // order 1
  const r2 = featured.create({ article_id: a2.id });           // order 2

  // Move r2 (order 2) up → swap
  const result = featured.reorder(r2.id, 'up');
  const u1 = result.items.find(i => i.id === r1.id);
  const u2 = result.items.find(i => i.id === r2.id);
  assertEqual(u1.featured_order, 2, 'reorder up: r1 moves to 2');
  assertEqual(u2.featured_order, 1, 'reorder up: r2 moves to 1');

  // Now r1=order 2 (last), r2=order 1 (first)

  // Boundary: first item going up
  assertError(
    () => featured.reorder(r2.id, 'up'),
    'أول عنصر',
    'reorder boundary: first item up throws'
  );

  // Boundary: last item going down
  assertError(
    () => featured.reorder(r1.id, 'down'),
    'آخر عنصر',
    'reorder boundary: last item down throws'
  );

  // Move r1 up back → swaps again
  const result2 = featured.reorder(r1.id, 'up');
  const v1 = result2.items.find(i => i.id === r1.id);
  const v2 = result2.items.find(i => i.id === r2.id);
  assertEqual(v1.featured_order, 1, 'reorder down: r1 back to 1');
  assertEqual(v2.featured_order, 2, 'reorder down: r2 back to 2');
})();

// 11. Cleanup after delete normalizes orders
(function testDeleteNormalizeOrders() {
  cleanData();
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();
  const r1 = featured.create({ article_id: article.id }); // order 1
  const r2 = featured.create({ article_id: a2.id });     // order 2
  featured.remove(r1.id);
  const left = featured.list();
  assertEqual(left.items[0].featured_order, 1, 'delete normalizes: remaining gets order 1');
})();

// ── API Tests ──

console.log('\n═══ Featured API Tests ═══\n');

const http = require('http');
const express = require('express');
const path = require('path');
const config = require('../config');

// Setup a mini express app for API testing
const app = express();
app.use(express.json());

const adminRoutes = require('../routes/admin');
app.use('/api/admin', adminRoutes);

// Mount public api
const apiRoutes = require('../routes/api');
app.use('/api', apiRoutes);

let server;

function startServer(done) {
  server = app.listen(0, () => done());
}

function stopServer(done) {
  if (server) server.close(done);
}

const AUTH_HEADERS = { 'x-admin-auth': 'admin-token' };

function apiGet(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: server.address().port,
      path,
      headers: { ...AUTH_HEADERS, ...headers },
    };
    http.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: server.address().port,
      path,
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function apiPut(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: server.address().port,
      path,
      method: 'PUT',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function apiDelete(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: server.address().port,
      path,
      method: 'DELETE',
      headers: AUTH_HEADERS,
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

startServer(async () => {
  const article = ensureTestArticle();
  const a2 = ensureSecondArticle();

  try {
    // Admin API tests

    // POST - create
    cleanData();
    const createRes = await apiPost('/api/admin/featured-stories', { article_id: article.id });
    assertEqual(createRes.status, 201, 'api create: returns 201');
    assert(createRes.body.id > 0, 'api create: returns id');

    // POST - duplicate
    const dupRes = await apiPost('/api/admin/featured-stories', { article_id: article.id });
    assertEqual(dupRes.status, 409, 'api duplicate: returns 409');

    // POST - non-existent
    const missingRes = await apiPost('/api/admin/featured-stories', { article_id: 99999 });
    assertEqual(missingRes.status, 409, 'api non-existent article: returns 409');

    // GET - list
    const listRes = await apiGet('/api/admin/featured-stories');
    assertEqual(listRes.status, 200, 'api list: returns 200');
    assert(listRes.body.items.length > 0, 'api list: has items');
    assertEqual(listRes.body.total, 1, 'api list: total is 1');

    // PUT - update
    const updateRes = await apiPut(`/api/admin/featured-stories/${createRes.body.id}`, { is_active: false });
    assertEqual(updateRes.status, 200, 'api update: returns 200');
    assertEqual(updateRes.body.is_active, false, 'api update: changes is_active');

    // POST - reorder
    const r2Create = await apiPost('/api/admin/featured-stories', { article_id: a2.id });
    const reorderRes = await apiPost('/api/admin/featured-stories/reorder', { id: r2Create.body.id, direction: 'up' });
    assertEqual(reorderRes.status, 200, 'api reorder: returns 200');

    // DELETE - remove
    const delRes = await apiDelete(`/api/admin/featured-stories/${createRes.body.id}`);
    assertEqual(delRes.status, 200, 'api delete: returns 200');
    assert(delRes.body.success, 'api delete: success');

    // Public API tests

    // GET /api/featured
    const pubRes = await apiGet('/api/featured');
    assertEqual(pubRes.status, 200, 'api public featured: returns 200');
    assert(Array.isArray(pubRes.body.items), 'api public featured: items is array');

  } catch (e) {
    console.log('  ✗ API test error:', e.message);
    failed++;
  }

  // ── Summary ──
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  stopServer(() => {
    // Cleanup test data
    cleanData();
    process.exit(failed > 0 ? 1 : 0);
  });
});
