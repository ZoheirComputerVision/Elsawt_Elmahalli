const fs = require('fs');
const path = require('path');
const config = require('./config');

class Cache {
  constructor(ttl = 30000) {
    this.store = new Map();
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() - entry.time > this.ttl) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  set(key, data) {
    this.store.set(key, { data, time: Date.now() });
    // تجنب تسرب الذاكرة: حذف أقدم العناصر إذا تجاوزت 500
    if (this.store.size > 500) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  invalidate(pattern) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern) || key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
    };
  }
}

class JsonDB {
  constructor() {
    this.dir = config.DATA_DIR;
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    this.tables = {};
    this.initialized = false;
    this.cache = new Cache(20000); // 20 ثانية TTL
    this.saveQueue = {};
    this.saveTimer = null;
  }

  init() {
    if (this.initialized) return;
    const start = Date.now();
    this.tables = {
      sources: this._load('sources'),
      raw_data: this._load('raw_data'),
      processed_content: this._load('processed_content'),
      media: this._load('media'),
      archive: this._load('archive'),
      ai_decision_log: this._load('ai_decision_log'),
      admin_actions: this._load('admin_actions'),
      settings: this._load('settings'),
      views: this._load('views'),
    };
    this._seedDefaults();
    this.initialized = true;
    console.log(`[DB] تهيئة قاعدة البيانات: ${Object.values(this.tables).reduce((a, t) => a + t.length, 0)} سجل في ${Date.now() - start}ms`);
  }

  _load(name) {
    const fp = path.join(this.dir, `${name}.json`);
    try {
      const data = fs.readFileSync(fp, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  _saveNow(name) {
    this._save(name);
    delete this.saveQueue[name];
  }

  _save(name) {
    const fp = path.join(this.dir, `${name}.json`);
    fs.writeFileSync(fp, JSON.stringify(this.tables[name] || []), 'utf-8');
    this.cache.invalidate(`query:${name}`);
  }

  _debouncedSave(name) {
    this.saveQueue[name] = true;
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        for (const tableName of Object.keys(this.saveQueue)) {
          this._save(tableName);
        }
        this.saveQueue = {};
        this.saveTimer = null;
      }, 500);
    }
  }

  _seedDefaults() {
    if (this.tables.sources.length === 0) {
      this.tables.sources = [
        { id: 1, name: 'صفحة أخبار تيارت الرسمية', url: `https://www.facebook.com/${config.AI.FACEBOOK_PAGE}`, type: 'regional', is_active: 1, trust_score: 0.75, last_scraped: null, created_at: new Date().toISOString() },
        { id: 2, name: 'موقع ولاية تيارت', url: config.AI.MINISTRY_URL, type: 'official', is_active: 1, trust_score: 0.9, last_scraped: null, created_at: new Date().toISOString() },
        { id: 3, name: 'إدخال يدوي - الصوت المحلي', url: '', type: 'manual', is_active: 1, trust_score: 1.0, last_scraped: null, created_at: new Date().toISOString() },
      ];
      this._save('sources');
    }

    if (this.tables.settings.length === 0) {
      this.tables.settings = [
        { key: 'stop_auto_publish', value: 'false', updated_at: new Date().toISOString() },
        { key: 'require_human_review', value: 'false', updated_at: new Date().toISOString() },
        { key: 'last_scheduler_run', value: 'never', updated_at: new Date().toISOString() },
        { key: 'total_published_today', value: '0', updated_at: new Date().toISOString() },
        { key: 'publish_date', value: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() },
      ];
      this._save('settings');
    }
  }

  _nextId(table) {
    const arr = this.tables[table] || [];
    return arr.length > 0 ? Math.max(...arr.map(r => r.id || 0)) + 1 : 1;
  }

  query(table, fn) {
    // استعلامات متكررة (مثل published content) تستفيد من الكاش
    const cacheKey = fn ? `query:${table}:${fn.toString().slice(0, 50)}` : `query:${table}:all`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const items = this.tables[table] || [];
    const result = fn ? items.filter(fn) : [...items];

    // فقط تخزين مؤقت للاستعلامات التي ترجع بيانات غير قابلة للتغيير مؤقتًا
    if (items.length < 200) {
      this.cache.set(cacheKey, result);
    }
    return result;
  }

  get(table, id) {
    const cacheKey = `get:${table}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = (this.tables[table] || []).find(r => r.id === id) || null;
    if (result) this.cache.set(cacheKey, result);
    return result;
  }

  findOne(table, fn) {
    return (this.tables[table] || []).find(fn) || null;
  }

  insert(table, data) {
    const id = this._nextId(table);
    const record = { id, ...data, created_at: new Date().toISOString() };
    this.tables[table].push(record);
    this._saveNow(table);
    this.cache.invalidate(table);
    return record;
  }

  update(table, id, data) {
    const arr = this.tables[table];
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...data, updated_at: new Date().toISOString() };
    this._saveNow(table);
    this.cache.invalidate(table);
    return arr[idx];
  }

  upsert(table, data, matchFn) {
    const arr = this.tables[table];
    const existing = matchFn ? arr.find(matchFn) : null;
    if (existing) {
      Object.assign(existing, data, { updated_at: new Date().toISOString() });
      this._saveNow(table);
      this.cache.invalidate(table);
      return existing;
    }
    return this.insert(table, data);
  }

  delete(table, id) {
    const arr = this.tables[table];
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this._saveNow(table);
    this.cache.invalidate(table);
    return true;
  }

  saveNow(table) {
    this._saveNow(table);
  }

  count(table, fn) {
    const items = this.tables[table] || [];
    return fn ? items.filter(fn).length : items.length;
  }

  where(table, conditions) {
    let items = this.tables[table] || [];
    for (const [key, val] of Object.entries(conditions)) {
      items = items.filter(r => r[key] === val);
    }
    return items;
  }

  orderBy(items, key, dir = 'desc') {
    return [...items].sort((a, b) => {
      const va = (a[key] || '').toString();
      const vb = (b[key] || '').toString();
      if (dir === 'desc') return vb.localeCompare(va);
      return va.localeCompare(vb);
    });
  }

  limit(items, n, offset = 0) {
    return items.slice(offset, offset + n);
  }

  getCacheStats() {
    return this.cache.stats();
  }
}

const instance = new JsonDB();
instance.init();

module.exports = instance;
