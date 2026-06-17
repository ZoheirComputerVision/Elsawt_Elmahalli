const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../database');
const collector = require('../modules/collector');
const analyzer = require('../modules/analyzer');
const writer = require('../modules/writer');
const publisher = require('../modules/publisher');
const archive = require('../modules/archiver');
const mediaService = require('../modules/media');
const audit = require('../modules/audit');

// ── Auth middleware ──
const users = require('../modules/users');

function requireAuth(req, res, next) {
  const token = req.headers['x-admin-auth'];
  const user = users.authenticate(token);
  if (user) {
    req.user = user;
    return next();
  }
  res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول' });
}

function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (users.isAuthorized(req.user?.role, role)) return next();
      res.status(403).json({ error: 'صلاحية غير كافية لهذا الإجراء' });
    });
  };
}

// ── Login rate limiting ──
const LOGIN_RATE_WINDOW = 60000;
const MAX_LOGIN_PER_WINDOW = 10;
const loginRateMap = new Map();

function loginRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  const now = Date.now();
  const record = loginRateMap.get(ip) || { count: 0, windowStart: now };
  if (now - record.windowStart > LOGIN_RATE_WINDOW) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count++;
  loginRateMap.set(ip, record);
  if (record.count > MAX_LOGIN_PER_WINDOW) {
    return res.status(429).json({ success: false, error: 'محاولات كثيرة جداً. حاول لاحقاً' });
  }
  next();
}

