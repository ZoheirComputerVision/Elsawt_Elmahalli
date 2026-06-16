const db = require('../database');

class Audit {
  log(user, action, targetType, targetId, metadata = {}) {
    return db.insert('audit_log', {
      user,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  query(filters = {}) {
    let items = db.query('audit_log');
    if (filters.user) items = items.filter(i => i.user === filters.user);
    if (filters.action) items = items.filter(i => i.action === filters.action);
    if (filters.target_type) items = items.filter(i => i.target_type === filters.target_type);
    if (filters.target_id !== undefined) items = items.filter(i => i.target_id === filters.target_id);
    if (filters.from) items = items.filter(i => i.created_at >= filters.from);
    if (filters.to) items = items.filter(i => i.created_at <= filters.to);
    items.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
    if (filters.limit) items = items.slice(0, parseInt(filters.limit));
    return items;
  }

  getRecent(limit = 50) {
    const items = db.query('audit_log');
    items.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
    return items.slice(0, limit);
  }
}

module.exports = new Audit();
