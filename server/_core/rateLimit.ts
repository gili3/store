import type { NextFunction, Request, Response } from "express";

// ─────────────────────────────────────────────────────────────────────────
//  ✅ إصلاح (Audit المرحلة 3، بند 3.5): محدود موارد بسيط في الذاكرة، بلا أي
//  تبعية خارجية جديدة (express-rate-limit) — لأن لا يمكن تشغيل npm install
//  في بيئة المراجعة الحالية، وهذا الحل كافٍ فعلياً لخادم Node واحد (instance
//  واحدة). إن نُشر السيرفر على أكثر من instance خلف موازن حمل مستقبلاً، يجب
//  الانتقال لمخزن مشترك (Redis) بدل الذاكرة المحلية لكل instance.
// ─────────────────────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// تنظيف دوري كل 10 دقائق حتى لا تتراكم مفاتيح منتهية الصلاحية في الذاكرة إلى الأبد
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

function clientKey(req: Request): string {
  // خلف بروكسي المنصة (Render/غيره) — أول عنوان في x-forwarded-for هو عنوان العميل الفعلي
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (first || req.socket.remoteAddress || "unknown").trim();
}

/**
 * Middleware بسيط لمسارات Express العادية (خارج tRPC): يسمح بحد أقصى
 * `max` طلب لكل `windowMs` ميلي ثانية لكل (عنوان IP + مسار).
 */
export function simpleRateLimit(routeName: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${routeName}:${clientKey(req)}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "طلبات كثيرة جداً، حاول مرة أخرى لاحقاً" });
      return;
    }

    bucket.count += 1;
    next();
  };
}

/**
 * نفس المنطق، لكن قابل للاستدعاء مباشرة داخل إجراء tRPC (لا يوجد فيها
 * req/res تقليديان بنفس الشكل، فنعتمد على uid/معرّف منطقي بدل IP هنا).
 * يرمي خطأ TOO_MANY_REQUESTS إن تجوز الحد.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= max) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export { clientKey };
