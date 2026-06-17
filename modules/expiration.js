const db = require('../database');
const audit = require('./audit');

const VISIBILITY_STATUSES = ['active', 'expired', 'archived'];

class ExpirationManager {
  checkAndExpireIfNeeded(item) {
    if (!item) return null;
    if (item.status === 'published' && (item.visibility_status === 'active' || !item.visibility_status) && item.expires_at) {
      const now = new Date().toISOString();
      if (item.expires_at <= now) {
        db.update('processed_content', item.id, { visibility_status: 'expired' });
        audit.log('system', 'content.expired', 'processed_content', item.id, { title: item.title, expires_at: item.expires_at });
        db.saveNow('processed_content');
        console.log(`[Expiration] فوري: انتهت صلاحية #${item.id}`);
        return { ...item, visibility_status: 'expired' };
      }
    }
    return item;
  }

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
    db.update('processed_content', item.id, { visibility_status: 'active', expires_at: null });
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

  archiveContent(id) {
    const item = db.get('processed_content', parseInt(id));
    if (!item) throw new Error('المحتوى غير موجود');
    db.update('processed_content', item.id, { visibility_status: 'archived' });
    db.saveNow('processed_content');
    return db.get('processed_content', item.id);
  }

  restoreContent(id) {
    const item = db.get('processed_content', parseInt(id));
    if (!item) throw new Error('المحتوى غير موجود');
    db.update('processed_content', item.id, { visibility_status: 'active' });
    db.saveNow('processed_content');
    return db.get('processed_content', item.id);
  }

  archiveExpiredContent() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let archived = 0;
    const items = db.query('processed_content', c =>
      c.status === 'published' && c.visibility_status === 'expired' && c.last_modified_at && c.last_modified_at <= thirtyDaysAgo
    );
    for (const item of items) {
      db.update('processed_content', item.id, { visibility_status: 'archived' });
      audit.log('system', 'content.auto_archived', 'processed_content', item.id, { title: item.title });
      archived++;
    }
    if (archived > 0) {
      db.saveNow('processed_content');
      console.log(`[Expiration] أرشفة تلقائية: ${archived} محتوى منتهي منذ أكثر من 30 يوماً`);
    }
    return archived;
  }
}

module.exports = new ExpirationManager();