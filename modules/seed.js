const db = require('../database');

async function seedIfEmpty() {
  const count = db.count('processed_content');
  if (count > 0) {
    console.log(`[Seed] البيانات موجودة مسبقًا (${count} محتوى) - تخطي التهيئة`);
    return;
  }

  console.log('[Seed] تم تعطيل التهيئة التلقائية. استخدم لوحة التحكم لجلب المقالات يدوياً.');
}

module.exports = { seedIfEmpty };
