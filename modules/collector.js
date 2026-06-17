const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');

const SEED_ARTICLES = [
  {
    title: 'افتتاح مشروع تهيئة الطريق الوطني رقم 14 الرابط بين تيارت وتسمسيلت',
    body: 'أشرفت السلطات الولائية لتيارت على افتتاح أشغال تهيئة الطريق الوطني رقم 14 الرابط بين ولايتي تيارت وتسمسيلت. المشروع الذي تبلغ ميزانيته أكثر من 2 مليار دينار جزائري سيساهم في تسهيل حركة المرور وتقليل حوادث السير.',
    category: 'الوطن', source: 'مديرية الأشغال العمومية', source_url: '', event_date: '2026-06-10',
  },
  {
    title: 'حملة التشجير الكبرى: غرس أكثر من 5000 شتلة في مختلف بلديات تيارت',
    body: 'أطلقت محافظة الغابات لولاية تيارت حملة تشجير كبرى بمناسبة اليوم العالمي للبيئة، حيث تم غرس أكثر من 5000 شتلة من مختلف الأصناف عبر بلديات الولاية.',
    category: 'الوطن', source: 'محافظة الغابات', source_url: '', event_date: '2026-06-05',
  },
  {
    title: 'ارتفاع أسعار المحروقات عالمياً وتأثيره على الأسواق العربية',
    body: 'شهدت أسعار المحروقات ارتفاعاً ملحوظاً في الأسواق العالمية بسبب التوترات الجيوسياسية، مما أثر على أسعار النقل والسلع الأساسية في الأسواق العربية.',
    category: 'اقتصاد', source: 'وكالات', source_url: '', event_date: '2026-06-14',
  },
  {
    title: 'منتخب الجزائر يستعد لبطولة إفريقيا بتدريبات مكثفة',
    body: 'يواصل المنتخب الجزائري لكرة القدم تحضيراته لبطولة كأس الأمم الإفريقية بحصص تدريبية مكثفة تحت إشراف الجهاز الفني.',
    category: 'رياضة', source: 'الاتحاد الجزائري', source_url: '', event_date: '2026-06-13',
  },
  {
    title: 'الصين تطلق قمراً صناعياً جديداً لرصد الموارد الطبيعية',
    body: 'أطلقت الصين قمراً صناعياً جديداً لرصد الموارد الطبيعية من الفضاء، في إطار برنامجها الطموح لاستكشاف الفضاء والتطوير التكنولوجي.',
    category: 'إضاءات', source: 'وكالة شينخوا', source_url: '', event_date: '2026-06-15',
  },
  {
    title: 'أمريكا تكشف عن أول سيارة طائرة تجارية معتمدة',
    body: 'كشفت شركة أمريكية عن أول سيارة طائرة تجارية تحصل على موافقة هيئة الطيران الفيدرالية، مما يمثل نقلة نوعية في قطاع النقل.',
    category: 'إضاءات', source: 'وكالات', source_url: '', event_date: '2026-06-12',
  },
  {
    title: 'اليابان تبتكر بطارية ثورية تدوم 50 عاماً',
    body: 'طور باحثون يابانيون بطارية جديدة تعمل بالطاقة الذرية المصغرة يمكنها تزويد الأجهزة بالطاقة لمدة 50 عاماً دون شحن.',
    category: 'إضاءات', source: 'وكالة كيودو', source_url: '', event_date: '2026-06-14',
  },
  {
    title: 'مجلس الأمن يعقد جلسة طارئة بشأن المستجدات الدولية',
    body: 'عقد مجلس الأمن الدولي جلسة طارئة لبحث آخر المستجدات على الساحة الدولية، مع دعوات لخفض التصعيد والحوار الدبلوماسي.',
    category: 'العالم', source: 'الأمم المتحدة', source_url: '', event_date: '2026-06-15',
  },
  {
    title: 'حملة تطوعية لتنظيف الشواطئ بمشاركة شبابية واسعة',
    body: 'انطلقت حملة تطوعية كبرى لتنظيف الشواطئ بمشاركة آلاف الشباب من مختلف الجمعيات البيئية والمبادرات المدنية.',
    category: 'مجتمع', source: 'جمعيات بيئية', source_url: '', event_date: '2026-06-11',
  },
  {
    title: 'ندوة علمية حول فقه المعاملات المالية في الإسلام',
    body: 'نظمت كلية الشريعة ندوة علمية حول فقه المعاملات المالية المعاصرة في الإسلام، بمشاركة نخبة من العلماء والباحثين.',
    category: 'اسلاميات', source: 'جامعة الجزائر', source_url: '', event_date: '2026-06-10',
  },
  {
    title: 'انطلاق الموسم السياحي الصيفي: تنشيط الحركة السياحية بمنطقة تيارت',
    body: 'انطلقت فعاليات الموسم السياحي الصيفي بولاية تيارت، حيث تم تنظيم عدة برامج تنشيطية في المناطق السياحية.',
    category: 'الوطن', source: 'مديرية السياحة', source_url: '', event_date: '2026-06-01',
  },
  {
    title: 'لقاء تشاوري حول تحسين الخدمات الصحية في مستشفيات تيارت',
    body: 'عقدت مديرية الصحة والسكان لولاية تيارت لقاءً تشاورياً مع ممثلي المجتمع المدني ونقابات الصحة لمناقشة سبل تحسين الخدمات الصحية.',
    category: 'مجتمع', source: 'مديرية الصحة', source_url: '', event_date: '2026-06-03',
  },
  {
    title: 'حفل تكريم المتفوقين في المسابقات الثقافية والعلمية على مستوى ولاية تيارت',
    body: 'أقامت مديرية الثقافة والفنون لولاية تيارت حفلًا لتكريم المتفوقين في مختلف المسابقات الثقافية والعلمية على مستوى الولاية.',
    category: 'مجتمع', source: 'مديرية الثقافة', source_url: '', event_date: '2026-06-07',
  },
  {
    title: 'رأي: الاستثمار في العنصر البشري أساس التنمية المحلية بتيارت',
    body: 'تركز سياسات التنمية المحلية في ولاية تيارت على البنية التحتية والمشاريع التنموية، لكن يبقى الاستثمار في العنصر البشري هو الركيزة الأساسية لأي تنمية حقيقية ومستدامة.',
    category: 'رأي', source: 'الصوت المحلي', source_url: '', event_date: '2026-06-16',
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

  // -- المصادر المحلية (الوطن) --

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
        category: 'الوطن',
        source: 'أخبار دزاير - تيارت',
        source_url: $(el).find('.jeg_post_title a').attr('href') || '',
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
        category: 'الوطن',
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
        category: 'الوطن',
        source: 'الموقع',
        source_url: link || '',
        event_date: new Date().toISOString().split('T')[0],
      });
    });
    return items;
  }

  // -- RSS العام لمصادر دولية --

  async _scrapeRSS(url, category, sourceName) {
    const items = [];
    try {
      const res = await this._fetch(url, 15000);
      if (res.status !== 200) return items;
      const $ = cheerio.load(res.data, { xmlMode: true });
      $('item').each((i, el) => {
        if (i >= 8) return false;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const desc = $(el).find('description').text().replace(/<[^>]*>/g, '').trim();
        if (!title) return;
        items.push({
          title,
          body: desc || `مقال من ${sourceName}`,
          category,
          source: sourceName,
          source_url: link,
          event_date: new Date().toISOString().split('T')[0],
        });
      });
    } catch (e) {
      console.log(`  RSS ${sourceName}: ${e.message}`);
    }
    return items;
  }

  // -- سكاي نيوز (RSS رئيسي مع تصنيف حسب الرابط) --

  async _scrapeSkyNewsRSS() {
    const items = [];
    try {
      const res = await this._fetch('https://www.skynewsarabia.com/rss', 15000);
      if (res.status !== 200) return items;
      const $ = cheerio.load(res.data, { xmlMode: true });
      $('item').each((i, el) => {
        if (i >= 30) return false;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const desc = $(el).find('description').text().replace(/<[^>]*>/g, '').trim();
        if (!title) return;
        // تصنيف حسب مسار الرابط
        let category = 'العالم';
        if (link.includes('/sport/')) category = 'رياضة';
        else if (link.includes('/business/')) category = 'اقتصاد';
        else if (link.includes('/middle-east/')) category = 'العالم';
        else if (link.includes('/world/')) category = 'العالم';
        else if (link.includes('/varieties/')) category = 'مجتمع';
        items.push({
          title, body: desc || `مقال من سكاي نيوز: ${title}`,
          category, source: 'سكاي نيوز عربية', source_url: link,
          event_date: new Date().toISOString().split('T')[0],
        });
      });
    } catch (e) { console.log(`  سكاي نيوز RSS: ${e.message}`); }
    return items;
  }

  // -- الجزيرة نت (RSS رئيسي مع تصنيف من <category>) --

  async _scrapeAlJazeeraRSS() {
    const items = [];
    try {
      const res = await this._fetch('https://www.aljazeera.net/rss', 15000);
      if (res.status !== 200) return items;
      const $ = cheerio.load(res.data, { xmlMode: true });
      $('item').each((i, el) => {
        if (i >= 30) return false;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const desc = $(el).find('description').text().replace(/<[^>]*>/g, '').trim();
        const catTag = $(el).find('category').first().text().trim();
        if (!title) return;
        // تحويل تصنيف الجزيرة إلى تصنيفاتنا
        const catMap = {
          'اقتصاد': 'اقتصاد', 'رياضة': 'رياضة', 'تكنولوجيا': 'إضاءات',
          'سياسة': 'العالم', 'أخبار': 'العالم', 'فن': 'مجتمع',
          'منوعات': 'مجتمع',
        };
        const category = catMap[catTag] || 'العالم';
        items.push({
          title, body: desc || `مقال من الجزيرة: ${title}`,
          category, source: 'الجزيرة نت', source_url: link,
          event_date: new Date().toISOString().split('T')[0],
        });
      });
    } catch (e) { console.log(`  الجزيرة RSS: ${e.message}`); }
    return items;
  }

  _useSeed() {
    return SEED_ARTICLES.map(a => ({ ...a }));
  }

  async collectAll() {
    console.log('[Collector] بدء جمع البيانات من المصادر الحية...');
    const scrapers = [
      // محلية (الوطن)
      { name: 'أخبار دزاير', fn: () => this._scrapeAkhbarDzair() },
      { name: 'Ici l\'info', fn: () => this._scrapeIcilinfo() },
      { name: 'الموقع', fn: () => this._scrapeElmawkie() },
      // دولية
      { name: 'سكاي نيوز عربية', fn: () => this._scrapeSkyNewsRSS() },
      { name: 'الجزيرة نت', fn: () => this._scrapeAlJazeeraRSS() },
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
module.exports.SEED_ARTICLES = SEED_ARTICLES;
