/**
 * ELEVEN STORE — حالة الطلب (Source of Truth)
 * ─────────────────────────────────────────────────────────────
 * ✅ إصلاح جذري: كانت ألوان/تسميات حالة الطلب مكرَّرة ومختلفة في 4
 * أماكن منفصلة (Orders.tsx, OrderDetail.tsx, VerifyOrder.tsx,
 * AdminDashboard.tsx) — كل ملف له تدرّج ألوان Tailwind مختلف تماماً
 * (bg-yellow-100 مقابل bg-warning/10 مقابل bg-blue-100 لنفس الحالة!).
 * هذا يعني أن نفس حالة الطلب تظهر بلون مختلف حسب الصفحة التي يراها
 * المستخدم — تناقض بصري واضح.
 *
 * الآن كل الملفات تستورد من هنا فقط، وتستخدم القيم الست عشرية (Hex)
 * الثابتة المطلوبة تحديداً عبر inline style بدل className، لضمان أن
 * اللون يبقى مطابقاً 100% بصرف النظر عن أي تعديل مستقبلي على ثيم
 * Tailwind. نفس هذه القيم مطابقة حرفياً في تطبيق الأندرويد
 * (OrderStatusColors في Theme.kt).
 */
import { ORDER_STATUS_COLORS, type OrderStatusKey } from "./colors";

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  pending: "قيد الانتظار",
  paid: "تم الدفع",
  shipped: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export interface OrderStatusConfig {
  label: string;
  style: { backgroundColor: string; color: string };
}

/** يُرجع التسمية العربية + ستايل الألوان الثابت لحالة طلب معيّنة. */
export function getOrderStatusConfig(status: string): OrderStatusConfig {
  const key = status as OrderStatusKey;
  const colors = ORDER_STATUS_COLORS[key];
  if (!colors) {
    // حالة غير معروفة — نفس منطق fallback القديم، لكن كخلفية محايدة ثابتة
    return {
      label: status,
      style: { backgroundColor: "#F3F4F6", color: "#000000" },
    };
  }
  return {
    label: ORDER_STATUS_LABELS[key],
    style: { backgroundColor: colors.bg, color: colors.fg },
  };
}

export const ORDER_STATUS_OPTIONS: { value: OrderStatusKey; label: string }[] = (
  Object.keys(ORDER_STATUS_LABELS) as OrderStatusKey[]
).map((value) => ({ value, label: ORDER_STATUS_LABELS[value] }));
