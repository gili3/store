import type { Request } from "express";
import { adminAuth } from "../firebase-admin";

/**
 * كوكي جلسة httpOnly مبني على Firebase Session Cookies — بديل عن إرسال
 * Authorization: Bearer <idToken> مع كل طلب، ويُرسَل تلقائياً مع كل طلب من
 * المتصفح دون أي انتظار لتهيئة Firebase SDK في الواجهة أو استدعاء
 * getIdToken() في كل مرة. هذا هو نفس الأسلوب المتبع في المواقع الكبيرة.
 */
export const SESSION_COOKIE_NAME = "fb_session";

// الحد الأقصى المسموح به من Firebase لعمر كوكي الجلسة هو 14 يوماً.
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * يقرأ كوكي واحد بالاسم المطلوب من هيدر Cookie الخام مباشرة، بدون الحاجة
 * لإضافة مكتبة cookie-parser كتبعية جديدة للمشروع.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) continue;
    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * ينشئ كوكي جلسة من idToken صادر حديثاً عن Firebase Auth بالمتصفح.
 * ترمي هذه الدالة استثناءً لو كان idToken غير صالح أو منتهياً — وهذا مقصود
 * (createSessionCookie تتحقق من صلاحيته ضمنياً قبل إصدار كوكي الجلسة).
 */
export async function createSession(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

/**
 * يتحقق من كوكي الجلسة، مع التأكد أيضاً أن الجلسة لم تُلغَ يدوياً (مثال:
 * تعطيل/حذف حساب من لوحة التحكم) عبر checkRevoked=true.
 */
export async function verifySession(sessionCookie: string) {
  return adminAuth.verifySessionCookie(sessionCookie, true);
}
