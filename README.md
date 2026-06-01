# متجر إليفن الإلكتروني - Eleven Store

تطبيق متجر إلكتروني احترافي مبني بـ Node.js و Express و EJS مع قاعدة بيانات Firestore.

## 🚀 البدء السريع

### المتطلبات
- Node.js v14+
- npm v6+
- Firebase Account

### التثبيت

```bash
# استنساخ المشروع
git clone <your-repo>
cd "ملفات الموقع node.js"

# تثبيت الحزم
npm install

# إنشاء ملف .env
cp .env.example .env

# تشغيل السيرفر
npm start
```

السيرفر سيعمل على `http://localhost:3000`

## 📁 هيكل المشروع

```
├── views/              # قوالب EJS
├── static/             # ملفات ثابتة (CSS, JS, Images)
├── controllers/        # معالجات الطلبات
├── routes/             # مسارات التطبيق
├── middleware/         # برامج وسيطة
├── services/           # خدمات البيانات
└── server.js          # ملف السيرفر الرئيسي
```

## 🎨 الميزات

- ✅ واجهة مستخدم حديثة وسهلة الاستخدام
- ✅ نظام بحث وفلترة متقدم
- ✅ سلة تسوق ديناميكية
- ✅ نظام مصادقة آمن
- ✅ لوحة تحكم إدارية
- ✅ دعم اللغة العربية الكامل
- ✅ استجابة للأجهزة المختلفة

## 🔐 الأمان

- Helmet.js لحماية رؤوس HTTP
- CORS للتحكم في الطلبات
- Session Management الآمن
- Content Security Policy

## 📝 المتغيرات البيئية

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key
FIREBASE_SERVICE_ACCOUNT=your-firebase-config
```

## 🚢 النشر

### على Render
```bash
git push origin main
```

### على Heroku
```bash
heroku create your-app-name
git push heroku main
```

## 📞 الدعم

للمزيد من المعلومات، راجع ملف `CONVERSION_REPORT.md`

---

**تم بناؤه بـ ❤️ باستخدام Node.js و Express**
