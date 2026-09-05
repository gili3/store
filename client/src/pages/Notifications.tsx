import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Bell, BellRing, CheckCircle2, Truck, Tag, Gift, Trash2, Check, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { enablePushNotifications, getCurrentPermissionState } from "@/lib/push";
import { trpc } from "@/lib/trpc";
import { useNotifications } from "@/hooks/useNotifications";
import { COLORS } from "@/lib/colors";
import type { AppNotification, NotificationType } from "@shared/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// نفس الخمسة ألوان المعتمدة لحالات الطلب بالضبط (COLORS.state) — لا يوجد
// لون منفصل لأي نوع إشعار، فقط تخصيص أيقونة + نفس الألوان الموحّدة.
const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; bg: string; fg: string }> = {
  order: { icon: CheckCircle2, bg: COLORS.state.blueBg, fg: COLORS.state.blueFg },
  shipping: { icon: Truck, bg: COLORS.state.greenBg, fg: COLORS.state.greenFg },
  promo: { icon: Tag, bg: COLORS.state.orangeBg, fg: COLORS.state.orangeFg },
  welcome: { icon: Gift, bg: COLORS.neutral[100], fg: COLORS.textSecondary },
  general: { icon: Bell, bg: COLORS.neutral[100], fg: COLORS.textSecondary },
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 30) return `منذ ${days} يوم`;
  return `منذ ${Math.floor(days / 30)} شهر`;
}

function dayLabel(date: Date): string {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
}

/** يجمّع الإشعارات (المرتّبة أصلاً من الأحدث للأقدم) تحت عناوين تاريخ. */
function groupByDay(items: AppNotification[]): Array<{ label: string; items: AppNotification[] }> {
  const groups: Array<{ label: string; items: AppNotification[] }> = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-border animate-pulse">
      <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 w-2/3 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-2.5 w-1/4 rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Bell className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">لا توجد إشعارات بعد</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        ستظهر هنا أي تحديثات عن طلباتك أو عروض المتجر فور وصولها.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: COLORS.state.redBg }}
      >
        <AlertTriangle className="w-7 h-7" style={{ color: COLORS.state.redFg }} />
      </div>
      <h3 className="font-semibold text-foreground mb-1">تعذّر تحميل الإشعارات</h3>
      <p className="text-sm text-muted-foreground mb-4">تحقق من اتصالك بالإنترنت وحاول مجدداً.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>إعادة المحاولة</Button>
    </div>
  );
}

/** بطاقة إشعار قابلة للسحب لليسار/اليمين للحذف — نفس تفاعل تطبيق الأندرويد. */
function NotificationCard({
  notification,
  onOpen,
  onDelete,
}: {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onDelete: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const background = useTransform(x, [-120, 0, 120], [COLORS.state.redBg, "rgba(0,0,0,0)", COLORS.state.redBg]);
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.general;
  const Icon = config.icon;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      <motion.div
        className="absolute inset-0 flex items-center justify-between px-6"
        style={{ background }}
      >
        <Trash2 className="w-5 h-5" style={{ color: COLORS.state.redFg }} />
        <Trash2 className="w-5 h-5" style={{ color: COLORS.state.redFg }} />
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 100) onDelete(notification.id);
        }}
        onClick={() => onOpen(notification)}
        className="relative bg-card border border-border rounded-2xl p-4 flex items-start gap-3 cursor-pointer active:cursor-grabbing"
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: config.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: config.fg }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm truncate ${notification.isRead ? "font-medium" : "font-bold"} text-foreground`}>
              {notification.title}
            </p>
            {!notification.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="غير مقروء" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
          <p className="text-xs text-muted-foreground/70 mt-1.5">{timeAgo(notification.createdAt)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="حذف الإشعار"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const updateFcmToken = trpc.firestore.updateFcmToken.useMutation();
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead, remove, removeAll } =
    useNotifications();
  const [permission, setPermission] = useState(getCurrentPermissionState());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const groups = useMemo(() => groupByDay(notifications), [notifications]);

  const handleOpen = (n: AppNotification) => {
    if (!n.isRead) markRead(n.id);
    if (n.actionRoute) window.location.assign(n.actionRoute);
  };

  const handleEnablePush = async () => {
    const result = await enablePushNotifications(updateFcmToken);
    setPermission(getCurrentPermissionState());
    if (result.ok) toast.success("تم تفعيل الإشعارات بنجاح");
    else if (result.reason === "denied") toast.error("تم رفض إذن الإشعارات — يمكنك تفعيله من إعدادات المتصفح");
    else if (result.reason === "save-failed")
      toast.error("تم منح الإذن لكن تعذّر حفظه بالسيرفر — أعد المحاولة بعد لحظات");
    else toast.error("تعذّر تفعيل الإشعارات، حاول مجدداً");
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">سجّل الدخول لعرض إشعاراتك</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <BellRing className="w-6 h-6" />
            الإشعارات
            {unreadCount > 0 && (
              <span className="text-sm font-medium text-muted-foreground">({unreadCount} غير مقروء)</span>
            )}
          </h1>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs gap-1">
                  <Check className="w-3.5 h-3.5" /> تحديد الكل كمقروء
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteAll(true)}
                className="text-xs gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف الكل
              </Button>
            </div>
          )}
        </div>

        {permission !== "granted" && permission !== "unsupported" && (
          <div className="mb-4 p-4 rounded-2xl border border-border bg-muted/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Bell className="w-5 h-5 text-foreground shrink-0" />
              <p className="text-sm text-foreground">
                فعّل الإشعارات لتصلك تحديثات طلباتك فوراً حتى لو الموقع مغلق.
              </p>
            </div>
            <Button size="sm" onClick={handleEnablePush} className="shrink-0">تفعيل</Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <NotificationSkeleton key={i} />)}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => window.location.reload()} />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">{group.label}</p>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {group.items.map((n) => (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <NotificationCard notification={n} onOpen={handleOpen} onDelete={remove} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف كل الإشعارات؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف كل الإشعارات نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeAll();
                setConfirmDeleteAll(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
