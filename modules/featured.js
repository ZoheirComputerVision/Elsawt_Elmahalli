const db = require('../database');

class FeaturedManager {
  _nextOrder() {
    const items = db.query('featured_stories');
    return items.length > 0 ? Math.max(...items.map(i => i.featured_order || 0)) + 1 : 1;
  }

  _normalizeOrders() {
    const items = db.query('featured_stories').sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const expected = i + 1;
      if (items[i].featured_order !== expected) {
        items[i].featured_order = expected;
        changed = true;
      }
    }
    if (changed) db.saveNow('featured_stories');
  }

  create(data) {
    const articleId = parseInt(data.article_id);
    const article = db.get('processed_content', articleId);
    if (!article) throw new Error('المقال غير موجود');

    const existing = db.findOne('featured_stories', f => f.article_id === articleId);
    if (existing) throw new Error('هذا المقال مضاف مسبقاً إلى المميزة');

    const record = db.insert('featured_stories', {
      article_id: articleId,
      title: article.title || '',
      featured_order: data.featured_order || this._nextOrder(),
      is_active: data.is_active !== false,
      created_by: data.created_by || 'system',
      updated_at: null,
    });
    db.saveNow('featured_stories');
    this._normalizeOrders();
    return record;
  }

  update(id, data) {
    const record = db.get('featured_stories', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');

    const updates = {};
    if (data.featured_order !== undefined) updates.featured_order = data.featured_order;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    updates.updated_at = new Date().toISOString();

    const updated = db.update('featured_stories', parseInt(id), updates);
    db.saveNow('featured_stories');
    if (data.featured_order !== undefined) this._normalizeOrders();
    return updated;
  }

  remove(id) {
    const record = db.get('featured_stories', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');
    db.delete('featured_stories', parseInt(id));
    db.saveNow('featured_stories');
    this._normalizeOrders();
    return { success: true };
  }

  list(filters = {}) {
    let items = db.query('featured_stories');
    if (filters.is_active !== undefined) {
      const val = filters.is_active === 'true' || filters.is_active === true;
      items = items.filter(i => i.is_active === val);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(q));
    }
    items.sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
    const total = items.length;
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    return { items: items.slice(offset, offset + limit), total };
  }

  getActive() {
    const items = db.query('featured_stories')
      .filter(i => i.is_active === true)
      .sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
    // Enrich with article data
    return items.map(item => {
      const article = db.get('processed_content', item.article_id);
      return { ...item, article: article || null };
    });
  }

  reorder(id, direction) {
    const record = db.get('featured_stories', parseInt(id));
    if (!record) throw new Error('السجل غير موجود');

    const all = db.query('featured_stories').sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
    const idx = all.findIndex(i => i.id === parseInt(id));
    if (idx === -1) throw new Error('السجل غير موجود');

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= all.length) {
      throw new Error(direction === 'up' ? 'هذا أول عنصر' : 'هذا آخر عنصر');
    }

    const tempOrder = all[idx].featured_order;
    all[idx].featured_order = all[swapIdx].featured_order;
    all[swapIdx].featured_order = tempOrder;

    db.saveNow('featured_stories');
    this._normalizeOrders();
    return this.list();
  }
}

module.exports = new FeaturedManager();
