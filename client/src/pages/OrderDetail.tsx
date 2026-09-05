import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useRoute } from "wouter";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { QRCodeSVG } from "qrcode.react";
import { formatNumber } from "@/lib/formatters";
import { COLORS } from "@/lib/colors";
import { useAuth } from "@/_core/hooks/useAuth";
// ✅ إصلاح: ألوان/تسميات حالة الطلب أصبحت من مصدر واحد موحّد (نفس الألوان
// الثابتة تماماً في Orders.tsx / VerifyOrder.tsx / لوحة التحكم / الأندرويد)
import { getOrderStatusConfig } from "@/lib/orderStatus";

// ألوان الفاتورة القابلة للطباعة — مأخوذة من نظام الألوان الموحّد
// (خلفية دافئة محايدة + نص Ink + لون العلامة الأساسي كتمييز)
const INVOICE = {
  bg: COLORS.neutral[50],
  surface: COLORS.white,
  text: COLORS.ink,
  muted: COLORS.neutral[500],
  brand: COLORS.ink,
  brandTint: COLORS.primary[50],
  brandBorder: COLORS.primary[200],
  divider: COLORS.neutral[200],
};

const PAYMENT_MAP: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash:          "دفع عند الاستلام",
  card:          "بطاقة ائتمانية",
};

