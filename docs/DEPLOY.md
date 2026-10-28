# دليل نشر المشروع على الإنترنت (Deploy Guide)

هذا المشروع **Node/Express + MySQL + واجهة Vanilla JS**. كنت لحد الآن تشتغّله **محليًا**
(XAMPP + `localhost:3000` + `localhost:5500`). عشان يصير **موقعًا حيًا** يفتحه أي أحد،
لازم نرفعه على سيرفر دائم بالإنترنت. هذا الملف يشرح الطريق بأسهل منصّة.

> جاهزية الكود: الكود صار **خدمة واحدة برابط واحد** — Express يقدّم الواجهة (`client/`)
> + الـ API معًا. يعني ما بدك تستضيف الواجهة بمكان منفصل ولا تفعّل CORS. العنوان بالواجهة
> بيصير نسبيًا `/api` تلقائيًا لما تكون مستضافة على نفس الرابط.

---

## ⚠️ قبل أي شي — الأمان (مهم جدًا لمشروع عام)
1. **غيّر كلمة مرور `admin`**: صفحة الدخول تعرض حسابات تجريبية بكلمات سرّها (`Admin@123`...).
   لما الموقع يصير عام، أي أحد يقدر يدخل كـ مدير. غيّر كلمات المرور من شاشة *المستخدمون* بعد النشر.
2. **لا ترفع ملف `.env`**: هو مستثنى بـ `.gitignore` (مرفوع بأمان؟ لا — لازم يكون **غير مرفوع**).
   بيانات القاعدة و`JWT_SECRET` تتحط كمتغيّرات بيئة على المنصّة، مش بالكود.
3. **`JWT_SECRET` قوي**: استعمل سلسلة عشوائية طويلة (مو `secret123`).
4. الخطة مجانية على بعض المنصّات بتطلب **بطاقة للتحقق** حتى لو بدون خصم.

---

## الخيار الموصّى: Railway (أسهل شي مع MySQL)
Railway بيعمل قاعدة MySQL بضغطة، وما بيطلب إعداد SSL معقّد، والكود تبعنا بيقرأ متغيّرات
بيئة Railway (`MYSQLHOST/MYSQLUSER/...`) مباشرة بدون تعديل.

### الخطوات
1. افتح **railway.app** وسجّل بحساب GitHub (عندك GitHub أصلًا).
2. اعمل **New Project → Deploy from GitHub repo** واختر `accounting-system`.
   (ارفع الفرع `main` على GitHub أول — انعمل هييك بالكود).
3. **اربط قاعدة MySQL**: داخل المشروع → *Add → Database → MySQL*. Railway بينشئ
   متغيّرات البيئة (`MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`)
   ويوصلّها تلقائيًا للتطبيق. كودنا بيقراها لحاله.
4. **متغيّرات التطبيق**: من إعدادات الخدمة → *Variables*، تأكّد/أضف:
   - `JWT_SECRET` = سلسلة عشوائية طويلة.
   - `NODE_ENV` = `production`
   - (الـ DB ما بدك تظبيطها يدوي — بتتوصل تلقائيًا؛ ولو بدك يدوي ضع `DATABASE_URL` بدلهم.)
5. **أمر التشغيل**: الخدمة لازم تشغّل `npm start` (= `node server/server.js`). Railway
   بيقرأ `package.json` → `scripts.start` تلقائيًا. والمنفذ من `$PORT` (الكود بيستخدمه).
6. **تفعيل الرابط العام**: Service → *Settings → Networking → Generate Domain*.
   بيطلعلك رابط مثل `https://<name>.up.railway.app` — افتحوا = صفحة الدخول.

### ترحيل قاعدة البيانات (مرة واحدة)
القاعدة على Railway فاضية. لازم تبنى الـ schema + seed:
- **الأسهل**: من داخل Railway (MySQL) نفّذ ملفات `database/` بالترتيب:
  1. `database/schema.sql`
  2. `database/seed.sql`
  3. `database/migrations/001_*.sql` لو موجودة، ثم `002_purchase_payment.sql`، `003_supplier_payments.sql`
- **بديل**: صُدّر قاعدتك المحلية (`mysqldump`) واستوردها على Railway. (تنبيه: عندك حاليًا
  قاعدة نظيفة برأس مال 20,000 بس — هاي مناسبة للعرض).
- بعد الترحيل، **غيّر كلمات المرور** فورًا (نقطة الأمان ١).

---

## البديل: Render
Render فيه خدمة ويب مجانية، لكن **قاعدة MySQL مدفوعة** (الـ المجاني عنده Postgres).
لو اخترت Render:
- أنشئ **Web Service** من GitHub، Build Command: `npm install`، Start Command: `node server/server.js`.
- أنشئ **MySQL Database** (خطة مدفوعة) وخدّ *External Database URL*.
- متغيّرات البيئة:
  - `DATABASE_URL` = رابط MySQL (شكل `mysql://user:pass@host:port/db`)
  - `DB_SSL = true` (Render بيحتاج تشفير)
  - `JWT_SECRET`، `NODE_ENV=production`
- الكود بيدعم `DATABASE_URL` + `DB_SSL` جاهزًا (عدّلنا `server/config/db.js`).

---

## كيف يشتغل الكود على أي منصّة (بدون تعديل)
- **الواجهة**: `client/js/config.js` بيحسب الـ API base بنفسه (نفس الأصل `/api` بالنشر،
  أو `http://localhost:3000/api` بالتطوير المحلي).
- **قاعدة البيانات**: `server/config/db.js` بيقبل `DATABASE_URL` أو `MYSQLURL` أو
  متغيّرات Railway `MYSQL*` أو `DB_*` المحلية، مع مفتاح `DB_SSL` عند الحاجة.
- **الرؤوس الأمنية**: `helmet` مهيّئ بـ CSP بيسمح بـ Tailwind/Google Fonts CDN.

## فحص سريع بعد النشر
- افتح الرابط → لازم تطلع صفحة الدخول.
- افتح `<رابط>/api/health` → JSON فيه `"database":"connected"`.
- سجّل دخول، اعمل عمليّة صغيرة، وتأكّد إنه عم بيظهر بالقوائم.

## محليًا (للمراجعة قبل النشر)
- API: `node server/server.js` → `http://localhost:3000` (بيقدّر الواجهة كمان من :3000).
- قاعدة: XAMPP MySQL.
