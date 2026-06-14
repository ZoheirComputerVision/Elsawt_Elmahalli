const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const DEMO_DATA = [
  {
    title: 'افتتاح مشروع تهيئة الطريق الوطني رقم 14 الرابط بين تيارت وتسمسيلت',
    body: 'أشرفت السلطات الولائية لتيارت على افتتاح أشغال تهيئة الطريق الوطني رقم 14 الرابط بين ولايتي تيارت وتسمسيلت. المشروع الذي تبلغ ميزانيته أكثر من 2 مليار دينار جزائري سيساهم في تسهيل حركة المرور وتقليل حوادث السير. من المتوقع أن تستمر الأشغال لمدة 18 شهراً.',
    category: 'news',
    source: 'مديرية الأشغال العمومية',
    source_url: 'https://www.wilaya-tiaret.dz/',
    event_date: '2026-06-10',
  },
  {
    title: 'إعلان عن فتح باب الترشح للمجلس الشعبي البلدي لبلديات ولاية تيارت',
    body: 'تعلن مديرية الإدارة المحلية لولاية تيارت عن فتح باب الترشح لعضوية المجالس الشعبية البلدية في مختلف بلديات الولاية. على الراغبين في الترشح تقديم ملفاتهم لدى بلدياتهم الأصلية قبل تاريخ 20 يوليو 2026. الشروط المطلوبة: أن يكون المترشح جزائري الجنسية، بالغ من العمر 23 سنة على الأقل، وأن يقدم ملفاً كاملاً وفقاً للقانون العضوي للانتخابات.',
    category: 'announcement',
    source: 'مديرية الإدارة المحلية',
    source_url: 'https://www.wilaya-tiaret.dz/',
    event_date: '2026-06-12',
  },
  {
    title: 'حملة التشجير الكبرى: غرس أكثر من 5000 شتلة في مختلف بلديات تيارت',
    body: 'أطلقت محافظة الغابات لولاية تيارت حملة تشجير كبرى بمناسبة اليوم العالمي للبيئة، حيث تم غرس أكثر من 5000 شتلة من مختلف الأصناف عبر بلديات الولاية. شارك في الحملة متطوعون من الجمعيات البيئية والكشافة الإسلامية الجزائرية ومختلف الفاعلين في المجتمع المدني. تهدف الحملة إلى مكافحة التصحر وتحسين الغطاء النباتي بالمنطقة.',
    category: 'activity',
    source: 'محافظة الغابات',
    source_url: 'https://www.wilaya-tiaret.dz/',
    event_date: '2026-06-05',
  },
  {
    title: 'زيارة ميدانية لمتحف المجاهد بولاية تيارت لترسيخ الهوية الوطنية',
    body: 'في إطار ترسيخ الهوية الوطنية والوعي التاريخي، نظّمت مديرية المجاهدين لولاية تيارت زيارة ميدانية لمتحف المجاهد لفائدة طلاب المؤسسات التربوية والجامعية. رافق الوفد خلال الزيارة مؤرخون وباحثون، حيث اطلعوا على مختلف مراحل الثورة التحريرية المجيدة وتعرفوا على تضحيات الشهداء والشخصيات التاريخية للمنطقة.',
    category: 'activity',
    source: 'مديرية المجاهدين',
    source_url: '',
    event_date: '2026-06-08',
  },
  {
    title: 'إعلان عن انطلاق الموسم الفلاحي الجديد: توزيع الأسمدة والبذور المدعمة',
    body: 'تعلن مديرية المصالح الفلاحية لولاية تيارت عن انطلاق الموسم الفلاحي الجديد 2026/2027 وتوزيع الأسمدة والبذور المدعمة على الفلاحين. على الفلاحين الراغبين في الاستفادة التوجه إلى المصالح الفلاحية الدائرية مع ملفاتهم. تشمل العملية مختلف بلديات الولاية وخاصة المناطق الفلاحية الكبرى.',
    category: 'announcement',
    source: 'مديرية المصالح الفلاحية',
    source_url: '',
    event_date: '2026-06-15',
  },
  {
    title: 'لقاء تشاوري حول تحسين الخدمات الصحية في مستشفيات تيارت',
    body: 'عقدت مديرية الصحة والسكان لولاية تيارت لقاءً تشاورياً مع ممثلي المجتمع المدني ونقابات الصحة لمناقشة سبل تحسين الخدمات الصحية في مختلف المؤسسات الاستشفائية بالولاية. تم خلال اللقاء استعراض الإجراءات المتخذة لتقليل أوقات الانتظار وتحسين جودة الرعاية الصحية وتوفير الأدوية الأساسية.',
    category: 'activity',
    source: 'مديرية الصحة',
    source_url: '',
    event_date: '2026-06-03',
  },
  {
    title: 'انطلاق الموسم السياحي الصيفي: تنشيط الحركة السياحية بمنطقة تيارت',
    body: 'انطلقت فعاليات الموسم السياحي الصيفي بولاية تيارت، حيث تم تنظيم عدة برامج تنشيطية في المناطق السياحية كمنطقة تغنيف وغابة العابد وسد بني هارون. أكدت مديرية السياحة على جاهزية جميع المرافق والهياكل السياحية لاستقبال الزوار طيلة فصل الصيف.',
    category: 'news',
    source: 'مديرية السياحة',
    source_url: '',
    event_date: '2026-06-01',
  },
  {
    title: 'حفل تكريم المتفوقين في المسابقات الثقافية والعلمية على مستوى ولاية تيارت',
    body: 'أقامت مديرية الثقافة والفنون لولاية تيارت حفلًا لتكريم المتفوقين في مختلف المسابقات الثقافية والعلمية على مستوى الولاية. وقد شهد الحفل حضور السلطات المحلية وممثلي المجتمع المدني وأولياء المكرمين. تضمن الحفل فقرات فنية وثقافية متنوعة.',
    category: 'activity',
    source: 'مديرية الثقافة',
    source_url: '',
    event_date: '2026-06-07',
  },
];

