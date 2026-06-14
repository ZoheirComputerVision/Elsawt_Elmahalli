const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const scheduler = require('./modules/scheduler');

const app = express();

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(config.PUBLIC_DIR));
app.use('/admin', express.static(config.ADMIN_DIR));

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'index.html')));

app.get('/admin', (req, res) => res.sendFile(path.join(config.ADMIN_DIR, 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(config.ADMIN_DIR, req.params[0] || 'index.html')));

app.get('/article/:id', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'article.html')));

app.use((err, req, res, next) => {
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

  await seed.seedIfEmpty();
  scheduler.start();
});

module.exports = app;
