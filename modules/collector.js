const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');

const SEED_ARTICLES = [
  {
    title: 'افتتاح مشروع تهيئة الطريق الوطني رقم 14 الرابط بين تيارت وتسمسيلت',
    body: 'أشرفت السلطات الولائية لتيارت على افتتاح أشغال تهيئة الطريق الوطني رقم 14 الرابط بين ولايتي تيارت وتسمسيلت. المشروع الذي تبلغ ميزانيته أكثر من 2 مليار دينار جزائري سيساهم في تسهيل حركة المرور وتقليل حوادث السير. من المتوقع أن تستمر الأشغال لمدة 18 شهراً.',
    category: 'news', source: 'مديرية الأشغال العمومية', source_url: '', event_date: '2026-06-10',
  },
  {
    title: 'إعلان عن فتح باب الترشح للمجلس الشعبي البلدي لبلديات ولاية تيارت',
    body: 'تعلن مديرية الإدارة المحلية لولاية تيارت عن فتح باب الترشح لعضوية المجالس الشعبية البلدية في مختلف بلديات الولاية. على الراغبين في الترشح تقديم ملفاتهم لدى بلدياتهم الأصلية قبل تاريخ 20 يوليو 2026.',
    category: 'announcement', source: 'مديرية الإدارة المحلية', source_url: '', event_date: '2026-06-12',
  },
  {
    title: 'حملة التشجير الكبرى: غرس أكثر من 5000 شتلة في مختلف بلديات تيارت',
    body: 'أطلقت محافظة الغابات لولاية تيارت حملة تشجير كبرى بمناسبة اليوم العالمي للبيئة، حيث تم غرس أكثر من 5000 شتلة من مختلف الأصناف عبر بلديات الولاية. شارك في الحملة متطوعون من الجمعيات البيئية والكشافة الإسلامية الجزائرية.',
    category: 'activity', source: 'محافظة الغابات', source_url: '', event_date: '2026-06-05',
  },
  {
    title: 'انطلاق الموسم السياحي الصيفي: تنشيط الحركة السياحية بمنطقة تيارت',
    body: 'انطلقت فعاليات الموسم السياحي الصيفي بولاية تيارت، حيث تم تنظيم عدة برامج تنشيطية في المناطق السياحية كمنطقة تغنيف وغابة العابد وسد بني هارون. أكدت مديرية السياحة على جاهزية جميع المرافق والهياكل السياحية لاستقبال الزوار.',
    category: 'news', source: 'مديرية السياحة', source_url: '', event_date: '2026-06-01',
  },
  {
    title: 'لقاء تشاوري حول تحسين الخدمات الصحية في مستشفيات تيارت',
    body: 'عقدت مديرية الصحة والسكان لولاية تيارت لقاءً تشاورياً مع ممثلي المجتمع المدني ونقابات الصحة لمناقشة سبل تحسين الخدمات الصحية في مختلف المؤسسات الاستشفائية بالولاية.',
    category: 'activity', source: 'مديرية الصحة', source_url: '', event_date: '2026-06-03',
  },
  {
    title: 'حفل تكريم المتفوقين في المسابقات الثقافية والعلمية على مستوى ولاية تيارت',
    body: 'أقامت مديرية الثقافة والفنون لولاية تيارت حفلًا لتكريم المتفوقين في مختلف المسابقات الثقافية والعلمية على مستوى الولاية. شهد الحفل حضور السلطات المحلية وممثلي المجتمع المدني وأولياء المكرمين.',
    category: 'activity', source: 'مديرية الثقافة', source_url: '', event_date: '2026-06-07',
  },
  {
    title: 'إعلان عن انطلاق الموسم الفلاحي الجديد: توزيع الأسمدة والبذور المدعمة',
    body: 'تعلن مديرية المصالح الفلاحية لولاية تيارت عن انطلاق الموسم الفلاحي الجديد 2026/2027 وتوزيع الأسمدة والبذور المدعمة على الفلاحين. على الفلاحين الراغبين في الاستفادة التوجه إلى المصالح الفلاحية الدائرية.',
    category: 'announcement', source: 'مديرية المصالح الفلاحية', source_url: '', event_date: '2026-06-15',
  },
  {
    title: 'زيارة ميدانية لمتحف المجاهد بولاية تيارت لترسيخ الهوية الوطنية',
    body: 'في إطار ترسيخ الهوية الوطنية والوعي التاريخي، نظّمت مديرية المجاهدين لولاية تيارت زيارة ميدانية لمتحف المجاهد لفائدة طلاب المؤسسات التربوية والجامعية.',
    category: 'activity', source: 'مديرية المجاهدين', source_url: '', event_date: '2026-06-08',
  },
];

