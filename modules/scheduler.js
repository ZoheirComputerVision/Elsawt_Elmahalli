const cron = require('node-cron');
const db = require('../database');

class Scheduler {
  constructor() { this.jobs = []; this.running = false; }

  start() {
    if (this.running) return;
    this.running = true;
    this.jobs.push(cron.schedule('*/30 * * * *', () => this.runCollector()));
    this.jobs.push(cron.schedule('*/15 * * * *', () => this.runAnalyzer()));
    this.jobs.push(cron.schedule('*/10 * * * *', () => this.runPublisher()));
    this.jobs.push(cron.schedule('0 */6 * * *', () => this.runArchiveSync()));
    this.jobs.push(cron.schedule('0 0 * * *', () => this.resetDailyCount()));
    console.log(`[Scheduler] ${this.jobs.length} مهمة مجدولة بدأت`);
  }

  stop() {
    this.jobs.forEach(j => j.stop());
    this.running = false;
    console.log('[Scheduler] جميع المهام المجدولة أوقفت');
  }

  async runCollector() {
    console.log('[Scheduler] تشغيل مهمة الجمع...');
    try {
      const collector = require('./collector');
      const results = await collector.collectAll();
      db.upsert('settings', { key: 'last_scheduler_run', value: new Date().toISOString(), updated_at: new Date().toISOString() }, s => s.key === 'last_scheduler_run');
      console.log(`[Scheduler] ✓ جمع ${results.length} عنصر`);
    } catch (e) { console.error('[Scheduler] ✗ فشل الجمع:', e.message); }
  }

  async runAnalyzer() {
    console.log('[Scheduler] تشغيل مهمة التحليل...');
    try {
      const pending = db.query('raw_data', r => r.status === 'pending');
      const analyzer = require('./analyzer');
      for (const item of pending.slice(0, 5)) {
        try {
          const result = await analyzer.analyzeRawData(item.id);
          if (result) console.log(`  ✓ تحليل #${item.id}: ${result.classification.category} (${result.overall})`);
        } catch (e) { console.error(`  ✗ فشل تحليل #${item.id}:`, e.message); }
      }
      console.log(`[Scheduler] ✓ تم تحليل ${Math.min(pending.length, 5)} عنصر`);
    } catch (e) { console.error('[Scheduler] ✗ فشل التحليل:', e.message); }
  }

  async runPublisher() {
    console.log('[Scheduler] تشغيل مهمة النشر...');
    try {
      const drafts = db.query('processed_content', c => c.status === 'draft' && c.overall_score >= 0.8);
      const writer = require('./writer');
      const publisher = require('./publisher');
      for (const draft of drafts.slice(0, 3)) {
        try {
          await writer.generateForContent(draft.id);
          const result = await publisher.publish(draft.id);
          console.log(`  ${result.success ? '✓' : '○'} نشر #${draft.id}: ${result.message}`);
        } catch (e) { console.error(`  ✗ فشل نشر #${draft.id}:`, e.message); }
      }
      console.log(`[Scheduler] ✓ معالجة ${Math.min(drafts.length, 3)} مسودة`);
    } catch (e) { console.error('[Scheduler] ✗ فشل النشر:', e.message); }
  }

  async runArchiveSync() {
    console.log('[Scheduler] تشغيل مزامنة الأرشيف...');
    try {
      const unarchived = db.query('processed_content', pc => {
        const inArchive = db.findOne('archive', a => a.content_id === pc.id);
        return (pc.status === 'published' || pc.status === 'rejected') && !inArchive;
      });
      const publisher = require('./publisher');
      for (const item of unarchived) {
        publisher.archive(item.id, 'scheduler_sync');
      }
      console.log(`[Scheduler] ✓ أرشفة ${unarchived.length} عنصر`);
    } catch (e) { console.error('[Scheduler] ✗ فشل الأرشفة:', e.message); }
  }

  resetDailyCount() {
    db.upsert('settings', { key: 'total_published_today', value: '0', updated_at: new Date().toISOString() }, s => s.key === 'total_published_today');
    db.upsert('settings', { key: 'publish_date', value: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }, s => s.key === 'publish_date');
    console.log('[Scheduler] ✓ إعادة تعيين العداد اليومي');
  }
}

module.exports = new Scheduler();