router.post('/auth', loginRateLimit, (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  const result = users.login(username, password, ip);
  if (result) {
    audit.log(result.user.username, 'user.login', 'users', result.user.id, { role: result.user.role });
    res.cookie('admin_token', result.token, { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
    return res.json({ success: true, token: result.token, user: result.user.fullName || result.user.username, role: result.user.role });
  }
  // Differentiate error for suspended/archived accounts
  const existing = users.getUserByUsername(username);
  if (existing && existing.status === 'suspended') {
    return res.status(401).json({ success: false, error: '❌ الحساب موقوف' });
  }
  if (existing && existing.status === 'archived') {
    return res.status(401).json({ success: false, error: '❌ الحساب مؤرشف' });
  }
  const status = users.getRateLimitStatus(ip);
  if (!status.allowed) {
    return res.status(429).json({ success: false, error: `الحساب مقفل مؤقتاً. حاول بعد ${status.remaining} ثانية` });
  }
  res.status(401).json({ success: false, error: '❌ اسم المستخدم أو كلمة المرور غير صحيحة' });
});

const { resolve: resolveCategory } = require('../modules/categories');

// ── User Management ──

router.get('/users', requireRole('editor_in_chief'), (req, res) => {
  try {
    const result = users.listUsers({
      role: req.query.role,
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', requireRole('publisher'), (req, res) => {
  try {
    const { fullName, username, email, phone, password, role } = req.body;
    const record = users.createUser({ fullName, username, email, phone, password, role, createdBy: req.user?.fullName || req.user?.username });
    audit.log(req.user?.username, 'user.create', 'users', record.id, { username, role });
    res.status(201).json(record);
  } catch (e) {
    const status = e.message.includes('موجود مسبقاً') ? 409 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.put('/users/:id', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = users.updateUser(id, req.body);
    audit.log(req.user?.username, 'user.update', 'users', id, req.body);
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/suspend', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = users.suspendUser(id);
    audit.log(req.user?.username, 'user.suspend', 'users', id, {});
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/activate', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = users.activateUser(id);
    audit.log(req.user?.username, 'user.activate', 'users', id, {});
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/archive', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = users.archiveUser(id);
    audit.log(req.user?.username, 'user.archive', 'users', id, {});
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/restore', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = users.restoreUser(id);
    audit.log(req.user?.username, 'user.restore', 'users', id, {});
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/role', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { role } = req.body;
    const record = users.changeRole(id, role);
    audit.log(req.user?.username, 'user.role_change', 'users', id, { role });
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/users/:id/reset-password', requireRole('publisher'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password } = req.body;
    const record = users.resetPassword(id, password);
    audit.log(req.user?.username, 'user.password_reset', 'users', id, {});
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/auth/logout', requireAuth, (req, res) => {
  const token = req.headers['x-admin-auth'];
  users.logout(token);
  res.clearCookie('admin_token');
  res.json({ success: true });
});

router.get('/dashboard', requireAuth, (req, res) => res.json(archive.getStats()));

const expiration = require('../modules/expiration');

router.get('/content', (req, res) => {
  let items = db.query('processed_content');
  const { status, category, visibility_status, limit = 50, offset = 0 } = req.query;
  // Real-time expiration check
  if (!visibility_status || visibility_status === 'active') {
    items = items.map(item => expiration.checkAndExpireIfNeeded(item));
  }
  if (status) items = items.filter(i => i.status === status);
  if (visibility_status) items = items.filter(i => i.visibility_status === visibility_status);
  if (category) {
    const resolved = resolveCategory(category);
    const matchNames = resolved ? [resolved.name, ...resolved.legacy] : [category];
    items = items.filter(i => matchNames.includes(i.category));
  }
  items.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
  const total = items.length;
  items = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ items, total });
});

router.get('/content/expiring-soon', requireRole('editor_in_chief'), (req, res) => {
  try {
    const items = expiration.getExpiringSoon(parseInt(req.query.days) || 7);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/content/:id', (req, res) => {
  let item = db.get('processed_content', parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'غير موجود' });
  item = expiration.checkAndExpireIfNeeded(item);
  const logs = db.query('ai_decision_log', l => l.content_id === item.id).sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
  res.json({ ...item, logs });
});

router.post('/content/:id/approve', async (req, res) => {
  try {
    const result = await publisher.approveManual(parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/content/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await publisher.reject(parseInt(req.params.id), reason || 'مرفوض من المشرف');
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Article Image Management ──

router.post('/content/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'المقال غير موجود' });

    const { media_id, remove } = req.body;

    // Remove image
    if (remove === true) {
      if (content.image_data) {
        const allMedia = db.query('media');
        const linked = allMedia.find(m => m.path === content.image_data);
        if (linked) {
          mediaService.removeUsage(linked.id, id, 'article');
        }
      }
      const updated = db.update('processed_content', id, { image_data: null });
      db.saveNow('processed_content');
      return res.json({ success: true, image_data: null, message: 'تمت إزالة الصورة' });
    }

    // Set or replace image
    if (!media_id) return res.status(400).json({ success: false, error: 'media_id مطلوب' });
    const media = db.get('media', parseInt(media_id));
    if (!media) return res.status(404).json({ success: false, error: 'الوسيط غير موجود' });

    // If article already has image, remove old usage
    if (content.image_data) {
      const oldMedia = db.query('media').find(m => m.path === content.image_data);
      if (oldMedia && oldMedia.id !== parseInt(media_id)) {
        try { mediaService.removeUsage(oldMedia.id, id, 'article'); } catch {}
      }
    }

    // Add new usage
    mediaService.addUsage(parseInt(media_id), id, 'article');
    const updated = db.update('processed_content', id, { image_data: media.path });
    db.saveNow('processed_content');
    res.json({ success: true, image_data: media.path, media });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/content/:id/delete', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'غير موجود' });
    // Cleanup linked media usage
    if (content.image_data) {
      const allMedia = db.query('media');
      const linkedMedia = allMedia.find(m => m.path === content.image_data || m.id === parseInt(content.image_data));
      if (linkedMedia) {
        try { mediaService.removeUsage(linkedMedia.id, id, 'article'); } catch {}
      }
    }
    db.delete('processed_content', id);
    db.saveNow('processed_content');
    const archived = db.findOne('archive', a => a.content_id === id);
    if (archived) db.delete('archive', archived.id);
    db.saveNow('archive');
    res.json({ success: true, message: 'تم الحذف نهائيًا' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/content/:id/update', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, body, category, source_name, event_date, expires_at, visibility_status } = req.body;
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'غير موجود' });
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (category !== undefined) updateData.category = category;
    if (source_name !== undefined) updateData.source_name = source_name;
    if (event_date !== undefined) updateData.event_date = event_date;
    if (expires_at !== undefined) updateData.expires_at = expires_at;
    if (visibility_status !== undefined) updateData.visibility_status = visibility_status;
    updateData.last_modified_at = new Date().toISOString();
    const updated = db.update('processed_content', id, updateData);
    db.saveNow('processed_content');
    res.json({ success: true, content: updated, message: 'تم التعديل بنجاح' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/content/:id/archive', requireRole('editor_in_chief'), async (req, res) => {
  try {
    const result = expiration.archiveContent(parseInt(req.params.id));
    audit.log(req.user?.username, 'content.archived', 'processed_content', result.id, { title: result.title });
    res.json({ success: true, content: result, message: 'تم أرشفة المحتوى' });
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ success: false, error: e.message });
  }
});

router.post('/content/:id/restore', requireRole('editor_in_chief'), async (req, res) => {
  try {
    const result = expiration.restoreContent(parseInt(req.params.id));
    audit.log(req.user?.username, 'content.restored', 'processed_content', result.id, { title: result.title });
    res.json({ success: true, content: result, message: 'تم استعادة المحتوى من الأرشيف' });
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ success: false, error: e.message });
  }
});

router.post('/content/:id/reactivate', requireRole('editor_in_chief'), async (req, res) => {
  try {
    const result = expiration.reactivateContent(parseInt(req.params.id));
    audit.log(req.user?.username, 'content.reactivated', 'processed_content', result.id, { title: result.title });
    res.json({ success: true, content: result, message: 'تم إعادة تنشيط المحتوى' });
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ success: false, error: e.message });
  }
});

router.post('/content/:id/expire', requireRole('editor_in_chief'), async (req, res) => {
  try {
    const result = expiration.expireContent(parseInt(req.params.id));
    audit.log(req.user?.username, 'content.expired', 'processed_content', result.id, { title: result.title });
    res.json({ success: true, content: result, message: 'تم إنهاء صلاحية المحتوى' });
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ success: false, error: e.message });
  }
});

router.post('/content/:id/generate', async (req, res) => {
  try {
    const article = await writer.generateForContent(parseInt(req.params.id));
    res.json({ success: true, article });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/collect', async (req, res) => {
  try {
    const items = await collector.collectAll();
    res.json({ success: true, collected: items.length, items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/collect/manual', async (req, res) => {
  try {
    const { title, body, category, source, event_date, image_data, expires_at } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, error: 'العنوان والمحتوى مطلوبان' });
    const data = { title, body, source: source || 'إداري', category: category || 'uncategorized', event_date: event_date || new Date().toISOString().split('T')[0], source_url: '', expires_at: expires_at || null };
    if (image_data && typeof image_data === 'string' && image_data.startsWith('data:')) {
      const matches = image_data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1].split('/')[1] || 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filepath = path.join(__dirname, '..', 'public', 'uploads', filename);
        fs.writeFileSync(filepath, buffer);
        data.image_data = `/uploads/${filename}`;
      } else {
        data.image_data = image_data;
      }
    } else if (image_data) {
      data.image_data = image_data;
    }
    const result = await collector.collectManual(data);
    const rawRows = db.findOne('raw_data', r => r.content_hash === result.hash);
    if (rawRows) await analyzer.analyzeRawData(rawRows.id);
    res.json({ success: true, message: 'تم إرسال المحتوى للمعالجة' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/analyze', async (req, res) => {
  try {
    const pending = db.query('raw_data', r => r.status === 'pending').slice(0, 5);
    const results = [];
    for (const item of pending) {
      const result = await analyzer.analyzeRawData(item.id);
      if (result) results.push({ id: item.id, ...result });
    }
    res.json({ success: true, processed: results.length, results });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/publish', async (req, res) => {
  try {
    const candidates = db.query('processed_content', c => c.status !== 'published' && c.status !== 'rejected').slice(0, 10);
    const results = [];
    for (const item of candidates) {
      if (!item.writer_version) {
        await writer.generateForContent(item.id);
      }
      const result = await publisher.publish(item.id);
      results.push({ id: item.id, ...result, current_status: item.status });
    }
    res.json({ success: true, processed: results.length, results });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/logs', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  let logs = db.query('ai_decision_log').sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
  const total = logs.length;
  const items = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit)).map(log => {
    const content = db.get('processed_content', log.content_id);
    return { ...log, title: content ? content.title : 'N/A' };
  });
  res.json({ items, total });
});

router.get('/settings', (req, res) => {
  const settings = db.query('settings');
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.upsert('settings', { key, value, updated_at: new Date().toISOString() }, s => s.key === key);
  res.json({ success: true, key, value });
});

router.post('/archive/export', (req, res) => {
  const filePath = archive.exportToJSON();
  res.json({ success: true, path: filePath });
});

router.get('/archive/timeline', (req, res) => res.json(archive.buildTimeline()));

router.get('/sources', (req, res) => res.json(db.query('sources')));

router.post('/scheduler/run-collector', async (req, res) => {
  try {
    const s = require('../modules/scheduler');
    await s.runCollector();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Featured Stories ──
const featured = require('../modules/featured');

router.get('/featured-stories', requireAuth, (req, res) => {
  try {
    const result = featured.list({
      is_active: req.query.is_active,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/featured-stories', requireRole('editor_in_chief'), (req, res) => {
  try {
    const { article_id, featured_order, is_active } = req.body;
    if (!article_id) return res.status(400).json({ error: 'article_id مطلوب' });
    const record = featured.create({
      article_id,
      featured_order,
      is_active,
      created_by: req.user?.username || 'system',
    });
    audit.log(req.user?.username || 'system', 'featured.create', 'featured_stories', record.id, { article_id });
    res.status(201).json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') || e.message.includes('مسبقاً') ? 409 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.put('/featured-stories/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = featured.update(id, req.body);
    audit.log(req.user?.username || 'system', 'featured.update', 'featured_stories', id, req.body);
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.delete('/featured-stories/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = featured.remove(id);
    audit.log(req.user?.username || 'system', 'featured.delete', 'featured_stories', id, {});
    res.json(result);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/featured-stories/reorder', requireRole('editor_in_chief'), (req, res) => {
  try {
    const { id, direction } = req.body;
    if (!id || !direction) return res.status(400).json({ error: 'id و direction مطلوبان' });
    if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction يجب أن يكون up أو down' });
    const result = featured.reorder(parseInt(id), direction);
    audit.log(req.user?.username || 'system', 'featured.reorder', 'featured_stories', id, { direction });
    res.json(result);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

// ── Breaking News ──
const breaking = require('../modules/breaking-news');

router.get('/breaking-news', requireAuth, (req, res) => {
  try {
    const result = breaking.list({
      is_active: req.query.is_active,
      search: req.query.search,
      expired: req.query.expired,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/breaking-news', requireRole('editor_in_chief'), (req, res) => {
  try {
    const { title, article_id, url, priority, is_active, starts_at, expires_at } = req.body;
    const errors = breaking.validate(req.body);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });
    const record = breaking.create({
      title, article_id, url, priority, is_active,
      starts_at: starts_at || null,
      expires_at: expires_at || null,
      created_by: req.user?.username || 'system',
    });
    audit.log(req.user?.username || 'system', 'breaking.create', 'breaking_news', record.id, { title });
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/breaking-news/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = breaking.update(id, req.body);
    audit.log(req.user?.username || 'system', 'breaking.update', 'breaking_news', id, req.body);
    res.json(record);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.delete('/breaking-news/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = breaking.remove(id);
    audit.log(req.user?.username || 'system', 'breaking.delete', 'breaking_news', id, {});
    res.json(result);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/breaking-news/reorder', requireRole('editor_in_chief'), (req, res) => {
  try {
    const { id, direction } = req.body;
    if (!id || !direction) return res.status(400).json({ error: 'id و direction مطلوبان' });
    if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction يجب أن يكون up أو down' });
    const result = breaking.reorder(parseInt(id), direction);
    audit.log(req.user?.username || 'system', 'breaking.reorder', 'breaking_news', id, { direction });
    res.json(result);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post('/breaking-news/archive-expired', requireRole('editor_in_chief'), (req, res) => {
  try {
    const result = breaking.archiveExpired();
    if (result.archived > 0) {
      audit.log(req.user?.username || 'system', 'breaking.archive', 'breaking_news', 0, { count: result.archived });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Media Management ──

router.get('/media', requireAuth, (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      uploader: req.query.uploader,
      search: req.query.search,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      mime_type: req.query.mime_type,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
    };
    const result = mediaService.query(filters);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/media/upload', requireRole('editor_in_chief'), (req, res) => {
  const upload = req.app.get('upload');
  if (!upload) return res.status(500).json({ error: 'مرفع الملفات غير مهيأ' });
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });
    try {
      const record = mediaService.upload(req.file, {
        alt_text: req.body.alt_text || '',
        caption: req.body.caption || '',
        category: req.body.category || '',
        uploader: req.user?.username || 'system',
      });
      res.status(201).json(record);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
});

router.put('/media/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = {
      alt_text: req.body.alt_text,
      caption: req.body.caption,
      category: req.body.category,
      uploader: req.user?.username,
    };
    const updated = mediaService.updateMetadata(id, updates);
    res.json(updated);
  } catch (e) {
    const status = e.message.includes('غير موجود') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.delete('/media/:id', requireRole('editor_in_chief'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = mediaService.delete(id);
    if (!result.success) {
      if (result.error.includes('غير موجود')) return res.status(404).json(result);
      return res.status(409).json(result);
    }
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/media/bulk-delete', requireRole('editor_in_chief'), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'المعرفات مطلوبة' });
    }
    const deleted = [];
    const blocked = [];
    for (const id of ids) {
      const result = mediaService.delete(parseInt(id));
      if (result.success) {
        deleted.push(id);
      } else {
        blocked.push({ id, ...result });
      }
    }
    res.json({ deleted, blocked });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
