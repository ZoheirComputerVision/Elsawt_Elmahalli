const CATEGORIES = [
  {
    id: 'local-news',
    name: 'الأخبار المحلية',
    slug: 'akbar-mahallia',
    icon: 'fa-newspaper',
    description: 'أخبار محلية يومية، قرارات بلدية، خدمات عمومية، متابعات مجلسية، بنية تحتية',
    priority: 1,
    legacy: ['الوطن'],
    keywords: ['تيارت', 'ولاية', 'بلدية', 'مديرية', 'محلي', 'جهوي', 'دائرة', 'مقاطعة'],
  },
  {
    id: 'development',
    name: 'التنمية المحلية',
    slug: 'tanmia',
    icon: 'fa-building',
    description: 'مشاريع تنموية، استثمار، إسكان، مياه، طرق، بيئة، مرافق عمومية',
    priority: 2,
    legacy: ['اقتصاد'],
    keywords: ['اقتصاد', 'استثمار', 'تنمية', 'مشروع', 'إسكان', 'طرق', 'مياه', 'بنية تحتية', 'تكنولوجيا', 'ابتكار'],
  },
  {
    id: 'community',
    name: 'المجتمع والحياة اليومية',
    slug: 'mogtamaa',
    icon: 'fa-users',
    description: 'شؤون المواطن، تعليم، صحة، مبادرات مجتمعية، شباب، نساء، قصص اجتماعية',
    priority: 3,
    legacy: ['مجتمع', 'اسلاميات'],
    keywords: ['مجتمع', 'مواطن', 'تعليم', 'صحة', 'شباب', 'أسرة', 'جمعية', 'تطوع', 'إسلام', 'مسجد'],
  },
  {
    id: 'events',
    name: 'النشاطات والفعاليات',
    slug: 'nashtatat',
    icon: 'fa-calendar-alt',
    description: 'فعاليات، معارض، مؤتمرات، مبادرات محلية، أنشطة مدرسية، تظاهرات عمومية',
    priority: 4,
    legacy: [],
    keywords: ['معرض', 'مؤتمر', 'فعالية', 'نشاط', 'تظاهرة', 'ملتقى', 'أيام دراسية'],
  },
  {
    id: 'culture',
    name: 'الثقافة والتراث',
    slug: 'thakafa',
    icon: 'fa-landmark',
    description: 'تراث محلي، تقاليد، تاريخ، فنون، أدب، تظاهرات ثقافية',
    priority: 5,
    legacy: [],
    keywords: ['ثقافة', 'تراث', 'تاريخ', 'فن', 'أدب', 'متحف', 'قصبة', 'تراثي', 'حرف'],
  },
  {
    id: 'sports',
    name: 'الرياضة المحلية',
    slug: 'riadia',
    icon: 'fa-trophy',
    description: 'أندية محلية، رياضة مدرسية، بطولات، إنجازات رياضية',
    priority: 6,
    legacy: ['رياضة'],
    keywords: ['رياضة', 'كرة القدم', 'نادي', 'ملعب', 'بطولة', 'دوري', 'منتخب', 'مباراة'],
  },
  {
    id: 'announcements',
    name: 'الإعلانات والإشعارات',
    slug: 'iilanat',
    icon: 'fa-bullhorn',
    description: 'إعلانات رسمية، إشعارات قانونية، مناقصات، توظيف، تنبيهات مجتمعية',
    priority: 7,
    legacy: [],
    keywords: ['إعلان', 'مناقصة', 'توظيف', 'إشعار', 'تنبيه', 'مزايدة', 'استدراج عروض'],
  },
  {
    id: 'profiles',
    name: 'وجوه وعبر',
    slug: 'wujouh',
    icon: 'fa-star',
    description: 'شخصيات محلية، قصص نجاح، مقابلات، تجارب ملهمة',
    priority: 8,
    legacy: [],
    keywords: ['شخصية', 'قصة نجاح', 'مقابلة', 'تجربة', 'ملهم', 'سيرة', 'مسيرة'],
  },
  {
    id: 'multimedia',
    name: 'الوسائط المتعددة',
    slug: 'wasait',
    icon: 'fa-camera',
    description: 'تقارير مصورة، فيديوهات، وثائقيات، محتوى صوتي، بودكاست',
    priority: 9,
    legacy: [],
    keywords: ['صورة', 'فيديو', 'وثائقي', 'بودكاست', 'تقرير مصور', 'ألبوم', 'معرض صور'],
  },
  {
    id: 'archive',
    name: 'الأرشيف',
    slug: 'archive',
    icon: 'fa-archive',
    description: 'أرشيف المحتوى التاريخي — حسب التاريخ، السنة، التصنيف، الكلمات المفتاحية',
    priority: 10,
    legacy: [],
    keywords: [],
  },
];

const CATEGORY_MAP = {};
for (const cat of CATEGORIES) {
  CATEGORY_MAP[cat.name] = cat;
  CATEGORY_MAP[cat.slug] = cat;
  CATEGORY_MAP[cat.id] = cat;
  for (const old of cat.legacy) {
    CATEGORY_MAP[old] = cat;
  }
}

function getAll() {
  return [...CATEGORIES];
}

function getBySlug(slug) {
  return CATEGORIES.find(c => c.slug === slug) || null;
}

function getById(id) {
  return CATEGORIES.find(c => c.id === id) || null;
}

function getByName(name) {
  return CATEGORIES.find(c => c.name === name) || null;
}

function getPriority(slugOrName) {
  const cat = CATEGORY_MAP[slugOrName];
  return cat ? cat.priority : 99;
}

function sortByPriority(items, categoryField = 'category') {
  return [...items].sort((a, b) => {
    const pa = getPriority(a[categoryField]);
    const pb = getPriority(b[categoryField]);
    return pa - pb;
  });
}

function resolve(categoryName) {
  if (!categoryName) return null;
  const exact = CATEGORY_MAP[categoryName];
  if (exact) return exact;
  const fuzzy = CATEGORIES.find(c =>
    c.name === categoryName || c.slug === categoryName || c.id === categoryName || c.legacy.includes(categoryName)
  );
  return fuzzy || null;
}

function isLegacy(categoryName) {
  const cat = resolve(categoryName);
  if (!cat) return false;
  return cat.legacy.includes(categoryName);
}

function getLegacyMapping() {
  const map = {};
  for (const cat of CATEGORIES) {
    for (const old of cat.legacy) {
      map[old] = cat.name;
    }
  }
  return map;
}

module.exports = {
  CATEGORIES,
  CATEGORY_MAP,
  getAll,
  getBySlug,
  getById,
  getByName,
  getPriority,
  sortByPriority,
  resolve,
  isLegacy,
  getLegacyMapping,
};
