const db = require('../database');
const { CATEGORIES, getAll, getLegacyMapping } = require('./categories');

const KNOWN_CATEGORIES = (() => {
  const names = new Set();
  for (const cat of getAll()) {
    names.add(cat.name);
    for (const old of cat.legacy || []) names.add(old);
  }
  return [...names];
})();

const CLASSIFIER = {
  الوطن: {
    strong: ['تيارت', 'ولاية', 'بلدية', 'مديرية', 'الجزائر', 'وزير'],
    medium: ['محافظة', 'مصالح', 'دائرة', 'مقاطعة', 'محلي', 'جهوي'],
    context: ['الوطن', 'الداخلية', 'الشؤون المحلية', 'الإدارة المحلية'],
  },
  اقتصاد: {
    strong: ['اقتصاد', 'أسعار', 'بورصة', 'دولار', 'نفط', 'بنك', 'استثمار'],
    medium: ['مالية', 'تجارة', 'شركة', 'سوق', 'ميزانية', 'ضرائب', 'أرباح'],
    context: ['تضخم', 'عملة', 'ذهب', 'ديون', 'تمويل', 'مشروع استثماري'],
  },
  رياضة: {
    strong: ['كرة القدم', 'بطولة', 'منتخب', 'رياضة', 'مباراة', 'نادي'],
    medium: ['لاعب', 'مدرب', 'ملعب', 'دوري', 'أولمبي', 'كأس'],
    context: ['هداف', 'حكم', 'جمهور', 'انتصار', 'هزيمة', 'تعادل'],
  },
  العالم: {
    strong: ['العالم', 'دولي', 'أمريكا', 'الصين', 'روسيا', 'أوروبا', 'الأمم المتحدة'],
    medium: ['خارجية', 'سفير', 'اتفاقية', 'مجلس الأمن', 'حلف', 'قمة'],
    context: ['عالمي', 'دبلوماسية', 'حدود', 'حرب', 'سلام', 'عقوبات'],
  },
  مجتمع: {
    strong: ['مجتمع', 'مواطن', 'متطوع', 'جمعية', 'حملة', 'تطوعي'],
    medium: ['أسرة', 'شباب', 'طفل', 'تعليم', 'صحة', 'بيئة', 'ثقافة'],
    context: ['مبادرة', 'توعية', 'تنمية', 'خدمات', 'اجتماعي', 'مدني'],
  },
  اسلاميات: {
    strong: ['إسلام', 'مسجد', 'قرآن', 'فتوى', 'الشريعة', 'عالم', 'داعية'],
    medium: ['صلاة', 'زكاة', 'حج', 'عمرة', 'رمضان', 'الحلال', 'الدين'],
    context: ['فقه', 'أحكام', 'فتاوى', 'دروس', 'محاضرة', 'وعظ'],
  },
  تكنولوجيا: {
    strong: ['تكنولوجيا', 'ذكاء اصطناعي', 'إنترنت', 'رقمي', 'ابتكار', 'اختراع'],
    medium: ['هاتف', 'تطبيق', 'برمجيات', 'شبكة', 'بيانات', 'حواسيب'],
    context: ['الفضاء', 'قمر صناعي', 'روبوت', 'طائرة', 'سيارة', 'طاقة'],
  },
};

