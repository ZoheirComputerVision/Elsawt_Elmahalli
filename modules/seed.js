const db = require('../database');

async function seedIfEmpty() {
  const count = db.count('processed_content');
  if (count > 0) {
    console.log(`[Seed] البيانات موجودة مسبقًا (${count} محتوى) - تخطي التهيئة`);
    return;
  }

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
    });
    seeded++;
  }
  console.log(`[Seed] تمت تهيئة ${seeded} مقال`);
}

module.exports = { seedIfEmpty };
