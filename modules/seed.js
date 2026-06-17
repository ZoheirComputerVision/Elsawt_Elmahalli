const db = require('../database');
const users = require('./users');

async function seedIfEmpty() {
  const count = db.count('processed_content');
  if (count > 0) {
    console.log(`[Seed] البيانات موجودة مسبقًا (${count} محتوى) - تخطي تهيئة المحتوى`);
  } else {
    console.log('[Seed] تهيئة المحتوى الافتراضي...');
    const { SEED_ARTICLES } = require('./collector');
    let seeded = 0;
    for (const article of SEED_ARTICLES) {
      db.insert('processed_content', {
        title: article.title,
        body: article.body,
        summary: article.body.substring(0, 150),
        category: article.category,
        source_name: article.source,
        source_url: article.source_url,
        event_date: article.event_date,
        status: 'published',
        importance: 'normal',
        overall_score: 0.85,
        classification_score: 0.9,
        fact_check_score: 0.8,
        source_trust: 0.8,
        urgency_score: 0.3,
        is_ai_generated: 0,
        published_at: new Date().toISOString(),
        authorId: null,
        authorName: 'النظام',
        createdBy: 'system',
      });
      seeded++;
    }
    console.log(`[Seed] تمت تهيئة ${seeded} مقال`);
  }

  // Seed default users (ensure they exist regardless of test data)
  const DEFAULT_USERS = [
    { fullName: 'Zoheir IT Solutions', username: 'zoheir', email: 'zoheir@elsawt-elmehalli.dz', phone: '+213-', password: 'admin2026', role: 'publisher' },
    { fullName: 'رئيس التحرير', username: 'editor', email: 'editor@elsawt-elmehalli.dz', phone: '+213-', password: 'editor2026', role: 'editor_in_chief' },
    { fullName: 'صحفي', username: 'journalist', email: 'journalist@elsawt-elmehalli.dz', phone: '+213-', password: 'journalist2026', role: 'journalist' },
  ];
  let seededCount = 0;
  for (const u of DEFAULT_USERS) {
    const existing = db.findOne('users', x => x.username === u.username);
    if (!existing) {
      try {
        users.createUser(u);
        seededCount++;
      } catch (e) {
        console.log(`[Seed] تحذير: فشل إنشاء المستخدم ${u.username}:`, e.message);
      }
    }
  }
  if (seededCount > 0) console.log(`[Seed] تمت إضافة ${seededCount} مستخدمين افتراضيين`);
}

module.exports = { seedIfEmpty };