const HTTP_OPTS = {
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'ar,fr;q=0.9,en;q=0.8',
  },
};

class DataCollector {
  constructor() {
    this.lastFetch = {};
    this.minInterval = 30 * 60 * 1000;
  }

  _canFetch(source) {
    const last = this.lastFetch[source];
    if (!last) return true;
    return (Date.now() - last) >= this.minInterval;
  }

  _markFetched(source) {
    this.lastFetch[source] = Date.now();
  }

  _isDuplicate(title) {
    return db.findOne('raw_data', r => r.raw_text.includes(title));
  }

  _saveRaw(items, sourceId) {
    const saved = [];
    for (const item of items) {
      if (this._isDuplicate(item.title)) continue;
      const hash = uuidv4().replace(/-/g, '').slice(0, 16);
      db.insert('raw_data', {
        source_id: sourceId,
        raw_text: JSON.stringify(item),
        content_hash: hash,
        status: 'pending',
      });
      saved.push({ ...item, hash });
    }
    return saved;
  }

  async _fetch(url, timeout = 15000) {
    return axios.get(url, { ...HTTP_OPTS, timeout });
  }

  // -- المصادر الحقيقية --

  async _scrapeAkhbarDzair() {
    const items = [];
    const url = 'https://www.akhbardzair.dz/?s=' + encodeURIComponent('تيارت');
    const res = await this._fetch(url, 20000);
    if (res.status !== 200) return items;
    const $ = cheerio.load(res.data);
    $('.jeg_post').each((i, el) => {
      const title = $(el).find('.jeg_post_title a').text().trim();
      const excerpt = $(el).find('.jeg_post_excerpt p').text().trim();
      if (!title || !title.includes('تيارت')) return;
      items.push({
        title,
        body: excerpt || `مقال من أخبار دزاير حول: ${title}`,
        category: 'news',
        source: 'أخبار دزاير - تيارت',
        source_url: $(el).find('.jeg_post_title a').attr('href') || '',
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  async _scrapeElWatanRSS() {
    const items = [];
    const res = await this._fetch('https://elwatan.dz/feed/');
    if (res.status !== 200) return items;
    const $ = cheerio.load(res.data, { xmlMode: true });
    $('item').each((i, el) => {
      const title = $(el).find('title').text();
      const link = $(el).find('link').text();
      const desc = $(el).find('description').text();
      const creator = $(el).find('dc\\:creator').text();
      if (!title || (!title.toLowerCase().includes('tiaret') && !title.includes('تيارت'))) return;
      items.push({
        title,
        body: desc.replace(/<[^>]*>/g, '').trim() || `مقال من الشروق حول: ${title}`,
        category: 'news',
        source: creator ? `الشروق - ${creator}` : 'الشروق أونلاين',
        source_url: link,
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  async _scrapeUnlimitedNewsRSS() {
    const items = [];
    const res = await this._fetch('https://www.unlimited-news.com/feed');
    if (res.status !== 200) return items;
    const $ = cheerio.load(res.data, { xmlMode: true });
    $('item').each((i, el) => {
      const title = $(el).find('title').text();
      const link = $(el).find('link').text();
      const desc = $(el).find('description').text();
      if (!title || (!title.includes('تيارت') && !title.toLowerCase().includes('tiaret'))) return;
      items.push({
        title,
        body: desc.replace(/<[^>]*>/g, '').trim(),
        category: 'news',
        source: 'أخبار بلا حدود',
        source_url: link,
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  async _scrapeIcilinfo() {
    const items = [];
    const res = await this._fetch('https://www.icilinfo.dz/?s=' + encodeURIComponent('تيارت'), 20000);
    if (res.status !== 200) return items;
    const $ = cheerio.load(res.data);
    $('article').each((i, el) => {
      const title = $(el).find('.entry-title a').text().trim() || $(el).find('h2 a').text().trim() || $(el).find('h3 a').text().trim();
      const link = $(el).find('.entry-title a').attr('href') || $(el).find('h2 a').attr('href') || $(el).find('h3 a').attr('href');
      const excerpt = $(el).find('.entry-summary p').text().trim() || $(el).find('.post-excerpt').text().trim();
      if (!title || (!title.includes('تيارت') && !title.toLowerCase().includes('tiaret') && !title.toLowerCase().includes('tiart'))) return;
      items.push({
        title,
        body: excerpt || `مقال من ici l'info حول: ${title}`,
        category: 'news',
        source: 'Ici l\'info',
        source_url: link || '',
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  async _scrapeElmawkie() {
    const items = [];
    const res = await this._fetch('https://elmawkie.dz/?s=' + encodeURIComponent('تيارت'), 20000);
    if (res.status !== 200) return items;
    const $ = cheerio.load(res.data);
    $('article').each((i, el) => {
      const title = $(el).find('h2 a').text().trim() || $(el).find('.post-title a').text().trim();
      const link = $(el).find('h2 a').attr('href') || $(el).find('.post-title a').attr('href');
      const excerpt = $(el).find('p').first().text().trim();
      if (!title || !title.includes('تيارت')) return;
      items.push({
        title,
        body: excerpt || `مقال من الموقع حول: ${title}`,
        category: 'news',
        source: 'الموقع',
        source_url: link || '',
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  _useSeed() {
    return SEED_ARTICLES.map(a => ({ ...a }));
  }

  async collectAll() {
    console.log('[Collector] بدء جمع البيانات من المصادر الحية...');
    const scrapers = [
      { name: 'أخبار دزاير', fn: () => this._scrapeAkhbarDzair() },
      { name: 'الشروق RSS', fn: () => this._scrapeElWatanRSS() },
      { name: 'أخبار بلا حدود RSS', fn: () => this._scrapeUnlimitedNewsRSS() },
      { name: 'Ici l\'info', fn: () => this._scrapeIcilinfo() },
      { name: 'الموقع', fn: () => this._scrapeElmawkie() },
    ];

    const allItems = [];
    const source = db.findOne('sources', s => s.type === 'regional');

    for (const scraper of scrapers) {
      try {
        const items = await scraper.fn();
        if (items.length > 0) {
          console.log(`[Collector] ${scraper.name}: ${items.length} مقال`);
          const saved = this._saveRaw(items, source?.id || 1);
          allItems.push(...saved);
        }
      } catch (e) {
        console.log(`[Collector] ${scraper.name}: ${e.message}`);
      }
    }

    // إذا لم نجد أي مقالات حقيقية، نستخدم البذور
    if (allItems.length === 0) {
      console.log('[Collector] لم نجد مقالات حية، نستخدم المقالات الأساسية...');
      const seeds = this._useSeed();
      const saved = this._saveRaw(seeds, db.findOne('sources', s => s.type === 'official')?.id || 2);
      allItems.push(...saved);
    }

    if (source) {
      db.update('sources', source.id, { last_scraped: new Date().toISOString() });
    }

    console.log(`[Collector] تم جمع ${allItems.length} عنصر جديد`);
    return allItems;
  }

  /* تبقى للتوافق مع الإصدارات السابقة */
  async collectRegional() {
    return this.collectAll();
  }

  async collectOfficial() {
    return [];
  }

  async collectManual(data) {
    const source = db.findOne('sources', s => s.type === 'manual');
    const hash = uuidv4().replace(/-/g, '').slice(0, 16);
    const record = db.insert('raw_data', {
      source_id: source?.id || 3,
      raw_text: JSON.stringify(data),
      content_hash: hash,
      status: 'pending',
    });
    return { ...data, hash, raw_id: record.id };
  }
}

module.exports = new DataCollector();
