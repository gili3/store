import { Link, useLocation } from "wouter";
import { Home, ShoppingBag, Heart, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * شريط التنقل السفلي - موحّد مع تطبيق Android (5 عناصر مطابقة لـ
 * ElevenStoreBottomNavigation: الرئيسية، المنتجات، المفضلة، السلة، الملف).
 * يظهر فقط على مقاسات الموبايل (md:hidden)، بينما يبقى الـ Header
 * العلوي هو وسيلة التنقل الأساسية على الشاشات الكبيرة، حفاظاً على
 * أفضل تجربة لكل حجم شاشة.
 */
export default function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: cartItems = [] } = trpc.firestore.getCart.useQuery(undefined, {
    enabled: !!user,
  });
  const cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const items = [
    { label: "الرئيسية", href: "/", icon: Home },
    { label: "المنتجات", href: "/products", icon: ShoppingBag },
    { label: "المفضلة", href: "/favorites", icon: Heart },
    { label: "السلة", href: "/cart", icon: ShoppingCart, badge: cartCount },
    { label: "الملف", href: "/profile", icon: User },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <a className={`bottom-nav-item ${isActive ? "active" : ""}`}>
              <span className="relative">
                <Icon className="w-6 h-6" />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -left-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}
