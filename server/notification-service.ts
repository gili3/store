import { adminDb } from "./firebase-admin";
import admin from "firebase-admin";
import type { NotificationType } from "../shared/types";

/**
 * ELEVEN STORE — Notification Dispatch (إعادة بناء كاملة)
 * ─────────────────────────────────────────────────────────
 * مصدر الحقيقة الوحيد لكل إشعار: users/{uid}/notifications/{id}
 * تُقرأ هذه المجموعة حرفياً من ثلاث جهات: الموقع (real-time onSnapshot)،
 * تطبيق الأندرويد (نفس المسار)، وهذا الملف (الكتابة + الإرسال).
 *
 * القرارات المعمارية:
 * 1) دالة واحدة فقط لكل استدعاء (notifyUser) تكتب السجل وترسل الـPush معاً،
 *    بدل استدعاءين منفصلين متكررين في كل نقطة استدعاء بالسيرفر.
 * 2) رسائل FCM "data-only" حصراً (بدون حقل notification أعلى المستوى) —
 *    هذا شرط تقني إلزامي: أي حقل notification أعلى المستوى يجعل FCM نفسه
 *    (وليس كودنا) يقرر عرض الإشعار عبر مسار داخلي صامت غير موثوق على متصفحات
 *    الجوال، متجاوزاً service worker الخاص بنا بالكامل. بدلاً من ذلك، كل من
 *    onMessageReceived (أندرويد) و onBackgroundMessage (service worker
 *    بالموقع) يبنيان الإشعار يدوياً بنفس الشكل دائماً.
 * 3) فشل إرسال الـPush لا يُسقط كتابة السجل أبداً — المستخدم يرى الإشعار في
 *    القائمة عند فتح التطبيق/الموقع حتى لو تعذّر تسليم الـPush الفوري.
 */

const ANDROID_NOTIFICATION_CHANNEL_ID = "eleven_store_channel";
const SITE_BASE_URL = (process.env.SITE_BASE_URL || "https://eleven-sd.com").replace(/\/$/, "");

// أخطاء FCM التي تعني فعلاً أن التوكن نفسه لم يعد صالحاً بشكل دائم — أي خطأ
// آخر (عطل مؤقت بجانب FCM، تجاوز حصة الإرسال...) لا يجب أن يحذف توكناً صالحاً.
const PERMANENT_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export type NotifyUserInput = {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  /** مسار داخلي يُفتح عند الضغط على الإشعار، مثال: "/order/abc123" */
  actionRoute?: string;
};

/** يبني رابطاً مطلقاً صالحاً لـ webpush.fcmOptions.link (يشترط FCM هذا صراحة). */
function resolveAbsoluteLink(actionRoute?: string): string {
  const path = actionRoute && actionRoute.startsWith("/") ? actionRoute : "/notifications";
  return `${SITE_BASE_URL}${path}`;
}

/** يحذف من قائمة توكنات المستخدم فقط التوكنات التي تأكّد عطبها الدائم. */
async function pruneDeadTokens(userId: string, tokens: string[], responses: admin.messaging.SendResponse[]) {
  const deadTokens: string[] = [];
  responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code && PERMANENT_TOKEN_ERROR_CODES.has(resp.error.code)) {
      deadTokens.push(tokens[idx]);
    }
    if (!resp.success) {
      console.error(`[Notifications] فشل تسليم التوكن #${idx}:`, resp.error?.message);
    }
  });
  if (deadTokens.length > 0) {
    await adminDb.collection("users").doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens),
    });
  }
}

async function pushToDevices(userId: string, title: string, body: string, type: NotificationType, actionRoute?: string) {
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const tokens: string[] = userSnap.data()?.fcmTokens || [];
  if (tokens.length === 0) return;

  const message: admin.messaging.MulticastMessage = {
    // ⚠️ لا يوجد حقل "notification" هنا عمداً — راجع الشرح أعلى الملف.
    data: { title, body, type, actionRoute: actionRoute || "" },
    tokens,
    android: {
      priority: "high",
      notification: { channelId: ANDROID_NOTIFICATION_CHANNEL_ID },
    },
    webpush: {
      headers: { Urgency: "high" },
      fcmOptions: { link: resolveAbsoluteLink(actionRoute) },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    if (response.failureCount > 0) {
      await pruneDeadTokens(userId, tokens, response.responses);
    }
  } catch (error) {
    // لا نرمي — كتابة السجل بقاعدة البيانات أهم من نجاح الـPush الفوري.
    console.error("[Notifications] تعذّر إرسال الـPush:", error);
  }
}

/**
 * نقطة الدخول الوحيدة لإرسال إشعار لمستخدم: تكتب السجل بقاعدة البيانات
 * (يظهر فوراً بقائمة الإشعارات على الموقع والتطبيق عبر real-time listener)
 * وترسل push إلى كل أجهزته المسجَّلة معاً.
 */
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  const { userId, title, body, type, actionRoute } = input;
  if (!userId) {
    console.warn("[Notifications] notifyUser بدون userId — تم التجاهل");
    return;
  }

  try {
    await adminDb.collection("users").doc(userId).collection("notifications").add({
      title,
      body,
      type,
      isRead: false,
      ...(actionRoute ? { actionRoute } : {}),
      createdAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error("[Notifications] تعذّرت كتابة سجل الإشعار:", error);
    // نحاول إرسال الـPush رغم ذلك — أفضل من عدم إشعار المستخدم إطلاقاً.
  }

  await pushToDevices(userId, title, body, type, actionRoute);
}
