const express = require('express');
const router = express.Router();
const db = require('../database');
const archive = require('../modules/archiver');

router.get('/status', (req, res) => {
  res.json({ school: 'ثانوية المجاهد خليل محمد المدعو يوسف', location: 'عين كرمس - تيارت', system: 'نظام الجريدة المدرسية الذكية AI', version: '1.0', status: 'active', last_update: new Date().toISOString() });
});

router.get('/content', (req, res) => {
  let items = db.query('processed_content');
  const { category, status, limit = 20, offset = 0, sort } = req.query;

  if (category) items = items.filter(i => i.category === category);
  if (status) items = items.filter(i => i.status === status);
  else items = items.filter(i => i.status === 'published');

  const sortField = ['created_at', 'published_at', 'overall_score', 'event_date'].includes(sort) ? sort : 'created_at';
  items.sort((a, b) => (b[sortField] || '').localeCompare((a[sortField] || '')));

  const total = items.length;
  items = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({ items, total, limit: parseInt(limit), offset: parseInt(offset) });
});

router.get('/content/:id', (req, res) => {
  const item = db.get('processed_content', parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'غير موجود' });
  const media = db.where('media', { content_id: item.id });
  res.json({ ...item, media });
});

router.get('/timeline', (req, res) => res.json(archive.buildTimeline()));
router.get('/stats', (req, res) => res.json(archive.getStats()));

router.get('/categories', (req, res) => {
  const items = db.query('processed_content', i => i.status === 'published');
  const counts = {};
  items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
  res.json(Object.entries(counts).map(([category, count]) => ({ category, count })));
});

router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ items: [] });
  const items = db.query('processed_content', i =>
    i.status === 'published' && (i.title.includes(q) || i.body.includes(q))
  ).slice(0, 20);
  res.json({ items, total: items.length, query: q });
});

router.get('/recent', (req, res) => {
  const items = db.query('processed_content', i => i.status === 'published')
    .sort((a, b) => (b.published_at || '').localeCompare((a.published_at || '')))
    .slice(0, 10);
  res.json(items);
});

module.exports = router;
