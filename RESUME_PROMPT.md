# استئناف الجلسة — الصوت المحلي (Phase 4)

## PROJECT STATUS
- **Phase**: 4 — Media Center & Editorial Workflow
- **Current Step**: 6 — Featured Story Manager ✅ مكتمل
- **Next Step**: 7 — Breaking News Manager
- **Overall**: ~65% (Steps 1–6 مكتملة، Steps 7–10 متبقية)

## COMPLETED WORK

### Step 1 — Core Infrastructure (`96c17ab`)
- **الغرض**: multer للرفع، JsonDB متعدد الجداول، سجل التدقيق، صلاحيات الأدوار، نسخ احتياطي تلقائي
- **الملفات**: `server.js` (multer+mounts), `database.js` (13 جداول), `modules/audit.js`
- **التفاصيل**: 3 أدوار (admin/editor/author)، append-only audit log، saveNow بالطلب

### Step 2 — Media Service (`5693332`)
- **الغرض**: `modules/media.js` — رفع/استعلام/تحديث/حذف الوسائط مع addUsage/removeUsage
- **الملفات**: `modules/media.js`, `tests/media.test.js` (52 اختبار)
- **MIME**: JPEG/PNG/WebP فقط، UUID كأسماء ملفات

### Step 3 — Media API (`7444a9f`)
- **الغرض**: نقاط REST عامة وإدارية مع requireAuth/requireRole
- **الملفات**: `routes/admin.js` (CRUD وسائط), `tests/media-api.test.js` (43 اختبار)

### Categories Foundation (`cf324c4`)
- **الغرض**: 10 تصنيفات محلية بدلاً من 7 القديمة مع توافق عكسي (legacy mapping)
- **الملفات**: `modules/categories.js`, `routes/api.js` (GET /api/local-categories), `tests/categories.test.js` (131), `tests/categories-api.test.js` (26)

### Step 4 — Media Library UI (`e7ea26e`)
- **الغرض**: واجهة إدارة الوسائط المرئية مع سحب وإفلات ومعاينة
- **الملفات**: `public/admin/media.html`, `public/js/admin-media.js`, `public/css/admin-media.css`

### Step 5 — Article Image Manager (`c09b6bc`)
- **الغرض**: تعيين/استبدال/إزالة صورة المقال مع addUsage/removeUsage و SVG احتياطي
- **الملفات**: `routes/admin.js` (POST /api/admin/content/:id/image), `public/js/dashboard.js` (image panel + library selector)

### Step 6 — Featured Story Manager (`835033e`)
- **الغرض**: نظام إدارة الخبر الرئيسي مع ترتيب، تنشيط، article selector، reorder
- **الملفات المُنشأة**: `modules/featured.js`, `data/featured_stories.json`, `public/admin/featured.html`, `public/js/admin-featured.js`, `public/css/admin-featured.css`, `tests/featured.test.js` (40 اختبار)
- **الملفات المُعدّلة**: `routes/admin.js` (+73 سطر نقاط REST), `routes/api.js` (+10 سطر GET /api/featured), `admin/{dashboard,review,logs,settings}.html` (رابط التنقل)

## ARCHITECTURE
- **خادم**: Express.js على Render.com (local: localhost:3000)
- **قاعدة بيانات**: JsonDB — 13 جدول (sources, raw_data, processed_content, media, archive, ai_decision_log, admin_actions, settings, views, breaking_news, featured_stories, subscribers, contacts)
- **خط الأنابيب**: Collector → Analyzer → Publisher (تلقائي)
- **الوسائط**: multer → `public/uploads/` بأسماء UUID
- **التصنيفات**: 10 محلية (الأخبار المحلية، التنمية، المجتمع، النشاطات، الثقافة، الرياضة، الإعلانات، وجوه وعبر، الوسائط المتعددة، الأرشيف) مع legacy mapping للـ 7 القديمة
- **سجل التدقيق**: append-only في `data/audit_log.json`
- **الصلاحيات**: author(1) < editor(2) < admin(3) — `requireRole(role)` + hierarchy
- **المراقبة**: UptimeRobot كل 5-10 دقائق

