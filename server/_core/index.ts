import "dotenv/config";
import express from "express";
import cors from "cors"; // إضافة CORS
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerSessionRoutes } from "./sessionRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// ✅ إصلاح (Audit المرحلة 7، معالجة الأخطاء والسجلات): لم يكن هناك أي معالج
// على مستوى العملية (process) لا لـuncaughtException ولا لـunhandledRejection.
// افتراضياً Node.js يُنهي العملية بالكامل فوراً عند أي خطأ متزامن غير مُلتقَط
// (uncaughtException) — أي أن خطأ واحد غير متوقَّع بأي مكان بالكود (حتى لو
// بجزء بسيط لا علاقة له بالطلب الحالي) كان يقطع الخدمة عن كل المستخدمين
// دفعة واحدة، وليس فقط الطلب المتسبِّب. ومنذ Node 15+، هذا ينطبق أيضاً على
// unhandledRejection (وعد Promise مرفوض بلا `.catch`، كأي نداء "أطلق ولا
// تنتظر" لإرسال إشعار مثلاً) — يُنهي العملية أيضاً بلا تمييز.
//
// المعالجة هنا: نسجّل الخطأ بوضوح دائماً. للاستثناءات المتزامنة غير
// الملتقَطة تحديداً (uncaughtException) — نخرج من العملية بعد التسجيل، لأن
// حالة العملية قد تكون فعلياً غير موثوقة بعدها (توصية Node.js الرسمية)،
// ونترك منصة الاستضافة (Render وغيرها) تُعيد تشغيلها تلقائياً بدل الاستمرار
// بحالة غير مستقرة بصمت. أما رفض الوعود غير الملتقَطة (unhandledRejection)
// فنكتفي بتسجيله كتحذير بدل إنهاء العملية، لأنه غالباً خطأ محلي في مسار غير
// حرج (كفشل إرسال إشعار) وليس فساداً بحالة العملية بالكامل.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] استثناء غير مُلتقَط (uncaughtException) — سيُعاد تشغيل السيرفر:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[WARN] وعد مرفوض بلا معالجة (unhandledRejection):", reason);
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ✅ إصلاح (Audit المرحلة 6، APIs والشبكة): لم تكن هناك أي مهلة زمنية على
  // مستوى السيرفر نفسه لأي اتصال HTTP — نظرياً يمكن لاتصال عالق (شبكة عميل
  // سيئة، أو محاولة إبقاء اتصالات مفتوحة عمداً بأسلوب Slow-loris) أن يستهلك
  // موارد السيرفر إلى ما لا نهاية. 35 ثانية (أكبر بقليل من مهلة العميل
  // البالغة 30 ثانية بـmain.tsx) تعطي فرصة لرسالة خطأ عميل نظيفة أولاً قبل
  // أن يقطع السيرفر الاتصال من جهته.
  server.requestTimeout = 35_000;
  server.headersTimeout = 36_000; // يجب أن يكون أكبر قليلاً من requestTimeout دائماً (متطلب Node.js)

  // ✅ إصلاح (Audit المرحلة 3، بند 3.6): تفعيل صريح لـ"trust proxy" — منصات
  // الاستضافة (Render وما شابه) تمرّر عنوان/بروتوكول العميل الحقيقي عبر
  // X-Forwarded-For/X-Forwarded-Proto من طبقتها الخاصة الموثوقة (وليس من
  // العميل مباشرة)، لذا الاعتماد عليها هنا آمن. توثيق هذا الافتراض صراحة
  // بدل تركه ضمنياً — يؤثر على قيمة secure/sameSite لكوكي الجلسة (cookies.ts)
  // وعلى تحديد هوية العميل لمحدود الطلبات (rateLimit.ts) أدناه.
  app.set("trust proxy", 1);

  // CORS - يسمح لتطبيق Capacitor والموقع بالاتصال فقط من النطاقات المعروفة
  // ⚠️ تمت إزالة '*' التي كانت موجودة سابقاً: مع credentials: true هذا التركيب
  // إما لا يعمل فعلياً (سلوك مكتبة cors الحالي) أو يفتح الوصول للجميع إذا تغيّر
  // السلوك مستقبلاً — كلاهما غير مقصود، لذا يجب تحديد النطاقات صراحةً فقط.
  // ✅ إصلاح (Audit جديد): تمت إزالة /\.onrender\.com$/ — onrender.com منصة
  // استضافة مشتركة، وأي مستخدم آخر عليها كان يقدر ينشر تطبيقاً على
  // subdomain خاص به ويُمرَّر تلقائياً كـ origin موثوق (مع credentials: true)،
  // مما يفتح الباب لهجمات CSRF/سرقة جلسة عبر origin مزيّف على نفس المنصة.
  // الآن يُحدَّد نطاق الموقع الفعلي فقط صراحةً، مع إمكانية إضافة نطاق إنتاج
  // إضافي عبر متغير بيئة عند الحاجة (دون فتح كل subdomains onrender.com).
  const allowedOrigins = [
    'capacitor://localhost',
    'http://localhost',
    'https://eleven-x9ed.onrender.com',
    ...(process.env.EXTRA_CORS_ORIGIN ? [process.env.EXTRA_CORS_ORIGIN] : []),
  ];
  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  // ✅ إصلاح (Audit المرحلة 3، بند 3.4): كان الحد 50MB مطبَّقاً عالمياً على
  // كل نقاط tRPC (بما فيها تسجيل الدخول والتحقق من كوبون) رغم أن الصور
  // وإيصالات الدفع تُرفع مباشرة من العميل لـFirebase Storage عبر Client SDK
  // (راجع client/src/lib/imageUpload.ts) ولا تمر عبر هذا السيرفر إطلاقاً —
  // فلا حاجة فعلية لأي جسم طلب كبير هنا. 1MB هامش آمن أكبر من أي payload JSON
  // شرعي متوقع بالتطبيق (طلب بحد أقصى 10 عناصر، إعدادات المتجر، إلخ).
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  // ✅ جلسة httpOnly مبنية على Firebase Session Cookies (بديل Authorization
  // Bearer مع كل طلب) — راجع server/_core/sessionRoutes.ts
  registerSessionRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ✅ إصلاح (Audit المرحلة 7): لم يكن هناك أي معالج أخطاء عام على مستوى
  // Express — أي خطأ يقع خارج منطق tRPC نفسه (مثل جسم JSON تالف بطلب لـ
  // /api/session/login، الذي يستدعي express.json() قبل الوصول لأي منطق
  // خاص بنا) كان يسقط لمعالج Express الافتراضي، الذي يرجّع صفحة HTML بدل
  // استجابة JSON متّسقة مع بقية الـAPI (قد يُسبِّب فشلاً غير واضح بجانب
  // العميل عند محاولة قراءة الاستجابة كـJSON). ملاحظة: لا يشمل هذا أخطاء
  // إجراءات tRPC نفسها (لها تنسيق أخطاء خاص بها بالفعل عبر TRPCError) —
  // هذا فقط شبكة أمان لما هو خارج tRPC.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("[Express Error]", req.method, req.path, err?.message || err);
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({ error: "طلب غير صالح" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// ✅ إصلاح (Audit المرحلة 7): كان startServer().catch(console.error) يكتفي
// بتسجيل الخطأ فقط لو فشل تشغيل السيرفر من البداية (مثلاً فشل الاتصال
// بـFirebase Admin أو خطأ إعداد)، لكن العملية كانت تستمر "حيّة" بلا أي
// سيرفر HTTP فعلي يعمل — منصة الاستضافة قد تظن التشغيل نجح (لا كود خروج
// بالخطأ) بينما الموقع فعلياً معطَّل بالكامل بصمت. الآن نخرج بكود خطأ
// صريح ليكتشف نظام المراقبة/إعادة التشغيل بالمنصة الفشل فوراً.
startServer().catch((err) => {
  console.error("[FATAL] فشل تشغيل السيرفر عند البدء:", err);
  process.exit(1);
});