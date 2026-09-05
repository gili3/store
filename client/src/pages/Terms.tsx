import Layout from "@/components/Layout";
import { FileText, ShoppingBag, CreditCard, Truck, Tag, RotateCcw, UserCheck, PauseCircle, Mail } from "lucide-react";

const sections = [
  {
    icon: ShoppingBag,
    title: "1. استخدام الخدمة",
    items: ["التطبيق مخصص لعرض وشراء المنتجات داخل السودان فقط.", "يمنع الاستخدام غير القانوني أو الاحتيالي."],
  },
  {
    icon: CreditCard,
    title: "2. الطلبات والدفع",
    items: ["يتم تأكيد الطلب بعد الدفع عبر التحويل البنكي.", "الطلبات غير المدفوعة لا يتم تنفيذها."],
  },
  {
    icon: Truck,
    title: "3. التوصيل",
    items: ["التوصيل داخل السودان فقط.", "مدة التوصيل تختلف حسب الموقع."],
  },
  {
    icon: Tag,
    title: "4. الأسعار والتعديل",
    items: ["الأسعار قابلة للتغيير بدون إشعار مسبق."],
  },
  {
    icon: RotateCcw,
    title: "5. الإرجاع والاستبدال",
    items: ["لا يوجد نظام إرجاع أو استبدال بعد إتمام الطلب."],
  },
  {
    icon: UserCheck,
    title: "6. مسؤولية المستخدم",
    items: ["المستخدم مسؤول عن صحة بياناته (الاسم، الهاتف، العنوان).", "أي خطأ قد يؤدي إلى تأخير أو فشل التوصيل."],
  },
  {
    icon: PauseCircle,
    title: "7. إيقاف الخدمة",
    items: ["يحق لإدارة Eleven تعديل أو إيقاف الخدمة في أي وقت."],
  },
];

export default function Terms() {
  return (
    <Layout>
      <div className="container py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-primary flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-3" style={{ fontFamily: "Georgia, serif" }}>
              الشروط والأحكام – Eleven
            </h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: 30 يونيو 2026</p>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-10 text-center">
            باستخدامك لتطبيق Eleven فأنت توافق على هذه الشروط.
          </p>

          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.title} className="border border-border rounded-2xl p-6 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <s.icon className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{s.title}</h2>
                </div>
                <ul className="space-y-1.5 mt-1">
                  {s.items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="border border-border rounded-2xl p-6 bg-secondary/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-bold text-foreground">8. التواصل</h2>
              </div>
              <a href="mailto:support@eleven-sd.com" className="text-primary font-semibold text-sm hover:underline">
                support@eleven-sd.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
