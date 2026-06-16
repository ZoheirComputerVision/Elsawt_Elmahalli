const path = require('path');
const fs = require('fs');

// Point DB to the real data dir but we'll clean up after
process.env.NODE_ENV = 'test';

const media = require('../modules/media');
const db = require('../database');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
  }
}

function assertEqual(a, b, label) {
  if (a === b) {
    passed++;
    console.log(`  ✓ ${label} (${JSON.stringify(a)})`);
  } else {
    failed++;
    console.log(`  ✗ ${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

// ── Helper: create a mock file object ──
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

// ── Track test media IDs for cleanup ──
const createdIds = [];

async function run() {
  console.log('\n🧪 Media Service Tests\n');

  // ── 1. Upload success ──
  console.log('── Upload Tests ──');
  try {
    const file1 = mockFile({ filename: `upload_test_${Date.now()}.jpg` });
    const r1 = media.upload(file1, { alt_text: 'صورة اختبار', caption: 'اختبار', category: 'الوطن', uploader: 'test' });
    assert(r1 && r1.id > 0, 'upload creates record with id');
    assertEqual(r1.filename, 'test_image.jpg', 'stores original filename');
    assertEqual(r1.alt_text, 'صورة اختبار', 'stores alt_text');
    assertEqual(r1.caption, 'اختبار', 'stores caption');
    assertEqual(r1.category, 'الوطن', 'stores category');
    assertEqual(r1.uploader, 'test', 'stores uploader');
    assertEqual(r1.mime_type, 'image/jpeg', 'stores mime_type');
    assertEqual(r1.size, 102400, 'stores file size');
    assertEqual(r1.usage_count, 0, 'starts with usage_count 0');
    assert(Array.isArray(r1.used_in), 'used_in is array');
    assertEqual(r1.used_in.length, 0, 'used_in starts empty');
    assert(r1.path.startsWith('/uploads/'), 'path starts with /uploads/');
    createdIds.push(r1.id);

    // Verify db record
    const fromDb = db.get('media', r1.id);
    assert(fromDb !== null, 'record exists in database');
  } catch (e) {
    console.log(`  ✗ upload success: ${e.message}`);
    failed++;
  }

  // ── 2. Invalid MIME rejected ──
  try {
    const badFile = mockFile({ mimetype: 'image/svg+xml', filename: `bad_${Date.now()}.svg` });
    media.upload(badFile, { uploader: 'test' });
    console.log('  ✗ invalid MIME: should have thrown');
    failed++;
  } catch (e) {
    assert(e.message.includes('غير مدعوم'), `invalid MIME rejected: ${e.message}`);
  }

  try {
    const badFile2 = mockFile({ mimetype: 'application/pdf', filename: `bad_${Date.now()}.pdf` });
    media.upload(badFile2, { uploader: 'test' });
    console.log('  ✗ PDF should be rejected');
    failed++;
  } catch (e) {
    assert(e.message.includes('غير مدعوم'), `PDF rejected: ${e.message}`);
  }

  // ── 3. getById ──
  console.log('\n── Query Tests ──');
  if (createdIds.length > 0) {
    const found = media.getById(createdIds[0]);
    assert(found !== null, 'getById returns record');
    assertEqual(found.id, createdIds[0], 'getById correct id');

    const notFound = media.getById(99999);
    assertEqual(notFound, null, 'getById returns null for missing id');
  }

  // ── 4. query ──
  // Upload more items for query testing
  try {
    const file2 = mockFile({ filename: `cat_test_${Date.now()}.jpg`, originalname: 'economy.jpg' });
    const r2 = media.upload(file2, { category: 'اقتصاد', alt_text: 'صورة اقتصاد', uploader: 'editor' });
    createdIds.push(r2.id);

    const file3 = mockFile({ filename: `search_test_${Date.now()}.jpg`, originalname: 'meeting.jpg' });
    const r3 = media.upload(file3, { category: 'الوطن', alt_text: 'اجتماع المجلس', uploader: 'test' });
    createdIds.push(r3.id);

    // query all
    const all = media.query({ limit: 50 });
    assert(all.total >= 3, `query total >= 3 (got ${all.total})`);
    assert(all.items.length >= 3, `query items >= 3`);
    assert(typeof all.limit !== 'undefined', 'query returns limit');
    assert(typeof all.offset !== 'undefined', 'query returns offset');

    // query by category
    const catQ = media.query({ category: 'اقتصاد' });
    assert(catQ.total >= 1, 'query by category works');
    assertEqual(catQ.items[0].category, 'اقتصاد', 'filtered category correct');

    // query by uploader
    const uploaderQ = media.query({ uploader: 'editor' });
    assert(uploaderQ.total >= 1, 'query by uploader works');

    // query by search (alt_text)
    const searchQ = media.query({ search: 'اجتماع' });
    assert(searchQ.total >= 1, 'query by search works');

    // query pagination
    const page1 = media.query({ limit: 1, offset: 0 });
    assert(page1.items.length === 1, 'pagination limit works');

    // query date_from
    const dateQ = media.query({ date_from: '2020-01-01' });
    assert(dateQ.total >= 3, 'query date_from works');
  } catch (e) {
    console.log(`  ✗ query tests: ${e.message}`);
    failed++;
  }

  // ── 5. updateMetadata ──
  console.log('\n── Update Tests ──');
  if (createdIds.length > 0) {
    try {
      const updated = media.updateMetadata(createdIds[0], {
        alt_text: 'نص بديل محدث',
        caption: 'وصف محدث',
        category: 'رياضة',
        uploader: 'test',
      });
      assertEqual(updated.alt_text, 'نص بديل محدث', 'updateMetadata alt_text');
      assertEqual(updated.caption, 'وصف محدث', 'updateMetadata caption');
      assertEqual(updated.category, 'رياضة', 'updateMetadata category');
      assert(updated.updated_at, 'updateMetadata sets updated_at');
      assert(updated.version > 1, 'updateMetadata increments version');
    } catch (e) {
      console.log(`  ✗ updateMetadata: ${e.message}`);
      failed++;
    }

    // update with no valid fields
    try {
      media.updateMetadata(createdIds[0], { uploader: 'test2' });
      console.log('  ✗ should reject update with no valid fields');
      failed++;
    } catch (e) {
      assert(e.message.includes('لا توجد'), 'rejects empty update');
    }

    // update non-existent
    try {
      media.updateMetadata(99999, { alt_text: 'x' });
      console.log('  ✗ should reject update for missing id');
      failed++;
    } catch (e) {
      assert(e.message.includes('غير موجود'), 'rejects missing id update');
    }
  }

  // ── 6. addUsage / removeUsage ──
  console.log('\n── Usage Tests ──');
  if (createdIds.length > 0) {
    try {
      const id = createdIds[0];
      const u1 = media.addUsage(id, 100, 'article');
      assert(u1.usage_count === 1, 'addUsage increments to 1');
      assert(u1.used_in.length === 1, 'used_in has 1 entry');
      assertEqual(u1.used_in[0].content_id, 100, 'used_in content_id');
      assertEqual(u1.used_in[0].type, 'article', 'used_in type');

      // Add another usage
      media.addUsage(id, 200, 'article');
      const afterSecond = db.get('media', id);
      assert(afterSecond.usage_count === 2, 'addUsage increments to 2');

      // Duplicate add should not increase
      media.addUsage(id, 100, 'article');
      const afterDup = db.get('media', id);
      assert(afterDup.usage_count === 2, 'duplicate addUsage does not increase');

      // removeUsage
      const r1 = media.removeUsage(id, 100, 'article');
      assert(r1.usage_count === 1, 'removeUsage decrements to 1');

      media.removeUsage(id, 200, 'article');
      const afterRemove = db.get('media', id);
      assert(afterRemove.usage_count === 0, 'removeUsage decrements to 0');

      // Never negative
      media.removeUsage(id, 999, 'article');
      const neverNeg = db.get('media', id);
      assert(neverNeg.usage_count === 0, 'removeUsage never below 0');
    } catch (e) {
      console.log(`  ✗ usage tests: ${e.message}`);
      failed++;
    }
  }

  // ── 7. delete ──
  console.log('\n── Delete Tests ──');
  if (createdIds.length > 1) {
    const deleteTarget = createdIds[createdIds.length - 1];
    // Add usage to block deletion
    try {
      media.addUsage(deleteTarget, 999, 'test');
      const result = media.delete(deleteTarget);
      assertEqual(result.success, false, 'delete blocked when usage_count > 0');
      assert(result.error, 'delete returns error message');
      assertEqual(result.usage_count, 1, 'delete returns usage_count');
      assert(Array.isArray(result.used_in), 'delete returns used_in');

      // Remove usage and delete
      media.removeUsage(deleteTarget, 999, 'test');
      const result2 = media.delete(deleteTarget);
      assertEqual(result2.success, true, 'delete succeeds when unused');
      assert(result2.message, 'delete returns success message');

      // Verify removed from DB
      const gone = db.get('media', deleteTarget);
      assertEqual(gone, null, 'record removed from database after delete');
    } catch (e) {
      console.log(`  ✗ delete tests: ${e.message}`);
      failed++;
    }
  }

  // ── 8. delete non-existent ──
  const fakeDelete = media.delete(99999);
  assertEqual(fakeDelete.success, false, 'delete returns error for missing id');

  // ── Summary ──
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  النتائج: ${passed} نجاح, ${failed} فشل`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━\n`);

  // ── Cleanup test records ──
  for (const id of createdIds) {
    try {
      const m = db.get('media', id);
      if (m) {
        // Force delete for cleanup (skip usage check)
        const fpath = path.join(__dirname, '..', 'public', 'uploads', path.basename(m.path));
        if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
        db.delete('media', id);
      }
    } catch (_) { /* silent */ }
  }
  db.saveNow('media');
  console.log(`  تنظيف: تم حذف ${createdIds.length} سجل اختبار`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
