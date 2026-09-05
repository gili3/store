import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "wouter";
import { Loader2, CheckCircle, XCircle, Package, User, DollarSign, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatNumber, formatDate } from "@/lib/formatters";
// ✅ إصلاح: ألوان/تسميات حالة الطلب من مصدر واحد موحّد (مطابقة تماماً
// لباقي صفحات الموقع ولوحة التحكم وتطبيق الأندرويد)
import { getOrderStatusConfig } from "@/lib/orderStatus";

export default function VerifyOrder() {
  const [, params] = useRoute("/verify-order/:token");
  const token = params?.token;

  const { data, isLoading } = trpc.firestore.verifyOrder.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-40">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground font-medium">جاري التحقق من صحة الطلب...</p>
        </div>
      </Layout>
    );
  }

  if (!data?.success || !data.order) {
    return (
      <Layout>
        <div className="container max-w-md py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-destructive/10 border-2 border-destructive rounded-full">
                <XCircle className="w-16 h-16 text-destructive" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              فشل التحقق
            </h2>
            <p className="text-muted-foreground mb-8">
              {data?.message || "الرمز المستخدم غير صحيح أو الطلب غير موجود في قاعدة البيانات."}
            </p>
            <p className="text-sm text-muted-foreground">
              يرجى التأكد من الرابط أو محاولة مسح رمز QR مرة أخرى
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const { order } = data;

  const statusInfo = getOrderStatusConfig(order.status);
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();

  return (
    <Layout>
      <div className="container max-w-2xl py-16">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-6 bg-green-100/50 border-2 border-green-500 rounded-full">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3" style={{ fontFamily: 'Georgia, serif' }}>
            تم التحقق بنجاح
          </h1>
          <p className="text-muted-foreground text-lg">
            هذا الطلب صحيح ومسجل في نظام Eleven
          </p>
        </div>

        {/* Order Details Card */}
        <Card className="border-border bg-card mb-8 overflow-hidden">
          <div className="h-1 bg-primary"></div>
          <CardContent className="p-8">
            {/* Order Header */}
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">رقم الطلب</p>
                <p className="text-3xl font-bold text-foreground">#{order.orderNumber}</p>
              </div>
              <Badge style={statusInfo.style} className="border-0 font-bold text-base px-4 py-2">
                {statusInfo.label}
              </Badge>
            </div>

            {/* Order Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Customer Info */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">العميل</p>
                  <p className="text-lg font-bold text-foreground">{order.customerName || "غير محدد"}</p>
                </div>
              </div>

              {/* Order Date */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">التاريخ</p>
                  <p className="text-lg font-bold text-foreground">{formatDate(orderDate)}</p>
                </div>
              </div>

              {/* Total Amount */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">الإجمالي</p>
                  <p className="text-2xl font-bold text-primary">{formatNumber(order.total)} ج.س</p>
                </div>
              </div>

              {/* Items Count */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 border border-primary flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">عدد المنتجات</p>
                  <p className="text-lg font-bold text-foreground">{order.items?.length || 0} منتج{(order.items?.length || 0) !== 1 ? "ات" : ""}</p>
                </div>
              </div>
            </div>

            {/* Products List */}
            <div className="border-t border-border pt-8">
              <h3 className="text-lg font-bold text-foreground mb-6" style={{ fontFamily: 'Georgia, serif' }}>
                المنتجات المطلوبة
              </h3>
              <div className="space-y-3">
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border border-border">
                    <div>
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">السعر: {formatNumber(item.price)} ج.س</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-lg">x{item.quantity}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(item.price * item.quantity)} ج.س</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Info */}
        <div className="text-center p-6 bg-secondary/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground font-medium">
            ✓ تم التحقق من صحة هذا الطلب في: <span className="text-foreground font-bold">{new Date().toLocaleString('ar-EG')}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            شكراً لتسوقكم من Eleven
          </p>
        </div>
      </div>
    </Layout>
  );
}
