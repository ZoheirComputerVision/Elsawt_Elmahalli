const db = require('../database');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ArchiveSystem {
  buildTimeline() {
    const allContent = [...db.query('processed_content')]
      .filter(c => c.status === 'published' || c.status === 'rejected')
      .sort((a, b) => (b.event_date || b.created_at || '').localeCompare(a.event_date || a.created_at || ''));

    const timeline = {};
    for (const item of allContent) {
      const date = item.event_date || (item.created_at || '').split('T')[0] || 'غير محدد';
      const year = date.split('-')[0] || 'غير محدد';
      const month = date.split('-')[1] || '00';
      const monthNames = ['', 'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthName = monthNames[parseInt(month)] || month;

      if (!timeline[year]) timeline[year] = {};
      if (!timeline[year][monthName]) timeline[year][monthName] = [];
      timeline[year][monthName].push(item);
    }
    return timeline;
  }

  getStats() {
    const items = db.query('processed_content');
    const archived = db.query('archive');
    const logs = db.query('ai_decision_log');
    const views = db.query('views');
    return {
      total_published: items.filter(i => i.status === 'published').length,
      total_rejected: items.filter(i => i.status === 'rejected').length,
      total_archived: archived.length,
      total_drafts: items.filter(i => i.status === 'draft').length,
      total_review: items.filter(i => i.status === 'review').length,
      total_ai_decisions: logs.length,
      total_views: views.length,
      by_category: {
        news: items.filter(i => i.category === 'news' && i.status === 'published').length,
        activity: items.filter(i => i.category === 'activity' && i.status === 'published').length,
        announcement: items.filter(i => i.category === 'announcement' && i.status === 'published').length,
      },
    };
  }

  exportToJSON() {
    const data = {
      exported_at: new Date().toISOString(),
      school: config.SCHOOL_NAME,
      content: db.orderBy(db.query('processed_content'), 'created_at', 'desc'),
      archive: db.orderBy(db.query('archive'), 'archived_at', 'desc'),
      decisions: db.orderBy(db.query('ai_decision_log'), 'created_at', 'desc'),
      stats: this.getStats(),
    };
    const filePath = path.join(config.DATA_DIR, `export_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }
}

module.exports = new ArchiveSystem();
