import Layout from "@/components/Layout";
import { ShieldCheck, Database, Settings2, Lock, Share2, CreditCard, Mail } from "lucide-react";

const sections = [
  {
    icon: Database,
    title: "1. البيانات التي نقوم بجمعها",
    items: ["الاسم الكامل", "البريد الإلكتروني", "رقم الهاتف", "عنوان التوصيل"],
  },
  {
    icon: Settings2,
    title: "2. استخدام البيانات",
    items: [
      "إنشاء الحساب وإدارته",
      "معالجة الطلبات وتأكيدها",
      "توصيل المنتجات إلى العميل",
      "التواصل بخصوص الطلبات أو الدعم الفني",
    ],
  },
  {
    icon: Lock,
    title: "3. حماية البيانات",
    text: "نقوم باتخاذ إجراءات أمنية مناسبة لحماية بيانات المستخدم، مع العلم أنه لا يوجد نظام آمن 100%.",
  },
  {
    icon: Share2,
    title: "4. مشاركة البيانات",
    text: "لا يتم بيع أو مشاركة بيانات المستخدمين مع أي طرف ثالث، باستثناء ما هو ضروري لإتمام التوصيل داخل السودان.",
  },
  {
    icon: CreditCard,
    title: "5. الدفع",
    text: "جميع المدفوعات تتم عبر التحويل البنكي فقط.",
  },
];

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="container py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-primary flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-3" style={{ fontFamily: "Georgia, serif" }}>
              سياسة الخصوصية – Eleven
            </h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: 30 يونيو 2026</p>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-10 text-center">
            في Eleven نحن نلتزم بحماية خصوصية المستخدمين ونعمل على استخدام البيانات فقط لتقديم خدمة شراء سلسة وآمنة.
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
                {s.text && <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>}
                {s.items && (
                  <ul className="space-y-1.5 mt-1">
                    {s.items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <div className="border border-border rounded-2xl p-6 bg-secondary/20 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-bold text-foreground">6. التواصل</h2>
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
