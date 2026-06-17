const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const config = require('./config');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const scheduler = require('./modules/scheduler');
const audit = require('./modules/audit');

// مسح البيانات إذا طلب ذلك (لمزامنة Render مع المحلي)
if (process.env.CLEAR_DATA === 'true') {
  const dataDir = config.DATA_DIR;
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    files.forEach(f => fs.writeFileSync(path.join(dataDir, f), '[]', 'utf-8'));
    console.log(`[Clear] تم مسح ${files.length} ملف بيانات`);
  }
}

// ── Upload Infrastructure ──
const UPLOADS_DIR = path.join(config.PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`[Upload] إنشاء مجلد الرفع: ${UPLOADS_DIR}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, GIF, WebP'), false);
    }
  },
});

// ── Role Security Foundation (centralized in modules/users) ──
const users = require('./modules/users');

function isAuthorized(userRole, requiredRole) {
  return users.isAuthorized(userRole, requiredRole);
}

function requireRole(role) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'journalist';
    if (isAuthorized(userRole, role)) return next();
    res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
  };
}

// ── Backup Foundation ──
const db = require('./database');

function createBackup(tableName) {
  const items = db.query(tableName);
  const backupPath = path.join(config.DATA_DIR, `backup_${tableName}_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(items, null, 2), 'utf-8');
  return backupPath;
}

function createFullBackup() {
  const tables = ['sources', 'raw_data', 'processed_content', 'media', 'archive',
    'ai_decision_log', 'admin_actions', 'settings', 'views',
    'breaking_news', 'featured_stories', 'audit_log'];
  const results = {};
  tables.forEach(t => { results[t] = createBackup(t); });
  return results;
}

const app = express();

// ── Share infrastructure with routes ──
app.set('upload', upload);
app.set('audit', audit);

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb', strict: false }));
app.use(express.urlencoded({ extended: true }));

function parseCookies(str) {
  if (!str) return {};
  const result = {};
  str.split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i > 0) result[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return result;
}

app.use('/admin', (req, res, next) => {
  const p = req.path;
  if (p === '' || p === '/' || p === '/index.html') return next();
  const ext = path.extname(p).toLowerCase();
  if (ext && ext !== '.html') return next();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.admin_token || '';
  if (token && users.authenticate(token)) return next();
  return res.redirect('/admin');
});

app.use(express.static(config.PUBLIC_DIR));

app.use('/admin', express.static(config.ADMIN_DIR));

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'index.html')));

app.get('/admin', (req, res) => res.sendFile(path.join(config.ADMIN_DIR, 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(config.ADMIN_DIR, req.params[0] || 'index.html')));

app.get('/article/:id', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'article.html')));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'حجم الملف يتجاوز الحد المسموح (10MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const seed = require('./modules/seed');

app.listen(config.PORT, async () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${config.SCHOOL_NAME}`);
  console.log(`  ${config.SCHOOL_SUB}`);
  console.log(`  ───────────────────────────────────────`);
  console.log(`  نظام النشرية الجهوية الذكية`);
  console.log(`  مدعوم بالذكاء الاصطناعي`);
  console.log(`  إدارة تقنية: ${config.ADMIN_TEAM}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ➜  http://localhost:${config.PORT}`);
  console.log(`  ➜  لوحة التحكم: http://localhost:${config.PORT}/admin`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`  📂 رفع الملفات: ${fs.readdirSync(UPLOADS_DIR).length} ملف`);
  console.log(`  📝 سجل التدقيق: ${db.count('audit_log')} إجراء`);

  await seed.seedIfEmpty();
  audit.log('system', 'server.start', 'system', 0, { port: config.PORT });
  scheduler.start();
});

module.exports = app;
module.exports.upload = upload;
module.exports.audit = audit;
module.exports.users = users;
module.exports.isAuthorized = isAuthorized;
module.exports.requireRole = requireRole;
module.exports.createBackup = createBackup;
module.exports.createFullBackup = createFullBackup;