class ContentAnalyzer {
  _preprocess(text) {
    if (!text) return '';
    // preserve Arabic letters/numbers, remove only ASCII punctuation
    return text
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _computeTextSimilarity(hash1, hash2) {
    if (!hash1 || !hash2) return 0;
    // bigram-based similarity for Arabic text
    const bigrams = (s) => {
      const b = new Set();
      for (let i = 0; i < s.length - 1; i++) b.add(s.substring(i, i + 2));
      return b;
    };
    const b1 = bigrams(hash1);
    const b2 = bigrams(hash2);
    if (b1.size === 0 || b2.size === 0) return 0;
    const intersection = new Set([...b1].filter(x => b2.has(x)));
    return intersection.size / Math.max(b1.size, b2.size);
  }

  _detectDuplicate(body, title) {
    if (!body) return { isDuplicate: false, similarity: 0 };

    const existing = db.query('processed_content');
    for (const item of existing) {
      const bodySim = this._computeTextSimilarity(body.slice(0, 200), (item.body || '').slice(0, 200));
      const titleSim = title && item.title ? this._computeTextSimilarity(title, item.title) : 0;
      const maxSim = Math.max(bodySim, titleSim);
      if (maxSim > 0.75) {
        return { isDuplicate: true, similarity: Math.round(maxSim * 100), existingId: item.id, existingTitle: item.title };
      }
    }
    return { isDuplicate: false, similarity: 0 };
  }

  classify(text) {
    const cleaned = this._preprocess(text);
    if (!cleaned) return { category: 'uncategorized', confidence: 0, scores: { news: 0, activity: 0, announcement: 0 } };

    const scores = { news: 0, activity: 0, announcement: 0 };

    for (const [cat, levels] of Object.entries(CLASSIFIER)) {
      // Strong keywords
      for (const word of levels.strong) {
        const regex = new RegExp(word, 'i');
        if (regex.test(cleaned)) scores[cat] += 0.25;
      }
      // Medium keywords
      for (const word of levels.medium) {
        const regex = new RegExp(word, 'i');
        if (regex.test(cleaned)) scores[cat] += 0.15;
      }
      // Context keywords
      for (const word of levels.context) {
        const regex = new RegExp(word, 'i');
        if (regex.test(cleaned)) scores[cat] += 0.10;
      }
    }

    const maxCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const maxScore = maxCat[1];

    let category;
    let confidence;

    if (maxScore >= 0.35) {
      category = maxCat[0];
      confidence = Math.min(maxScore * 0.8 + 0.3, 0.95);
    } else if (maxScore >= 0.15) {
      category = maxCat[0];
      confidence = Math.min(maxScore * 0.6 + 0.2, 0.6);
    } else {
      category = 'uncategorized';
      confidence = Math.min(maxScore, 0.3);
    }

    return { category, confidence: Math.round(confidence * 100) / 100, scores };
  }

  _detectUrgency(text) {
    const urgent = ['عاجل', 'هام', 'ضروري', 'تنبيه', 'مستعجل', 'فوري', 'آخر أجل', 'اليوم', 'غداً'];
    const count = urgent.filter(w => (text || '').includes(w)).length;
    if (count >= 2) return 1.0;
    if (count === 1) return 0.7;
    return 0.3;
  }

  factCheck(data) {
    let score = 0.5;
    const reasons = [];

    // المصدر
    if (data.source_url?.includes('education.gov.dz')) {
      score += 0.2;
      reasons.push('مصدر رسمي');
    } else if (data.source?.includes('فيسبوك') || data.source?.includes('facebook')) {
      score += 0.05;
      reasons.push('مصدر فيسبوك');
    }

    // التحقق من المرجع الجهوي (وجود مرجع منطقة تيارت يزيد الثقة)
    const regionalRefs = ['تيارت', 'ولاية', 'مديرية', 'بلدية', 'ولاية تيارت'];
    const refCount = regionalRefs.filter(r => (data.body || '').includes(r)).length;
    if (refCount >= 2) {
      score += 0.15;
      reasons.push('يحتوي مراجع جهوية');
    }

    // التحقق من التاريخ
    if (data.event_date) {
      const d = new Date(data.event_date);
      const now = new Date();
      const schoolStart = new Date('2023-09-01');
      if (d > now) {
        score -= 0.4;
        reasons.push('تاريخ مستقبلي');
      }
      if (d < schoolStart) {
        score -= 0.3;
        reasons.push('تاريخ قديم جداً');
      }
    }

    // التحقق من الجودة (طول المحتوى)
    if (data.body?.length > 150) {
      score += 0.1;
      reasons.push('محتوى مفصل');
    } else if (data.body?.length < 30) {
      score -= 0.15;
      reasons.push('محتوى قصير جدًا');
    }

    // التحقق من وجود أسماء أشخاص
    const teacherTitles = ['أستاذ', 'مدير', 'مستشار', 'ناظر', 'أستاذة', 'السيد', 'السيدة'];
    if (teacherTitles.some(t => (data.body || '').includes(t))) {
      score += 0.1;
      reasons.push('يحتوي أسماء شخصيات');
    }

    // معاقبة المحتوى المجرد من التفاصيل
    if ((data.body || '').length > 50 && (data.body || '').length < 100 && !data.event_date) {
      score -= 0.1;
      reasons.push('محتوى بدون تاريخ');
    }

    score = Math.max(0, Math.min(1, score));

    let verdict;
    if (score >= 0.8) verdict = 'موثوق ✓';
    else if (score >= 0.5) verdict = 'بحاجة مراجعة ⚠️';
    else verdict = 'مرفوض ✗';

    return {
      score: Math.round(score * 100) / 100,
      passed: score >= 0.5,
      verdict,
      reasons,
    };
  }

  _extractSummary(text) {
    if (!text) return '';
    const cleaned = text.replace(/\s+/g, ' ').trim();

    // استخراج الجملة الأولى ذات المعنى (أكثر من 15 كلمة)
    const sentences = cleaned.split(/[.،\n]/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 10) {
        return words.slice(0, 45).join(' ') + (words.length > 45 ? '...' : '');
      }
    }

    // fallback: أول 40 كلمة
    const words = cleaned.split(/\s+/);
    return words.slice(0, 40).join(' ') + (words.length > 40 ? '...' : '');
  }

