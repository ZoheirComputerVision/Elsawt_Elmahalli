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

## النواقص / ملاحظات
- لا توجد نواقص معروفة
