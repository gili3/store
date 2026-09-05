import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Send, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Contact() {
  const { data: storeSettings } = trpc.firestore.getStoreSettings.useQuery();

  const storePhone = storeSettings?.phone || "";
  const storeEmail = storeSettings?.email || "";
  const storeAddress = storeSettings?.address || "";
  const storeWhatsapp = storeSettings?.whatsapp || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("تم إرسال رسالتك بنجاح، سنقوم بالرد عليك قريباً");
  };

  return (
    <Layout>
      <div className="container py-16">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            اتصل بنا
          </h1>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-muted-foreground">
            هل لديك استفسار أو اقتراح؟ نحن هنا لمساعدتك دائماً. تواصل معنا بأي طريقة مناسبة لك.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Phone */}
            {storePhone && (
              <Card className="border-border bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">اتصل بنا</h3>
                      <a 
                        href={`tel:${storePhone}`} 
                        className="text-sm text-primary hover:text-primary/80 transition-colors font-medium" 
                        dir="ltr"
                      >
                        {storePhone}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Email */}
            {storeEmail && (
              <Card className="border-border bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">البريد الإلكتروني</h3>
                      <a 
                        href={`mailto:${storeEmail}`} 
                        className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                      >
                        {storeEmail}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Address */}
            {storeAddress && (
              <Card className="border-border bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">الموقع</h3>
                      <p className="text-sm text-muted-foreground">{storeAddress}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* WhatsApp */}
            {storeWhatsapp && (
              <Card className="border-border bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">واتساب</h3>
                      <a
                        href={`https://wa.me/${storeWhatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-green-600 hover:text-green-700 transition-colors font-medium"
                        dir="ltr"
                      >
                        {storeWhatsapp}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hours */}
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">ساعات العمل</h3>
                    <p className="text-sm text-muted-foreground">السبت - الخميس</p>
                    <p className="text-sm text-muted-foreground">9:00 - 22:00</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6" style={{ fontFamily: 'Georgia, serif' }}>
                  أرسل لنا رسالة
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">الاسم الكامل</label>
                      <Input 
                        placeholder="اسمك الكامل" 
                        className="border-border bg-secondary/30 h-11 rounded-lg focus:ring-2 focus:ring-primary"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">البريد الإلكتروني</label>
                      <Input 
                        type="email" 
                        placeholder="email@example.com" 
                        className="border-border bg-secondary/30 h-11 rounded-lg focus:ring-2 focus:ring-primary"
                        required 
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">الموضوع</label>
                    <Input 
                      placeholder="كيف يمكننا مساعدتك؟" 
                      className="border-border bg-secondary/30 h-11 rounded-lg focus:ring-2 focus:ring-primary"
                      required 
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">الرسالة</label>
                    <Textarea 
                      placeholder="اكتب رسالتك هنا..." 
                      className="border-border bg-secondary/30 min-h-[180px] rounded-lg focus:ring-2 focus:ring-primary resize-none" 
                      required 
                    />
                  </div>

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base py-6 rounded-lg gap-2"
                  >
                    <Send className="w-5 h-5" />
                    إرسال الرسالة
                  </Button>
                </form>

                {/* Info Text */}
                <p className="text-xs text-muted-foreground text-center mt-6">
                  سنقوم بالرد على رسالتك في أسرع وقت ممكن
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