class DataCollector {
  constructor() {
    this.lastFetch = {};
    this.minInterval = 15 * 60 * 1000; // 15 دقيقة بين الجمع
  }

  _canFetch(source) {
    const last = this.lastFetch[source];
    if (!last) return true;
    return (Date.now() - last) >= this.minInterval;
  }

  _markFetched(source) {
    this.lastFetch[source] = Date.now();
  }

  async collectAll() {
    console.log('[Collector] بدء جمع البيانات...');
    const results = [];
    try {
      results.push(...await this.collectRegional());
    } catch (e) {
      console.error('[Collector] Regional error:', e.message);
    }
    try {
      results.push(...await this.collectOfficial());
    } catch (e) {
      console.error('[Collector] Official error:', e.message);
    }
    console.log(`[Collector] تم جمع ${results.length} عنصر جديد`);
    return results;
  }

  async collectRegional() {
    if (!this._canFetch('regional')) {
      console.log('[Collector] Regional: تجاوز (فاصل زمني)');
      return [];
    }

    const source = db.findOne('sources', s => s.type === 'regional');
    const items = [];

    for (const demo of DEMO_DATA.filter(d => d.source_url.includes('wilaya-tiaret'))) {
      const hash = uuidv4().replace(/-/g, '').slice(0, 16);
      const existing = db.findOne('raw_data', r => r.content_hash === hash || r.raw_text.includes(demo.title));
      if (!existing) {
        db.insert('raw_data', {
          source_id: source?.id || 1,
          raw_text: JSON.stringify(demo),
          content_hash: hash,
          status: 'pending',
        });
        items.push({ ...demo, hash });
      }
    }

    if (source) {
      db.update('sources', source.id, { last_scraped: new Date().toISOString() });
    }

    this._markFetched('regional');
    return items;
  }

  async collectOfficial() {
    if (!this._canFetch('official')) {
      console.log('[Collector] Official: تجاوز (فاصل زمني)');
      return [];
    }

    const source = db.findOne('sources', s => s.type === 'official');
    const items = [];

    for (const demo of DEMO_DATA.filter(d => !d.source_url.includes('wilaya-tiaret') || !d.source_url)) {
      const hash = uuidv4().replace(/-/g, '').slice(0, 16);
      const existing = db.findOne('raw_data', r => r.content_hash === hash || r.raw_text.includes(demo.title));
      if (!existing) {
        db.insert('raw_data', {
          source_id: source?.id || 2,
          raw_text: JSON.stringify(demo),
          content_hash: hash,
          status: 'pending',
        });
        items.push({ ...demo, hash });
      }
    }

    if (source) {
      db.update('sources', source.id, { last_scraped: new Date().toISOString() });
    }

    this._markFetched('official');
    return items;
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
