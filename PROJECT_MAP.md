# الصوت المحلي — نشرية جهوية للإعلام العام

## TECH_STACK
| الطبقة | التقنية | الإصدار |
|--------|---------|---------|
| Framework | Express.js | 4.18.2 |
| Database | JSON-based (custom JsonDB) | — |
| Security | helmet + cors | 7.1.0 / 2.8.5 |
| Logging | morgan | 1.10.0 |
| Cron | node-cron | 3.0.3 |
| UUID | uuid | 9.0.0 |

## SYSTEM_FLOW
```
[Boot] → server.js → mount routes → init modules → start cron
                          ↓
                JSON DB ← collector (30min)
                          ↓
                analyzer (15min) → classification + fact-check
                          ↓
                writer → AI article generation
                          ↓
                publisher (10min) → quality check → publish/archive
                          ↓
                public/ ← static HTML + client-side JS
                admin/  ← dashboard + review + logs + settings
```

## ROUTES
| المسار | الوظيفة |
|--------|---------|
| `GET /` | الصفحة الرئيسية |
| `GET /news.html` | الأخبار الجهوية |
| `GET /activities.html` | النشاطات |
| `GET /announcements.html` | الإعلانات الرسمية |
| `GET /article/:id` | عرض مقال |
| `GET /media.html` | المكتبة |
| `GET /archive.html` | الأرشيف الكامل |
| `GET /timeline.html` | الأرشفة الزمنية |
| `GET /admin` | لوحة التحكم (تسجيل الدخول) |
| `GET /api/content` | محتوى (JSON) |
| `GET /api/stats` | إحصائيات النظام |
| `GET /api/search` | بحث في المحتوى |
| `POST /api/admin/auth` | مصادقة المدير |

## PUBLIC PAGES NAVIGATION
جميع صفحات HTML العامة تحتوي على شريط تنقل موحد يتضمن:
- 🏠 الرئيسية
- 🌐 **خدمات وإعلانات** (قائمة منسدلة):
  - 🏛 ولاية تيارت → `wilaya-tiaret.dz`
  - 📜 وزارة الداخلية → `interieur.gov.dz`
- 📰 الأخبار
- 📸 النشاطات
- 📢 الإعلانات
- 🖼️ المكتبة
- 📅 الأرشفة الزمنية
- 📂 الأرشيف

## COMPLETED MILESTONES
- [x] Express server + JSON DB
- [x] AI pipeline: collector → analyzer → writer → publisher → archiver
- [x] Public SPA-like frontend (8 HTML pages + CSS + JS)
- [x] Admin panel (dashboard, review, logs, settings)
- [x] Cron scheduler (auto collect/analyze/publish)
- [x] Security: helmet + CORS + admin auth
- [x] مستضاف على GitHub: `github.com/ZoheirComputerVision/Elsawt_Elmahalli`

## ORPHANS & PENDING
| البند | الحالة | الأولوية |
|-------|--------|----------|
| قاعدة بيانات SQLite جاهزة (غير مستعملة) | قائمة | منخفضة |
| اختبارات (unit/integration) | غير موجودة | متوسطة |
| HTTPS/SSL | غير مضبوط | منخفضة |
| لا CSRF protection | موجود مسبقاً | عالية |
| لا Rate Limiting | موجود مسبقاً | متوسطة |
