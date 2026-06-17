const db = require('../database');
const audit = require('./audit');

const VISIBILITY_STATUSES = ['active', 'expired', 'archived'];

class ExpirationManager {
  checkExpired() {
    const now = new Date().toISOString();
    let expired = 0;
    const items = db.query('processed_content', c =>
      c.status === 'published' && c.visibility_status === 'active' && c.expires_at && c.expires_at <= now
    );
    for (const item of items) {
      db.update('processed_content', item.id, { visibility_status: 'expired' });
      audit.log('system', 'content.expired', 'processed_content', item.id, { title: item.title, expires_at: item.expires_at });
      expired++;
    }
    if (expired > 0) {
      db.saveNow('processed_content');
      console.log(`[Expiration] انتهت صلاحية ${expired} محتوى`);
    }
    return expired;
  }

  expireContent(id) {
    const item = db.get('processed_content', parseInt(id));
    if (!item) throw new Error('المحتوى غير موجود');
    db.update('processed_content', item.id, { visibility_status: 'expired' });
    db.saveNow('processed_content');
    return db.get('processed_content', item.id);
  }

  reactivateContent(id) {
    const item = db.get('processed_content', parseInt(id));
    if (!item) throw new Error('المحتوى غير موجود');
    db.update('processed_content', item.id, { visibility_status: 'active' });
    db.saveNow('processed_content');
    return db.get('processed_content', item.id);
  }

  getExpiringSoon(days = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return db.query('processed_content', c =>
      c.status === 'published' && c.visibility_status === 'active' && c.expires_at &&
      c.expires_at > now.toISOString() && c.expires_at <= future
    );
  }
}

module.exports = new ExpirationManager();