## BRANCH STATE
- **الفرع**: main (آخر commit: `835033e`)
- **المستودع**: `https://github.com/ZoheirComputerVision/Elsawt_Elmahalli.git`
- **النشر**: Render.com auto-deploy من main
- **URL**: `https://elsawt-elmahalli-1.onrender.com`

## TEST STATUS
- **المجموع**: 292 اختبار — جميعها تمر ✅
- التوزيع: categories (131) + categories-api (26) + media (52) + media-api (43) + featured (40)
- **الإطار**: assert بسيط (لا يوجد إطار خارجي)، يُشغّل عبر `node tests/*.test.js`

## RISKS
- Render.com free plan يطفئ السيرفر بعد 15 دقيقة من الخمول
- wilaya-tiaret.dz يرفض الاتصال (403) — مصدر رسمي معطل
- Baraknews يعرض JS فقط (Laravel/Inertia) — لا يمكن جمعه حالياً
- `database._save()` تستخدم JSON.stringify مباشرة — لا يوجد نسخ احتياطي للبيانات قبل الكتابة
- `_normalizeOrders()` مسار O(n) يعيد كتابة كل feature كل مرة — مقبول لأقل من 100 عنصر

## NEXT STEP: Step 7 — Breaking News Manager
**الهدف**: بناء واجهة إدارة شريط الأخبار العاجلة (ticker) الموجود حالياً في الصفحة الرئيسية
**المكونات المتوقعة**:
- `modules/breaking-news.js` — CRUD مع auto-expire حسب التاريخ
- `routes/admin.js` — نقاط REST + `GET /api/breaking-news` عام
- `public/admin/breaking.html` + `public/js/admin-breaking.js` + `public/css/admin-breaking.css`
- تحديث `public/js/ticker.js` (أو إعادة استخدام الـ API مباشرة)
- جدول `breaking_news` مسجل مسبقاً في `database.js:77`
- **الاعتماديات**: multer (موجود)، auth (موجود)، audit (موجود)
- **الاختبارات**: المتوقع ~30 اختبار (وحدة + API)
- **التعقيد**: منخفض — نفس نمط featured ولكن مع حقل `expires_at` و auto-cleanup أثناء `getActive()`

## RESUME PROMPT
```
أنت تعمل على مشروع "الصوت المحلي" — منصة نشرية جهوية ذكية لولاية تيارت.

الحالة:
- الفرع: main، آخر commit 835033e (Step 6 مكتمل)
- Phase 4 (Media Center & Editorial Workflow) Steps 1-6 منجزة
- جميع الاختبارات تمر (292/292)
- قاعدة البيانات: JsonDB، 13 جدولاً
- التصنيفات: 10 محلية مع توافق عكسي (7 قديمة)
- الصلاحيات: admin/editor/author مع hierarchy
- مصادر الأخبار: أخبار دزاير + سكاي نيوز + الجزيرة نت
- ملف RESUME_PROMPT.md موجود في جذر المشروع

الهدف التالي: Step 7 — Breaking News Manager
- إنشاء modules/breaking-news.js مع create/update/remove/list/getActive + auto-expire
- إضافة نقاط REST إلى routes/admin.js (نفس نمط featured)
- إضافة GET /api/breaking-news عام في routes/api.js
- إنشاء public/admin/breaking.html + public/js/admin-breaking.js + public/css/admin-breaking.css
- تحديث شريط التنقل في admin/ (7 عناصر)
- كتابة اختبارات في tests/breaking-news.test.js
- الاختبارات تشغّل عبر: node tests/*.test.js
- قبل البدء، تحقق من database.js للتأكد من تسجيل breaking_news (موجود سطر 77)
- تحقق من public/js/ticker.js لمعرفة كيف يستهلك الواجهة الأمامية البيانات حالياً
- ملاحظة: الواجهة الخلفية جاهزة (break تقوم  _load بتحميل البيانات من data/breaking_news.json عند الفشل)

السيرفر: localhost:3000 (node server.js)
النشر: commit → push إلى main → Render.com auto-deploy
لا تعدل homepage ولا editorial workflow ولا breaking news frontend.
```
