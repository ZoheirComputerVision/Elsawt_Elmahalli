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

router.post('/auth', (req, res) => {
  const { username, password } = req.body;
  if (username === 'zoheir' && password === 'admin2026') {
    return res.json({ success: true, token: 'admin-token', user: 'Zoheir IT Solutions' });
  }
  res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة' });
});

router.get('/dashboard', (req, res) => res.json(archive.getStats()));

router.get('/content', (req, res) => {
  let items = db.query('processed_content');
  const { status, category, limit = 50, offset = 0 } = req.query;
  if (status) items = items.filter(i => i.status === status);
  if (category) items = items.filter(i => i.category === category);
  items.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
  const total = items.length;
  items = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ items, total });
});

router.get('/content/:id', (req, res) => {
  const item = db.get('processed_content', parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'غير موجود' });
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

router.post('/content/:id/delete', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'غير موجود' });
    if (content.image_data) deleteImageFile(content.image_data);
    if (content.image_url && content.image_url.startsWith('/uploads/')) deleteImageFile(content.image_url);
    db.delete('processed_content', id);
    db.saveNow('processed_content');
    const archived = db.findOne('archive', a => a.content_id === id);
    if (archived) db.delete('archive', archived.id);
    db.saveNow('archive');
    res.json({ success: true, message: 'تم الحذف نهائيًا' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function processImageData(image_data) {
  if (image_data && typeof image_data === 'string' && image_data.startsWith('data:')) {
    const matches = image_data.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1].split('/')[1] || 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      return `/uploads/${filename}`;
    }
  }
  return image_data || '';
}

function deleteImageFile(imagePath) {
  if (imagePath && imagePath.startsWith('/uploads/')) {
    const filepath = path.join(UPLOADS_DIR, path.basename(imagePath));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

router.post('/content/:id/update', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, body, category, source_name, event_date, image_data, image_url, remove_image } = req.body;
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'غير موجود' });
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (category !== undefined) updateData.category = category;
    if (source_name !== undefined) updateData.source_name = source_name;
    if (event_date !== undefined) updateData.event_date = event_date;
    if (remove_image) {
      deleteImageFile(content.image_data);
      updateData.image_data = '';
      updateData.image_url = '';
    } else if (image_data && image_data.startsWith('data:')) {
      deleteImageFile(content.image_data);
      updateData.image_data = processImageData(image_data);
      if (image_url === undefined) updateData.image_url = '';
    } else if (image_url !== undefined) {
      updateData.image_url = image_url;
    }
    const updated = db.update('processed_content', id, updateData);
    db.saveNow('processed_content');
    res.json({ success: true, content: updated, message: 'تم التعديل بنجاح' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
    const { title, body, category, source, event_date, image_data } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, error: 'العنوان والمحتوى مطلوبان' });
    const data = { title, body, source: source || 'إداري', category: category || 'uncategorized', event_date: event_date || new Date().toISOString().split('T')[0], source_url: '' };
    if (image_data) {
      data.image_data = processImageData(image_data);
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

module.exports = router;
