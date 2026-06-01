const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const DEMO_DATA = [
  {
    title: 'تنظيم يوم إعلامي حول التوجيه المدرسي لفائدة تلاميذ السنة الثالثة',
    body: 'نظمت ثانوية المجاهد خليل محمد - عين كرمس تيارت، يومًا إعلاميًا حول التوجيه المدرسي لفائدة تلاميذ السنة الثالثة ثانوي. أشرف على النشاط مستشار التوجيه والإرشاد المدرسي، حيث تم تقديم شروحات وافية حول كيفية اختيار التخصصات الجامعية. كما تم توزيع مطويات إرشادية تناولت مختلف الشعب والتخصصات المتاحة في الجامعات الجزائرية.',
    category: 'activity',
    source: 'صفحة الفيسبوك الرسمية',
    source_url: 'https://www.facebook.com/Mujahid56khallil.Mohammed26SecondarySchool.2023',
    event_date: '2026-05-20',
  },
  {
    title: 'إعلان عن فتح مسابقة توظيف أساتذة التعليم الثانوي في مختلف التخصصات',
    body: 'تعلن إدارة ثانوية المجاهد خليل محمد - عين كرمس تيارت، عن فتح مسابقة توظيف أساتذة التعليم الثانوي في مختلف التخصصات. على الراغبين في المشاركة تقديم ملفاتهم لدى إدارة الثانوية قبل تاريخ 15 يونيو 2026. الشروط المطلوبة: شهادة ليسانس أو ماستر في التخصص المطلوب، الخبرة في التدريس، الاستعداد للعمل في ولاية تيارت.',
    category: 'announcement',
    source: 'وزارة التربية الوطنية',
    source_url: 'https://www.education.gov.dz/',
    event_date: '2026-05-25',
  },
  {
    title: 'نتائج مسابقة القبول في الأقسام النموذجية: نسبة نجاح تتجاوز 85%',
    body: 'أعلنت وزارة التربية الوطنية عن نتائج مسابقة القبول في الأقسام النموذجية للسنة الدراسية 2026/2027. وحسب بيان الوزارة، فقد تحصل تلاميذ ثانوية المجاهد خليل محمد على نتائج مشرفة بنسبة نجاح تجاوزت 85%. وتتقدم إدارة الثانوية بالتهاني لجميع التلاميذ الناجحين وتتمنى لهم مسيرة دراسية موفقة.',
    category: 'news',
    source: 'وزارة التربية الوطنية',
    source_url: 'https://www.education.gov.dz/',
    event_date: '2026-05-22',
  },
  {
    title: 'زيارة ميدانية لمتحف المجاهد بولاية تيارت لترسيخ الهوية الوطنية',
    body: 'في إطار ترسيخ الهوية الوطنية والوعي التاريخي، نظّمت ثانوية المجاهد خليل محمد - عين كرمس تيارت، زيارة ميدانية لمتحف المجاهد لفائدة تلاميذ الأقسام النهائية. رافق التلاميذ خلال الزيارة أساتذة التاريخ والجغرافيا، حيث اطلعوا على مختلف مراحل الثورة التحريرية المجيدة وتعرفوا على تضحيات الشهداء.',
    category: 'activity',
    source: 'صفحة الفيسبوك الرسمية',
    source_url: 'https://www.facebook.com/Mujahid56khallil.Mohammed26SecondarySchool.2023',
    event_date: '2026-05-18',
  },
  {
    title: 'إعلان عن تنظيم أيام الأبواب المفتوحة للتعريف بالثانوية',
    body: 'تنظم إدارة ثانوية المجاهد خليل محمد - عين كرمس تيارت، أيام الأبواب المفتوحة لفائدة تلاميذ السنة الرابعة متوسط الراغبين في الالتحاق بالثانوية. يتضمن البرنامج زيارة مرافق الثانوية والاطلاع على الأقسام النموذجية، لقاءات مع الأساتذة والتعرف على النشاطات الثقافية والرياضية. ابتداء من 01 يونيو 2026.',
    category: 'announcement',
    source: 'صفحة الفيسبوك الرسمية',
    source_url: 'https://www.facebook.com/Mujahid56khallil.Mohammed26SecondarySchool.2023',
    event_date: '2026-06-01',
  },
  {
    title: 'لقاء تنسيقي بين إدارة الثانوية وأولياء التلاميذ لمناقشة النتائج',
    body: 'عقدت إدارة ثانوية المجاهد خليل محمد - عين كرمس تيارت، لقاءً تنسيقيًا مع أولياء التلاميذ لمناقشة الوضعية التربوية والنتائج الدراسية للفصل الثالث. تم خلال اللقاء استعراض الإجراءات المتخذة لتحسين المستوى التحصيلي للتلاميذ وبحث سبل تعزيز التعاون بين الأسرة والمدرسة.',
    category: 'activity',
    source: 'صفحة الفيسبوك الرسمية',
    source_url: 'https://www.facebook.com/Mujahid56khallil.Mohammed26SecondarySchool.2023',
    event_date: '2026-05-15',
  },
  {
    title: 'انطلاق امتحانات الفصل الثالث للسنة الدراسية 2025/2026',
    body: 'انطلقت بثانوية المجاهد خليل محمد - عين كرمس تيارت، امتحانات الفصل الثالث للسنة الدراسية 2025/2026. وقد أكدت إدارة الثانوية على جاهزية جميع الظروف لضمان سير الامتحانات في أحسن الظروف. متمنين لجميع التلاميذ التوفيق والنجاح.',
    category: 'news',
    source: 'إدارة الثانوية',
    source_url: '',
    event_date: '2026-05-28',
  },
  {
    title: 'حفل تكريم المتفوقين في المسابقات الثقافية على مستوى الولاية',
    body: 'أقامت ثانوية المجاهد خليل محمد - عين كرمس تيارت، حفلًا لتكريم التلاميذ المتفوقين في مختلف المسابقات الثقافية والعلمية على مستوى ولاية تيارت. وقد شهد الحفل حضور إدارة الثانوية وأولياء التلاميذ وأعضاء المجلس الشعبي البلدي.',
    category: 'activity',
    source: 'صفحة الفيسبوك الرسمية',
    source_url: 'https://www.facebook.com/Mujahid56khallil.Mohammed26SecondarySchool.2023',
    event_date: '2026-05-30',
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
      results.push(...await this.collectFacebook());
    } catch (e) {
      console.error('[Collector] Facebook error:', e.message);
    }
    try {
      results.push(...await this.collectMinistry());
    } catch (e) {
      console.error('[Collector] Ministry error:', e.message);
    }
    console.log(`[Collector] تم جمع ${results.length} عنصر جديد`);
    return results;
  }

  async collectFacebook() {
    if (!this._canFetch('facebook')) {
      console.log('[Collector] Facebook: تجاوز (فاصل زمني)');
      return [];
    }

    const source = db.findOne('sources', s => s.type === 'facebook');
    const items = [];

    for (const demo of DEMO_DATA.filter(d => d.source_url.includes('facebook'))) {
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

    this._markFetched('facebook');
    return items;
  }

  async collectMinistry() {
    if (!this._canFetch('ministry')) {
      console.log('[Collector] Ministry: تجاوز (فاصل زمني)');
      return [];
    }

    const source = db.findOne('sources', s => s.type === 'web');
    const items = [];

    for (const demo of DEMO_DATA.filter(d => d.source_url.includes('education.gov.dz') || !d.source_url)) {
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

    this._markFetched('ministry');
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