function InvoicePrint({ order, storeSettings }: { order: any; storeSettings: any }) {
  const date = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = date.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const storeName = storeSettings?.storeName || "Eleven";
  const storeAddress = storeSettings?.address || "";
  const storeUrl = window.location.origin;
  const verifyUrl = `${storeUrl}/verify-order/${order.verificationToken}`;
  const subtotal = order.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0) || 0;
  const shippingFee = order.shippingCost || 0;
  const total = subtotal + shippingFee;
  const statusLabel = getOrderStatusConfig(order.status).label;

  return (
    <div
      id="invoice-print-area"
      style={{
        width: "100%", maxWidth: "900px", margin: "0 auto",
        fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl",
        backgroundColor: INVOICE.bg, color: INVOICE.text,
        padding: "60px", boxSizing: "border-box",
        borderRadius: "12px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${INVOICE.brand}`, marginBottom: "40px", paddingBottom: "30px" }}>
        <div>
          <div style={{ fontSize: "32px", fontWeight: "bold", color: INVOICE.brand, fontFamily: "Georgia, serif" }}>11</div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", fontWeight: "bold", color: INVOICE.brand }}>ELEVEN</div>
          <div style={{ fontSize: "12px", color: INVOICE.muted, marginTop: "12px" }}>{storeAddress}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "12px", color: INVOICE.brand, letterSpacing: "2px", fontWeight: "bold", marginBottom: "8px" }}>INVOICE</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: INVOICE.text }}>#{order.orderNumber}</div>
          <div style={{ fontSize: "12px", color: INVOICE.muted, marginTop: "8px" }}>{formattedDate}</div>
        </div>
      </div>

      {/* Customer + Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", borderBottom: `1px solid ${INVOICE.divider}`, paddingBottom: "30px", marginBottom: "30px" }}>
        <div>
          <h4 style={{ color: INVOICE.text, marginBottom: "12px", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>العميل</h4>
          <div style={{ fontWeight: "bold" }}>{order.shippingAddress?.fullName || order.shippingAddress?.name || "-"}</div>
          <div style={{ color: INVOICE.muted, fontSize: "13px" }}>{order.shippingAddress?.phone || "-"}</div>
          <div style={{ color: INVOICE.muted, fontSize: "13px" }}>{order.shippingAddress?.city} — {order.shippingAddress?.address}</div>
        </div>
        <div>
          <h4 style={{ color: INVOICE.text, marginBottom: "12px", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>حالة الطلب</h4>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: INVOICE.brand, backgroundColor: INVOICE.brandTint, padding: "8px 14px", borderRadius: "6px", display: "inline-block", border: `1px solid ${INVOICE.brandBorder}` }}>
            {statusLabel}
          </div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: INVOICE.muted }}>
            {PAYMENT_MAP[order.paymentMethod] || order.paymentMethod}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${INVOICE.brand}`, backgroundColor: INVOICE.brandTint }}>
            {["المنتج", "الكمية", "السعر", "المجموع"].map((h, i) => (
              <th key={h} style={{ padding: "14px 12px", fontSize: "12px", fontWeight: "bold", textAlign: i === 0 ? "right" : "center", ...(i === 3 ? { textAlign: "left" } : {}) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item: any, idx: number) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${INVOICE.divider}` }}>
              <td style={{ padding: "14px 12px", fontSize: "14px" }}>{item.name}</td>
              <td style={{ padding: "14px 12px", textAlign: "center", fontSize: "14px", color: INVOICE.muted }}>{item.quantity}</td>
              <td style={{ padding: "14px 12px", textAlign: "center", fontSize: "14px", color: INVOICE.muted }}>{formatNumber(item.price)} ج.س</td>
              <td style={{ padding: "14px 12px", textAlign: "left", fontSize: "14px", fontWeight: "bold" }}>{formatNumber(item.price * item.quantity)} ج.س</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ maxWidth: "300px", marginRight: "auto" }}>
        {[
          { label: "المجموع الفرعي", value: `${formatNumber(subtotal)} ج.س` },
          { label: "الشحن", value: shippingFee === 0 ? "مجاني" : `${formatNumber(shippingFee)} ج.س` },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${INVOICE.divider}`, fontSize: "14px" }}>
            <span style={{ color: INVOICE.muted }}>{r.label}</span>
            <span style={{ fontWeight: "bold" }}>{r.value}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px", background: INVOICE.brandTint, borderRadius: "8px", border: `2px solid ${INVOICE.brand}`, marginTop: "12px" }}>
          <span style={{ fontWeight: "bold", fontSize: "15px" }}>الإجمالي</span>
          <span style={{ fontWeight: "bold", fontSize: "22px", color: INVOICE.brand }}>{formatNumber(total)} ج.س</span>
        </div>
      </div>

      {/* QR */}
      <div style={{ marginTop: "50px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", borderTop: `1px solid ${INVOICE.divider}`, paddingTop: "40px" }}>
        <div style={{ background: INVOICE.surface, padding: "14px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: `1px solid ${INVOICE.divider}` }}>
          <QRCodeSVG value={verifyUrl} size={110} />
        </div>
        <p style={{ color: INVOICE.text, fontSize: "12px", fontWeight: "bold", margin: 0 }}>تحقق من صحة الطلب عبر مسح الرمز</p>
        <p style={{ fontSize: "12px", color: INVOICE.muted, margin: 0 }}>شكراً لتسوقكم من {storeName}</p>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const [, params] = useRoute("/order/:id");
  const orderId = params?.id;
  const { user } = useAuth();
  const { data: order, isLoading } = trpc.firestore.getOrder.useQuery(
    { id: orderId || "" },
    { enabled: !!orderId && !!user }
  );
  const { data: storeSettings } = trpc.firestore.getStoreSettings.useQuery();

  if (isLoading) return <Layout><div className="flex justify-center items-center py-40"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div></Layout>;

  if (!order) return (
    <Layout>
      <div className="container py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4" style={{ fontFamily: "Georgia, serif" }}>الطلب غير موجود</h2>
        <Link href="/orders"><a><Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2"><ChevronLeft className="w-5 h-5" />العودة لطلباتي</Button></a></Link>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="container py-10 max-w-3xl">
        {/* ✅ إصلاح: أُزيلت بطاقة/رأس الصفحة بالكامل (رقم الطلب، الشارة، التاريخ)
            التي كانت تسبق الفاتورة — الصفحة الآن تبدأ مباشرة بمحتوى الفاتورة
            نفسها لتطابق تصميم الموقع دون أي عنصر مكرر أعلاها. يبقى رابط
            العودة فقط للتنقل. */}
        <Link href="/orders">
          <a className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-semibold text-sm mb-4">
            <ChevronLeft className="w-4 h-4" /> العودة للطلبات
          </a>
        </Link>

        <Card className="border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <InvoicePrint order={order} storeSettings={storeSettings} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center mt-6">
          <Button onClick={() => window.print()} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2">
            <Printer className="w-5 h-5" /> طباعة الفاتورة
          </Button>
        </div>
      </div>
    </Layout>
  );
}
