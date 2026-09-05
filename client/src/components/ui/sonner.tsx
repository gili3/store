import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * ✅ إعادة تصميم: كانت كل رسائل Toast (نجاح/خطأ/تحذير) تظهر بنفس لون
 * الخلفية والحدود تماماً (--normal-bg/--normal-border ثابتة)، فلا يوجد
 * أي تمييز بصري بين toast.success() و toast.error() سوى الأيقونة
 * الافتراضية الصغيرة — يجعل رسائل الخطأ سهلة التجاهل.
 *
 * الآن: richColors مفعّلة (تلوّن الخلفية/الحد/النص تلقائياً حسب نوع
 * الرسالة success/error/warning/info)، مع بطاقات أوسع، حواف أكثر
 * استدارة، ظل أنعم، وزر إغلاق صريح — نفس هوية بطاقات الإشعارات
 * الحديثة في باقي الموقع والتطبيق.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      closeButton
      position="top-center"
      duration={4000}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // ── ألوان دلالية حديثة لكل نوع رسالة ──────────────────
          "--success-bg": "#DCFCE7",
          "--success-text": "#166534",
          "--success-border": "#BBF7D0",
          "--error-bg": "#FEE2E2",
          "--error-text": "#991B1B",
          "--error-border": "#FECACA",
          "--warning-bg": "#FFEDD5",
          "--warning-text": "#9A3412",
          "--warning-border": "#FED7AA",
          "--info-bg": "#DBEAFE",
          "--info-text": "#1E3A8A",
          "--info-border": "#BFDBFE",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl shadow-lg border px-4 py-3.5 gap-3 font-medium",
          title: "font-semibold text-sm",
          description: "text-sm opacity-90",
          actionButton: "rounded-lg font-semibold",
          cancelButton: "rounded-lg",
          closeButton: "rounded-full",
          icon: "shrink-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
