# قواعد أمان Firebase (Firestore / Storage)

✅ إضافة: كانت `firestore.rules` و`storage.rules` غير موجودتين إطلاقاً ضمن
هذا المستودع — أي تعديل عليهما كان يحدث (إن حدث) مباشرة من Firebase Console
دون أي تحكم بالإصدار أو مراجعة كود. أصبحتا الآن جزءاً من المستودع، إلى جانب
`firebase.json` الذي يربطهما لأغراض النشر عبر سطر الأوامر فقط (لا يوجد
إعداد Hosting هنا عمداً — الموقع فعلياً مستضاف على Render، انظر `Dockerfile`).

## النشر

```bash
npm install -g firebase-tools   # إن لم تكن مثبَّتة
firebase login
firebase use <project-id>       # queen-beauty-b811b — راجع VITE_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,storage:rules
```

## شرط أساسي قبل النشر

قاعدة `isAdmin()` في كلا الملفين تعتمد على حقل `role: "admin"` بمستند
`users/{uid}` الخاص بحساب المالك في Firestore. هذا الحقل يُكتب الآن تلقائياً
عند كل تسجيل دخول لصاحب الحساب (`server/_core/sessionRoutes.ts` —
`syncAdminRoleToFirestore`)، لذا يكفي أن يسجّل المالك دخوله مرة واحدة على
الموقع بعد نشر هذا التحديث حتى يُكتب الحقل صحيحاً، **قبل** الاعتماد الكامل
على تفعيل "Enforce" لقواعد Storage (وإلا سيفشل رفع صور المنتجات من لوحة
التحكم إلى حين تسجيل دخول واحد ناجح للمالك بعد نشر هذا الإصدار).
