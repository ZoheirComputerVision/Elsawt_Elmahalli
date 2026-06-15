# سير عمل الذكاء الاصطناعي — جمع البيانات وتحليلها

## 1. 📡 جمع البيانات (Collect)

### التعريف
يجلب المقالات والإعلانات من المصادر المسجلة آلياً. يعمل الـ Collector على مسح المصادر في ملف `sources.json` وجلب المحتوى الجديد.

### المصادر الحالية
| المصدر | النوع | الرابط |
|---|---|---|
| صفحة أخبار تيارت الرسمية | إقليمي | Facebook TiaretNewsOfficial |
| موقع ولاية تيارت | رسمي | wilaya-tiaret.dz |
| إدخال يدوي | يدوي | - |

### مخرجات العملية
تخزّن البيانات في `data/raw_data.json` بحالة `pending`، مثال:

```json
{
  "id": 4,
  "source_id": 2,
  "raw_text": "{\"title\":\"...\",\"body\":\"...\",\"category\":\"news\",\"source\":\"مديرية الأشغال العمومية\",\"source_url\":\"https://www.wilaya-tiaret.dz/\",\"event_date\":\"2026-06-10\"}",
  "status": "pending",
  "created_at": "2026-06-14T16:40:14.611Z"
}
```

### زر "جمع البيانات" في لوحة التحكم
- **المسار:** `http://localhost:3000/admin/dashboard.html`
- **الاستدعاء:** `POST /api/admin/collect`
- **الاستجابة:** `{ success, collected, items }`

---

## 2. 🧠 تحليل (Analyze)

### التعريف
يشغل محرك التحليل الذكي (AI Analyzer) على البيانات الخام غير المعالجة. يأخذ أول 5 عناصر من `raw_data.json` بحالة `pending` ويقوم بـ:
- تصنيف المحتوى (خبر، نشاط، إعلان)
- تقييم مصداقية المصدر
- تقييم درجة الإلحاح والأهمية
- حساب درجة الثقة الإجمالية
- الكتابة الآلية للمقال (AI Writer)

### مخرجات العملية
تخزّن النتائج في `data/processed_content.json` بحالة `draft` أو `review`، مثال:

```json
{
  "id": 1,
  "raw_data_id": 1,
  "title": "افتتاح مشروع تهيئة الطريق الوطني رقم 14",
  "category": "news",
  "classification_score": 0.75,
  "fact_check_score": 0.6,
  "source_trust": 0.85,
  "importance": "high",
  "overall_score": 0.73,
  "status": "draft",
  "source_url": "https://www.wilaya-tiaret.dz/",
  "source_name": "مديرية الأشغال العمومية",
  "is_ai_generated": 1
}
```

### زر "تحليل" في لوحة التحكم
- **المسار:** `http://localhost:3000/admin/dashboard.html`
- **الاستدعاء:** `POST /api/admin/analyze`
- **الاستجابة:** `{ success, processed, results }`

---

## 3. 🔄 مثال كامل — دورة حياة مقال

```
[مصدر خارجي] 
    ↓
[1. جمع بيانات] ← تخزين في raw_data.json (status: pending)
    ↓
[2. تحليل] ← معالجة → تخزين في processed_content.json (status: draft)
    ↓
[3. نشر] ← تغيير الحالة إلى published
    ↓
[4. عرض] ← يظهر في الموقع عبر API /api/content
```

### مثال عملي

**المصدر:** موقع ولاية تيارت → `https://www.wilaya-tiaret.dz/`

```
جمع البيانات:
  → collector يزحف إلى الموقع
  → يجد خبر "افتتاح مشروع الطريق الوطني رقم 14"
  → يخزنه كـ raw_data (status: pending)

تحليل:
  → analyzer يصنف الخبر (category: news)
  → يقيم الثقة (source_trust: 0.85)
  → يحدد الأهمية (importance: high)
  → AI Writer يكتب المقال كاملاً
  → يخزنه كـ processed_content (status: draft)

نشر:
  → يُنشر المقال
  → يظهر على http://localhost:3000/
  → متاح عبر API: GET /api/content
```

---

## 4. ⚙️ الإعدادات المرتبطة (config.js)

```js
AI: {
  AUTO_PUBLISH_THRESHOLD: 0.8,    //阈值 للنشر التلقائي
  REVIEW_THRESHOLD: 0.5,          //阈值 للمراجعة البشرية
  MAX_DRAFT_AGE_HOURS: 72,        //صلاحية المسودة بالساعات
  COLLECTOR_INTERVAL_MIN: 30,     //دورة الجلب كل 30 دقيقة
  FACEBOOK_PAGE: 'TiaretNewsOfficial',
  MINISTRY_URL: 'https://www.wilaya-tiaret.dz/',
},
SAFETY: {
  STOP_AUTO_PUBLISH: false,       //إيقاف النشر التلقائي
  REQUIRE_HUMAN_REVIEW: false,    //إجبار المراجعة البشرية
  MAX_PUBLISH_PER_DAY: 20,        //حد النشر اليومي
}
```