  _getSourceTrust(sourceName) {
    const trustMap = {
      'ولاية تيارت': 0.95,
      'مديرية': 0.85,
      'محافظة': 0.85,
      'الصوت المحلي': 0.90,
      'صفحة فيسبوك': 0.70,
    };
    for (const [key, trust] of Object.entries(trustMap)) {
      if ((sourceName || '').includes(key)) return trust;
    }
    return 0.65;
  }

  async analyzeRawData(rawDataId) {
    const raw = db.get('raw_data', rawDataId);
    if (!raw) return null;

    let data;
    try { data = JSON.parse(raw.raw_text); } catch {
      data = { body: raw.raw_text, title: 'عنوان غير معروف', source: 'غير معروف' };
    }

    const body = data.body || '';

    // 0. إذا كان المصدر قد حدد التصنيف مسبقاً، نستخدمه مباشرة
    const presetCategory = data.category || '';
    const usePreset = presetCategory && KNOWN_CATEGORIES.includes(presetCategory);

    // 1. فحص التكرار
    const dupCheck = this._detectDuplicate(body, data.title);
    if (dupCheck.isDuplicate) {
      db.update('raw_data', rawDataId, { status: 'processed' });
      db.insert('ai_decision_log', {
        content_id: -1,
        decision_type: 'duplicate_rejected',
        input_data: JSON.stringify({ raw_id: rawDataId }),
        output_data: JSON.stringify(dupCheck),
        model_version: 'analyzer-v2',
        confidence: dupCheck.similarity / 100,
        human_reviewed: 0,
      });
      return { duplicate: true, ...dupCheck };
    }

    // 2. تصنيف المحتوى (نستخدم التصنيف المسبق إذا كان متاحاً)
    const classification = usePreset
      ? { category: presetCategory, confidence: 0.9, scores: {} }
      : this.classify(body);

    // 3. تدقيق الحقائق
    const factCheck = this.factCheck(data);

    // 4. كشف الإلحاح (عاجل/هام)
    const urgency = this._detectUrgency(body);

    // 5. ثقة المصدر
    const sourceTrust = this._getSourceTrust(data.source);

    // 6. النتيجة الإجمالية (وزن متوازن)
    const overall = Math.round(
      (classification.confidence * 0.25 +
       factCheck.score * 0.35 +
       sourceTrust * 0.25 +
       urgency * 0.15) * 100
    ) / 100;

    // 7. استخراج الملخص
    const summary = this._extractSummary(body);

    // 8. تحديد الحالة بناءً على الثقة الإجمالية
    let status;
    if (overall >= 0.8) status = 'draft'; // يمكن نشره تلقائيًا
    else if (overall >= 0.5) status = 'review'; // بحاجة مراجعة
    else if (overall >= 0.3) status = 'review'; // مراجعة مع تدقيق إضافي
    else status = 'rejected';

    // 9. تحديد مستوى الأهمية
    let importance;
    if (urgency >= 0.7 || (factCheck.score >= 0.8 && sourceTrust >= 0.8)) importance = 'high';
    else if (overall >= 0.5) importance = 'normal';
    else importance = 'low';

    const content = db.insert('processed_content', {
      raw_data_id: rawDataId,
      title: data.title || 'بدون عنوان',
      body: body,
      summary,
      category: classification.category,
      classification_score: classification.confidence,
      fact_check_score: factCheck.score,
      source_trust: sourceTrust,
      urgency_score: urgency,
      importance,
      overall_score: overall,
      status: status,
      source_url: data.source_url || '',
      source_name: data.source || '',
      event_date: data.event_date || null,
      image_url: data.image_url || '',
      image_data: data.image_data || '',
      expires_at: data.expires_at || null,
      visibility_status: 'active',
      is_ai_generated: 1,
      writer_version: null,
    });

    db.insert('ai_decision_log', {
      content_id: content.id,
      decision_type: 'classification',
      input_data: JSON.stringify({ text_sample: body.slice(0, 100) }),
      output_data: JSON.stringify({
        category: classification.category,
        confidence: classification.confidence,
        factCheck: factCheck,
        urgency: urgency,
        importance,
        duplicate_check: dupCheck,
        overall: overall,
      }),
      model_version: 'analyzer-v2',
      confidence: overall,
      human_reviewed: 0,
    });

    db.update('raw_data', rawDataId, { status: 'processed' });
    return { classification, factCheck, overall, summary, importance, duplicate: false };
  }
}

module.exports = new ContentAnalyzer();
