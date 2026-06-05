# PROJECT_MAP - الجريدة المدرسية الذكية

## هيكل المشروع
```
school-news-ai/
├── server.js                 # نقطة الدخول الرئيسية (Express)
├── config.js                 # الإعدادات
├── database.js               # اتصال SQLite
├── package.json
├── admin/                    # واجهة الإدارة
│   ├── index.html            # صفحة تسجيل الدخول
│   ├── dashboard.html        # لوحة القيادة
│   ├── review.html           # مراجعة المحتوى
│   ├── logs.html             # سجل AI
│   └── settings.html         # الإعدادات
├── modules/                  # وحدات النظام
│   ├── collector.js          # جمع البيانات
│   ├── analyzer.js           # تحليل AI
│   ├── publisher.js          # نشر تلقائي
│   ├── writer.js             # كتابة AI
│   ├── scheduler.js          # جدولة المهام
│   ├── archiver.js           # الأرشفة
│   ├── fb_reply.js           # الرد على فيسبوك (مشاركة/تعليق)
│   └── seed.js               # بيانات افتراضية
├── routes/
│   ├── api.js                # API endpoints
│   └── admin.js              # Admin API
├── public/                   # الواجهة الأمامية
│   ├── index.html            # الصفحة الرئيسية
│   ├── news.html             # صفحة الأخبار
│   ├── activities.html       # صفحة النشاطات
│   ├── announcements.html    # صفحة الإعلانات
│   ├── timeline.html         # الأرشفة الزمنية
│   ├── archive.html          # الأرشيف
│   ├── media.html            # مكتبة الصور
│   ├── article.html          # عرض مقال
│   ├── css/style.css         # التنسيقات
│   └── js/
│       ├── main.js           # منطق الواجهة
│       └── api.js            # عميل API
└── data/                     # بيانات و SQLite
```

## شريط التنقل (Nav)
- **الرئيسية** (`/`)
- **فضاءات وخدمات رقمية** (dropdown with sections)
  - 👤 فضاء الأولياء → https://awlyaa.education.dz/
  - 👨‍🏫 فضاء الأساتذة → https://ostad.education.dz/auth
  - ─── 🏆 المسابقات ───
  - المسابقات → https://tawdif.education.dz/
  - ─── 📚 التعليم عن بعد ───
  - 📝 التسجيل للتعليم والتكوين عن بعد → http://inscriptic.onefd.edu.dz/
  - 📜 استخراج شهادة إثبات المستوى → https://www.onefd.edu.dz/att_niv_2024/
  - ─── 📝 التسجيل في إمتحان ───
  - 🎓 إمتحان شهادة البكالوريا → https://bac.onec.dz/
  - 📖 إمتحان شهادة التعليم المتوسط → https://bem.onec.dz/
- الأخبار (`/news.html`)
- النشاطات (`/activities.html`)
- الإعلانات (`/announcements.html`)
- المكتبة (`/media.html`)
- الأرشفة الزمنية (`/timeline.html`)
- الأرشيف (`/archive.html`)

## التعديلات الأخيرة
| التاريخ | التعديل | الملفات المتأثرة |
|---------|---------|-----------------|
| 2026-06-05 | إضافة قسم "فضاءات وخدمات رقمية" مع قائمة منسدلة تحتوي على فضاء الأولياء وفضاء الأساتذة | `public/css/style.css`, `public/*.html` (8 صفحات) |
| 2026-06-05 | توسعة قائمة "فضاءات وخدمات رقمية": إضافة أقسام المسابقات، التعليم عن بعد، التسجيل في إمتحان (5 روابط جديدة) + إصلاح ثغرة `rel="noopener noreferrer"` | `public/css/style.css`, `public/*.html` (8 صفحات) |
| 2026-06-05 | إصلاح القائمة المنسدلة للشاشات الضيقة + RTL: إضافة Click Toggle via JS، ضبط positioning لعدم تجاوز الشاشة | `public/css/style.css`, `public/js/main.js` |
| 2026-06-05 | **إصلاح القائمة للجوال نهائياً**: position:fixed + touch-action + scroll listener | `public/css/style.css`, `public/js/main.js` |
| 2026-06-05 | **ميزة الرد على فيسبوك**: مشاركة/تعليق المقالات على صفحة الثانوية في فيسبوك تلقائياً أو يدوياً | `modules/fb_reply.js` (جديد), `config.js`, `database.js`, `routes/admin.js`, `modules/publisher.js`, `public/js/api.js` |
| 2026-06-05 | **واجهة إدارة فيسبوك**: إضافة أزرار مشاركة وتعليق فيسبوك في لوحة التحكم مع إعدادات وإحصائيات | `admin/settings.html`, `admin/review.html`, `admin/dashboard.html` |

## إعدادات فيسبوك (جديدة)
| المفتاح | القيمة الافتراضية | الوصف |
|---------|-------------------|-------|
| `fb_page_access_token` | `''` | رمز وصول API لصفحة فيسبوك (من Graph API) |
| `fb_auto_reply` | `'false'` | تفعيل المشاركة/الرد التلقائي على فيسبوك بعد نشر مقال |

## قاعدة بيانات الردود على فيسبوك
| الجدول | الوصف |
|--------|-------|
| `fb_replies` | سجل جميع الردود والمشاركات على فيسبوك (content_id, reply_type, status, response_data) |

## النواقص / ملاحظات
- Facebook Graph API يتطلب رمز وصول حقيقي (`fb_page_access_token`) ليتم النشر الفعلي — حالياً يعمل في وضع المحاكاة (Simulation Mode)
- رمز الوصول يحتاج صلاحية `pages_manage_posts` أو `pages_read_engagement`
- تمت إضافة واجهة إدارة كاملة للفيسبوك: إعدادات (settings.html)، أزرار مشاركة/تعليق (review.html)، إحصائيات (dashboard.html)، سجل ردود (جميع الصفحات)
- يفضّل مراجعة إعدادات فيسبوك بعد الحصول على الرمز الحقيقي عبر صفحة الإعدادات
