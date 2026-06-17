const http = require('http');

process.env.NODE_ENV = 'test';

const express = require('express');
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

async function run() {
  console.log('\n\uD83D\uDCC1 Categories API Tests\n');

  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/api'));

  let server;

  function request(method, route) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        method,
        path: route,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  return new Promise((resolve) => {
    server = app.listen(0, async () => {
      try {
        // ── GET /api/local-categories ──
        console.log('── GET /api/local-categories ──');
        let res = await request('GET', '/api/local-categories');
        assertEqual(res.status, 200, 'returns 200');
        assert(Array.isArray(res.body), 'returns array');
        assertEqual(res.body.length, 11, 'has 11 categories');
        assertEqual(res.body[0].id, 'local-news', 'first is local-news');
        assertEqual(res.body[0].icon, 'fa-newspaper', 'has icon');
        assertEqual(res.body[0].slug, 'akbar-mahallia', 'has slug');
        assert(res.body[0].description, 'has description');
        assertEqual(res.body[0].priority, 1, 'has priority 1');

        // ── GET /api/categories (old endpoint, now enriched) ──
        console.log('\n── GET /api/categories ──');
        res = await request('GET', '/api/categories');
        assertEqual(res.status, 200, 'returns 200');
        assert(Array.isArray(res.body), 'returns array');

        // Should have enriched fields
        if (res.body.length > 0) {
          const first = res.body[0];
          assert(typeof first.category === 'string', 'has category name');
          assert(typeof first.count === 'number', 'has count');
          // icon and slug are optional (null for uncategorized)
          assert('icon' in first, 'has icon field');
          assert('slug' in first, 'has slug field');
        }

        // Sorted by priority
        const priorities = res.body.map(c => {
          const cat = require('../modules/categories').resolve(c.category);
          return cat ? cat.priority : 99;
        });
        for (let i = 1; i < priorities.length; i++) {
          assert(priorities[i - 1] <= priorities[i], `items sorted by priority at index ${i}`);
        }

        // ── GET /api/content?category= (backward compat) ──
        console.log('\n── GET /api/content with legacy category ──');

        // Insert a test article with old category name
        const legacyArticle = db.insert('processed_content', {
          title: 'اختبار التوافق مع التصنيف القديم',
          body: 'هذا المقال يستخدم تصنيفاً قديماً',
          category: 'الوطن',
          status: 'published',
          published_at: new Date().toISOString(),
        });

        // Filter by legacy name
        res = await request('GET', '/api/content?category=%D8%A7%D9%84%D9%88%D8%B7%D9%86');
        assertEqual(res.status, 200, 'filter by legacy name returns 200');
        assert(res.body.items.length >= 1, 'legacy filter returns articles');
        assert(res.body.items.some(i => i.id === legacyArticle.id), 'legacy article found by old name');

        // Filter by new name
        res = await request('GET', '/api/content?category=%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1%20%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A%D8%A9');
        assertEqual(res.status, 200, 'filter by new name returns 200');
        assert(res.body.items.some(i => i.id === legacyArticle.id), 'legacy article found by new name');

        // Cleanup test article
        db.delete('processed_content', legacyArticle.id);
        db.saveNow('processed_content');

      } catch (e) {
        console.log(`  \u2717 Test error: ${e.message}`);
        failed++;
      }

      console.log(`\n${'\u2501'.repeat(25)}`);
      console.log(`  \u0627\u0644\u0646\u062A\u0627\u0626\u062C: ${passed} \u0646\u062C\u0627\u062D, ${failed} \u0641\u0634\u0644`);
      console.log(`${'\u2501'.repeat(25)}\n`);

      await new Promise(ok => server.close(ok));
      process.exit(failed > 0 ? 1 : 0);
    });
  });
}

run();
