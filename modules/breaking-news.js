const db = require('../database');

class BreakingNewsManager {
  _nextPriority() {
    const items = db.query('breaking_news');
    return items.length > 0 ? Math.max(...items.map(i => i.priority || 0)) + 1 : 1;
  }

  _normalizePriorities() {
    const items = db.query('breaking_news').sort((a, b) => (a.priority || 0) - (b.priority || 0));
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const expected = i + 1;
      if (items[i].priority !== expected) {
        items[i].priority = expected;
        changed = true;
      }
    }
    if (changed) db.saveNow('breaking_news');
  }

  _isVisible(item) {
    if (!item.is_active) return false;
    const now = new Date();
    if (item.starts_at && new Date(item.starts_at) > now) return false;
    if (item.expires_at && new Date(item.expires_at) <= now) return false;
    return true;
  }

  create(data) {
    if (!data.title || !data.title.trim()) throw new Error('العنوان مطلوب');

    const record = db.insert('breaking_news', {
      title: data.title.trim(),
      article_id: data.article_id ? parseInt(data.article_id) : null,
      url: data.url || null,
      priority: data.priority || this._nextPriority(),
      is_active: data.is_active !== false,
      starts_at: data.starts_at || null,
      expires_at: data.expires_at || null,
      created_by: data.created_by || 'system',
      updated_at: null,
    });
    db.saveNow('breaking_news');
    this._normalizePriorities();
    return record;
  }

  update(id, data) {
    const record = db.get('breaking_news', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');

    const updates = {};
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.article_id !== undefined) updates.article_id = data.article_id ? parseInt(data.article_id) : null;
    if (data.url !== undefined) updates.url = data.url;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    if (data.starts_at !== undefined) updates.starts_at = data.starts_at;
    if (data.expires_at !== undefined) updates.expires_at = data.expires_at;
    updates.updated_at = new Date().toISOString();

    const updated = db.update('breaking_news', parseInt(id), updates);
    db.saveNow('breaking_news');
    if (data.priority !== undefined) this._normalizePriorities();
    return updated;
  }

  remove(id) {
    const record = db.get('breaking_news', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');
    db.delete('breaking_news', parseInt(id));
    db.saveNow('breaking_news');
    this._normalizePriorities();
    return { success: true };
  }

  list(filters = {}) {
    let items = db.query('breaking_news');
    if (filters.is_active !== undefined) {
      const val = filters.is_active === 'true' || filters.is_active === true;
      items = items.filter(i => i.is_active === val);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(q));
    }
    if (filters.expired === 'true') {
      items = items.filter(i => i.expires_at && new Date(i.expires_at) <= new Date());
    }
    if (filters.expired === 'false') {
      items = items.filter(i => !i.expires_at || new Date(i.expires_at) > new Date());
    }
    items.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const total = items.length;
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    return { items: items.slice(offset, offset + limit), total };
  }

  getActive() {
    const items = db.query('breaking_news')
      .filter(i => this._isVisible(i))
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return items;
  }

  reorder(id, direction) {
    const record = db.get('breaking_news', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');

    const all = db.query('breaking_news').sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const idx = all.findIndex(i => i.id === parseInt(id));
    if (idx === -1) throw new Error('السجل غير موجود');

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= all.length) {
      throw new Error(direction === 'up' ? 'هذا أول عنصر' : 'هذا آخر عنصر');
    }

    const tempPriority = all[idx].priority;
    all[idx].priority = all[swapIdx].priority;
    all[swapIdx].priority = tempPriority;

    db.saveNow('breaking_news');
    this._normalizePriorities();
    return this.list();
  }

  archiveExpired() {
    const now = new Date();
    const expired = db.query('breaking_news').filter(i =>
      i.is_active && i.expires_at && new Date(i.expires_at) <= now
    );
    const count = expired.length;
    expired.forEach(item => {
      db.update('breaking_news', item.id, { is_active: false, updated_at: now.toISOString() });
    });
    if (count > 0) db.saveNow('breaking_news');
    return { archived: count };
  }

  validate(data) {
    const errors = [];
    if (!data.title || !data.title.trim()) errors.push('العنوان مطلوب');
    if (data.starts_at && data.expires_at && new Date(data.starts_at) >= new Date(data.expires_at)) {
      errors.push('تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء');
    }
    if (data.url && data.url.length > 500) errors.push('الرابط طويل جداً');
    return errors;
  }
}

module.exports = new BreakingNewsManager();
