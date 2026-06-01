const express = require('express');
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
  const result = await publisher.approveManual(parseInt(req.params.id));
  res.json(result);
});

router.post('/content/:id/reject', async (req, res) => {
  const { reason } = req.body;
  const result = await publisher.reject(parseInt(req.params.id), reason || 'مرفوض من المشرف');
  res.json(result);
});

router.post('/content/:id/delete', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = db.get('processed_content', id);
    if (!content) return res.status(404).json({ success: false, error: 'غير موجود' });
    db.delete('processed_content', id);
    db.saveNow('processed_content');
    const archived = db.findOne('archive', a => a.content_id === id);
    if (archived) db.delete('archive', archived.id);
    db.saveNow('archive');
    res.json({ success: true, message: 'تم الحذف نهائيًا' });
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
    const { title, body, category, source, event_date } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, error: 'العنوان والمحتوى مطلوبان' });
    const data = { title, body, source: source || 'إداري', category: category || 'uncategorized', event_date: event_date || new Date().toISOString().split('T')[0], source_url: '' };
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
    const drafts = db.query('processed_content', c => c.status === 'draft' && c.overall_score >= 0.8).slice(0, 5);
    const results = [];
    for (const draft of drafts) {
      await writer.generateForContent(draft.id);
      const result = await publisher.publish(draft.id);
      results.push({ id: draft.id, ...result });
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
