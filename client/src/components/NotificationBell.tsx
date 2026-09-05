import { Bell } from "lucide-react";
import { Link } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * جرس الإشعارات بالهيدر — عدّاد غير المقروء لحظي (real-time)، بدون أي polling.
 */
export default function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <Link href="/notifications">
      <a
        className="relative p-2 text-foreground hover:text-primary transition-colors hover:bg-accent/5 rounded-lg"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </a>
    </Link>
  );
}
