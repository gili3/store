import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, ShieldCheck, Truck, Headphones, Award, Users, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function About() {
  const { data: storeSettings } = trpc.firestore.getStoreSettings.useQuery();
  const storeName = storeSettings?.storeName || "Eleven";
  const storeDescription = storeSettings?.storeDescription || "نحن متجر متخصص في الملابس الراقية والمنتجات المختارة بعناية لتلبية ذوقك الفريد.";
  const storeVision = storeSettings?.storeVision || "نهدف إلى أن نكون الوجهة الأولى للتسوق عبر الإنترنت، حيث يجد العميل كل ما يحتاجه بأسعار تنافسية وجودة لا تضاهى.";
  const storeMission = storeSettings?.storeMission || "توفير منصة آمنة وموثوقة تربط بين أفضل المنتجات والمستهلكين، مع التركيز على سرعة التوصيل وضمان رضا العملاء التام.";
  const storeAboutImage = storeSettings?.storeAboutImage || "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=800&auto=format&fit=crop&q=60";

  return (
    <Layout>
      <div className="container py-16">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            حول {storeName}
          </h1>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {storeDescription}
          </p>
        </div>

        {/* Vision & Mission Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="space-y-8">
            {/* Vision */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                  رؤيتنا
                </h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {storeVision}
              </p>
            </div>

            {/* Mission */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                  مهمتنا
                </h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {storeMission}
              </p>
            </div>
          </div>

          {/* Image */}
          <div className="rounded-lg overflow-hidden bg-secondary/30 border border-border aspect-square">
            <img 
              src={storeAboutImage} 
              alt={storeName} 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-foreground text-center mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            لماذا تختار Eleven؟
          </h2>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full mb-12"></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: ShoppingBag, 
                title: "منتجات مختارة", 
                desc: "نختار منتجاتنا بعناية لضمان أعلى معايير الجودة والأناقة" 
              },
              { 
                icon: ShieldCheck, 
                title: "تسوق آمن", 
                desc: "بياناتك ومدفوعاتك محمية بتشفير عالي المستوى" 
              },
              { 
                icon: Truck, 
                title: "توصيل سريع", 
                desc: "نصل إليك أينما كنت في أسرع وقت ممكن" 
              },
              { 
                icon: Headphones, 
                title: "دعم فني", 
                desc: "فريقنا متواجد دائماً للرد على استفساراتك" 
              },
            ].map((feature, i) => (
              <Card 
                key={i} 
                className="text-center border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="pt-8 pb-6">
                  <div className="w-14 h-14 rounded-lg bg-accent/10 border border-primary flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-border p-12 mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10K+</div>
              <p className="text-muted-foreground font-medium">عميل راضي</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">5K+</div>
              <p className="text-muted-foreground font-medium">منتج متنوع</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-muted-foreground font-medium">دعم عملاء</p>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div>
          <h2 className="text-4xl font-bold text-foreground text-center mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            فريقنا المتميز
          </h2>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full mb-12"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">فريق محترف</h3>
                  <p className="text-sm text-muted-foreground">متخصصون في تجارة التجزئة</p>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                فريقنا يتكون من محترفين ذوي خبرة عالية في مجال التجارة الإلكترونية والخدمات اللوجستية.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <Award className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">جودة معترف بها</h3>
                  <p className="text-sm text-muted-foreground">شهادات دولية</p>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                نحن حاصلون على عدة شهادات دولية تؤكد التزامنا بأعلى معايير الجودة والخدمة.
              </p>
            </div>
          </div>
        </div>
        {/* Contact Section - like APK AboutContactScreen */}
        <div className="mt-20 bg-card border border-border rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-foreground mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            تواصل معنا
          </h2>
          <div className="w-12 h-1 bg-primary rounded-full mb-8"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "📞", label: "الهاتف", value: storeSettings?.phone || "—", href: `tel:${storeSettings?.phone}` },
              { icon: "✉️", label: "البريد الإلكتروني", value: storeSettings?.email || "—", href: `mailto:${storeSettings?.email}` },
              { icon: "💬", label: "واتساب", value: storeSettings?.whatsapp || "—", href: `https://wa.me/${(storeSettings?.whatsapp || "").replace(/\D/g,"")}` },
              { icon: "📍", label: "العنوان", value: storeSettings?.address || "—", href: "#" },
            ].map((item, i) => (
              <a
                key={i}
                href={item.href}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/5 transition-all group"
              >
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{item.value}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
