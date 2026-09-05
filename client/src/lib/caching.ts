/**
 * نظام التخزين المؤقت في الذاكرة لتحسين الأداء
 * بدلاً من الاعتماد على localStorage
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * حفظ بيانات في الذاكرة المؤقتة
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * استرجاع بيانات من الذاكرة المؤقتة
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // التحقق من انتهاء صلاحية البيانات
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * حذف بيانات من الذاكرة المؤقتة
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * تفريغ الذاكرة المؤقتة بالكامل
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * حذف جميع البيانات المنتهية الصلاحية
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// إنشاء نسخة واحدة من الـ cache
export const memoryCache = new MemoryCache();

/**
 * تنظيف الـ cache كل 10 دقائق
 */
setInterval(() => {
  memoryCache.cleanup();
}, 10 * 60 * 1000);

/**
 * مفاتيح الـ cache المستخدمة في التطبيق
 */
export const CACHE_KEYS = {
  USER_PROFILE: "user_profile",
  CART_ITEMS: "cart_items",
  FAVORITES: "favorites",
  PRODUCTS: "products",
  CATEGORIES: "categories",
  ADDRESSES: "addresses",
  ORDERS: "orders",
  PRODUCT_DETAIL: (id: string) => `product_detail_${id}`,
} as const;
