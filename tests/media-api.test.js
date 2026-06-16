const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';

const express = require('express');
const mediaService = require('../modules/media');
const db = require('../database');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  \u2713 ${label}`); }
  else { failed++; console.log(`  \u2717 ${label}`); }
}

function assertEqual(a, b, label) {
  if (a === b) { passed++; console.log(`  \u2713 ${label} (${JSON.stringify(a)})`); }
  else { failed++; console.log(`  \u2717 ${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
}

function mockFile(overrides = {}) {
  return {
    path: overrides.path || 'C:\\fakepath\\test.jpg',
    filename: overrides.filename || `test_${Date.now()}.jpg`,
    originalname: overrides.originalname || 'test_image.jpg',
    mimetype: overrides.mimetype || 'image/jpeg',
    size: overrides.size || 102400,
    ...overrides,
  };
}

const createdIds = [];
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

async function run() {
  console.log('\n\uD83E\uDEAA Media API Tests\n');

  // Create test media records
  const testMedia = [];
  try {
    const r1 = mediaService.upload(mockFile({ filename: `api_test_1_${Date.now()}.jpg` }), { alt_text: 'عام', caption: 'اختبار عام', category: 'الوطن', uploader: 'test' });
    testMedia.push(r1); createdIds.push(r1.id);
    const r2 = mediaService.upload(mockFile({ filename: `api_test_2_${Date.now()}.jpg` }), { alt_text: 'رياضة', caption: 'اختبار رياضي', category: 'رياضة', uploader: 'admin' });
    testMedia.push(r2); createdIds.push(r2.id);
    const r3 = mediaService.upload(mockFile({ filename: `api_test_3_${Date.now()}.jpg` }), { alt_text: 'اقتصاد', caption: 'اختبار اقتصاد', category: 'اقتصاد', uploader: 'editor' });
    testMedia.push(r3); createdIds.push(r3.id);
    console.log(`  \u2713 Created ${testMedia.length} test media records`);
  } catch (e) {
    console.log(`  \u2717 Failed to create test media: ${e.message}`);
    failed++;
  }

  // ── Build test app ──
  const app = express();
  app.use(express.json());

  // Mount upload middleware for test
  const multer = require('multer');
  const testUpload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10485760 } });
  app.set('upload', testUpload);

  // Mount routes
  app.use('/api', require('../routes/api'));
  app.use('/api/admin', require('../routes/admin'));

  let server;

  function request(method, route, opts = {}) {
    return new Promise((resolve, reject) => {
      const body = opts.body ? JSON.stringify(opts.body) : undefined;
      const headers = { ...opts.headers };
      if (body) headers['Content-Type'] = 'application/json';
      if (body) headers['Content-Length'] = Buffer.byteLength(body);

      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        method,
        path: route,
        headers,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  return new Promise((resolve) => {
    server = app.listen(0, async () => {
      try {
        // ── Test GET /api/media (public list) ──
        console.log('\n\u2015\u2015 Public GET /api/media \u2015\u2015');
        let res = await request('GET', '/api/media');
        assertEqual(res.status, 200, 'returns 200');
        assert(Array.isArray(res.body.items), 'items is array');
        assert(typeof res.body.total === 'number', 'total is number');
        assert(res.body.total >= 3, `total >= 3 (got ${res.body.total})`);
        assertEqual(res.body.page, 1, 'page is 1');

        // With category filter
        res = await request('GET', '/api/media?category=%D8%A7%D9%84%D9%88%D8%B7%D9%86');
        assertEqual(res.status, 200, 'category filter returns 200');
        assert(res.body.items.every(i => i.category === 'الوطن'), 'category filter works');

        // With limit
        res = await request('GET', '/api/media?limit=1');
        assertEqual(res.status, 200, 'limit returns 200');
        assertEqual(res.body.items.length, 1, 'limit respects count');
        assert(res.body.total >= 3, 'total reflects unfiltered count');

        // With offset
        res = await request('GET', '/api/media?offset=10');
        assertEqual(res.status, 200, 'offset returns 200');
        assertEqual(res.body.items.length, 0, 'offset beyond total returns empty');

        // ── Test GET /api/media/:id (public single) ──
        console.log('\n\u2015\u2015 Public GET /api/media/:id \u2015\u2015');
        const targetId = testMedia[0].id;
        res = await request('GET', `/api/media/${targetId}`);
        assertEqual(res.status, 200, 'returns 200 for existing');
        assertEqual(res.body.id, targetId, 'returns correct id');
        assertEqual(res.body.alt_text, testMedia[0].alt_text, 'returns correct alt_text');

        // Not found
        res = await request('GET', '/api/media/99999');
        assertEqual(res.status, 404, 'returns 404 for missing');
        assert(res.body.error, 'returns error message');

        // Invalid id (non-numeric)
        res = await request('GET', '/api/media/abc');
        assertEqual(res.status, 404, 'non-numeric id returns 404');

        // ── Test GET /api/admin/media (admin list) ──
        console.log('\n\u2015\u2015 Admin GET /api/admin/media \u2015\u2015');
        // Without auth
        res = await request('GET', '/api/admin/media');
        assertEqual(res.status, 401, 'returns 401 without auth token');

        // With auth
        res = await request('GET', '/api/admin/media', { headers: { 'x-admin-auth': 'admin-token' } });
        assertEqual(res.status, 200, 'returns 200 with auth');
        assert(Array.isArray(res.body.items), 'items is array');
        assert(typeof res.body.total === 'number', 'total is number');

        // With mime filter
        res = await request('GET', '/api/admin/media?mime_type=image/jpeg', { headers: { 'x-admin-auth': 'admin-token' } });
        assertEqual(res.status, 200, 'mime filter returns 200');

        // ── Test POST /api/admin/media/upload ──
        console.log('\n\u2015\u2015 Admin POST /api/admin/media/upload \u2015\u2015');
        // Without auth
        const formBoundary = '----TestBoundary' + Date.now();
        const bodyParts = [
          `--${formBoundary}\r\nContent-Disposition: form-data; name="alt_text"\r\n\r\nAPI upload\r\n`,
          `--${formBoundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nالوطن\r\n`,
          `--${formBoundary}\r\nContent-Disposition: form-data; name="file"; filename="test_upload.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfake-image-data\r\n`,
          `--${formBoundary}--\r\n`,
        ];
        const formBody = bodyParts.join('');

        res = await request('POST', '/api/admin/media/upload', {
          headers: {
            'Content-Type': `multipart/form-data; boundary=${formBoundary}`,
          },
        });
        assertEqual(res.status, 401, 'upload returns 401 without auth');

        // With auth (editor role) — the body will trigger multer but file content is fake
        // Multer with disk storage will fail on fake data — test that we get a structured error
        res = await request('POST', '/api/admin/media/upload', {
          headers: {
            'x-admin-auth': 'admin-token',
            'Content-Type': `multipart/form-data; boundary=${formBoundary}`,
            'Content-Length': Buffer.byteLength(formBody),
          },
          body: Buffer.from(formBody),
        });
        // Should either succeed (if multer accepts it) or return 400
        // We just verify it doesn't crash
        assert([200, 201, 400].includes(res.status), `upload with fake file returns ${res.status}`);

        // ── Test PUT /api/admin/media/:id ──
        console.log('\n\u2015\u2015 Admin PUT /api/admin/media/:id \u2015\u2015');
        const updateTarget = testMedia[testMedia.length - 1].id;

        // Without auth
        res = await request('PUT', `/api/admin/media/${updateTarget}`, {
          headers: { 'Content-Type': 'application/json' },
          body: { alt_text: 'مُحدّث' },
        });
        assertEqual(res.status, 401, 'update returns 401 without auth');

        // With auth
        res = await request('PUT', `/api/admin/media/${updateTarget}`, {
          headers: { 'x-admin-auth': 'admin-token', 'Content-Type': 'application/json' },
          body: { alt_text: 'مُحدّث', caption: 'وصف محدث', category: 'اقتصاد' },
        });
        assertEqual(res.status, 200, 'update returns 200 with auth');
        if (res.status === 200) {
          assertEqual(res.body.alt_text, 'مُحدّث', 'alt_text updated');
          assertEqual(res.body.caption, 'وصف محدث', 'caption updated');
          assertEqual(res.body.category, 'اقتصاد', 'category updated');
        }

        // Missing media
        res = await request('PUT', '/api/admin/media/99999', {
          headers: { 'x-admin-auth': 'admin-token', 'Content-Type': 'application/json' },
          body: { alt_text: 'x' },
        });
        assertEqual(res.status, 404, 'update returns 404 for missing');

        // ── Test DELETE /api/admin/media/:id ──
        console.log('\n\u2015\u2015 Admin DELETE /api/admin/media/:id \u2015\u2015');
        const deleteTarget = testMedia[Math.floor(testMedia.length / 2)].id;

        // Block by adding usage
        mediaService.addUsage(deleteTarget, 999, 'test');

        // Without auth
        res = await request('DELETE', `/api/admin/media/${deleteTarget}`);
        assertEqual(res.status, 401, 'delete returns 401 without auth');

        // With auth but blocked by usage
        res = await request('DELETE', `/api/admin/media/${deleteTarget}`, {
          headers: { 'x-admin-auth': 'admin-token' },
        });
        assertEqual(res.status, 409, 'delete returns 409 when in use');

        // Remove usage and delete
        mediaService.removeUsage(deleteTarget, 999, 'test');
        res = await request('DELETE', `/api/admin/media/${deleteTarget}`, {
          headers: { 'x-admin-auth': 'admin-token' },
        });
        assertEqual(res.status, 204, 'delete returns 204 on success');
        const removedIdx = createdIds.indexOf(deleteTarget);
        if (removedIdx > -1) createdIds.splice(removedIdx, 1);

        // Missing media
        res = await request('DELETE', '/api/admin/media/99999', {
          headers: { 'x-admin-auth': 'admin-token' },
        });
        assertEqual(res.status, 404, 'delete returns 404 for missing');

        // ── Test POST /api/admin/media/bulk-delete ──
        console.log('\n\u2015\u2015 Admin POST /api/admin/media/bulk-delete \u2015\u2015');
        // Without auth
        res = await request('POST', '/api/admin/media/bulk-delete', {
          headers: { 'Content-Type': 'application/json' },
          body: { ids: [1, 2, 3] },
        });
        assertEqual(res.status, 401, 'bulk-delete returns 401 without auth');

        // With auth
        res = await request('POST', '/api/admin/media/bulk-delete', {
          headers: { 'x-admin-auth': 'admin-token', 'Content-Type': 'application/json' },
          body: { ids: [99991, 99992] },
        });
        assertEqual(res.status, 200, 'bulk-delete returns 200 with auth');
        assert(Array.isArray(res.body.deleted), 'deleted is array');
        assert(Array.isArray(res.body.blocked), 'blocked is array');

        // Empty ids
        res = await request('POST', '/api/admin/media/bulk-delete', {
          headers: { 'x-admin-auth': 'admin-token', 'Content-Type': 'application/json' },
          body: { ids: [] },
        });
        assertEqual(res.status, 400, 'bulk-delete with empty ids returns 400');

        // Invalid body
        res = await request('POST', '/api/admin/media/bulk-delete', {
          headers: { 'x-admin-auth': 'admin-token', 'Content-Type': 'application/json' },
          body: {},
        });
        assertEqual(res.status, 400, 'bulk-delete without ids returns 400');

        // ── Role enforcement tests ──
        console.log('\n\u2015\u2015 Role Enforcement \u2015\u2015');
        // With invalid token
        res = await request('GET', '/api/admin/media', { headers: { 'x-admin-auth': 'bad-token' } });
        assertEqual(res.status, 401, 'invalid token returns 401');

        // Wrong header name
        res = await request('GET', '/api/admin/media', { headers: { 'authorization': 'Bearer admin-token' } });
        assertEqual(res.status, 401, 'wrong header returns 401');

      } catch (e) {
        console.log(`  \u2717 Test error: ${e.message}`);
        failed++;
      }

      // ── Summary ──
      console.log(`\n${'\u2501'.repeat(25)}`);
      console.log(`  \u0627\u0644\u0646\u062A\u0627\u0626\u062C: ${passed} \u0646\u062C\u0627\u062D, ${failed} \u0641\u0634\u0644`);
      console.log(`${'\u2501'.repeat(25)}\n`);

      // Cleanup
      await new Promise(ok => server.close(ok));
      for (const id of createdIds) {
        try {
          const m = db.get('media', id);
          if (m) {
            const fpath = path.join(UPLOADS_DIR, path.basename(m.path));
            if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
            db.delete('media', id);
          }
        } catch (_) {}
      }
      db.saveNow('media');
      console.log(`  \u062A\u0646\u0638\u064A\u0641: \u062A\u0645 \u062D\u0630\u0641 ${createdIds.length} \u0633\u062C\u0644 \u0627\u062E\u062A\u0628\u0627\u0631`);

      process.exit(failed > 0 ? 1 : 0);
    });
  });
}

run();
