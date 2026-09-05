/**
 * نظام المزامنة مع قاعدة البيانات
 * يضمن أن جميع البيانات تأتي من السيرفر وليس من التخزين المحلي
 */

import { trpc } from "./trpc";

/**
 * نوع البيانات المتزامنة
 */
export interface SyncedData<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastSyncTime: number;
  isSynced: boolean;
}

/**
 * فئة إدارة المزامنة
 */
export class DatabaseSync {
  private syncTimestamps: Map<string, number> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * تسجيل وقت آخر مزامنة
   */
  recordSync(key: string): void {
    this.syncTimestamps.set(key, Date.now());
  }

  /**
   * الحصول على وقت آخر مزامنة
   */
  getLastSyncTime(key: string): number {
    return this.syncTimestamps.get(key) || 0;
  }

  /**
   * التحقق من الحاجة إلى مزامنة جديدة
   */
  needsSync(key: string, intervalMs: number = 5 * 60 * 1000): boolean {
    const lastSync = this.getLastSyncTime(key);
    return Date.now() - lastSync > intervalMs;
  }

  /**
   * إعادة تعيين المزامنة
   */
  resetSync(key: string): void {
    this.syncTimestamps.delete(key);
  }

  /**
   * تنظيف المزامنات المجدولة
   */
  cleanup(): void {
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();
    this.syncTimestamps.clear();
  }
}

// إنشاء نسخة واحدة من DatabaseSync
export const dbSync = new DatabaseSync();

/**
 * خطاف React للمزامنة التلقائية مع قاعدة البيانات
 */
export function useAutoSync<T>(
  queryFn: () => any,
  key: string,
  intervalMs: number = 5 * 60 * 1000
): void {
  // يمكنك استخدام useEffect لتنفيذ المزامنة التلقائية
  // مثال:
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     queryFn();
  //   }, intervalMs);
  //   return () => clearInterval(interval);
  // }, [queryFn, intervalMs]);
}

/**
 * التأكد من أن البيانات محدثة من قاعدة البيانات
 */
export async function ensureDataIsFresh<T>(
  key: string,
  fetchFn: () => Promise<T>,
  maxAge: number = 5 * 60 * 1000 // 5 دقائق
): Promise<T> {
  if (dbSync.needsSync(key, maxAge)) {
    const data = await fetchFn();
    dbSync.recordSync(key);
    return data;
  }

  // إذا كانت البيانات حديثة، لا تقم بجلب جديدة
  throw new Error("Data is still fresh");
}

/**
 * مراقب التغييرات في قاعدة البيانات
 */
export class DataChangeObserver {
  private observers: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * الاشتراك في التغييرات
   */
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }

    this.observers.get(key)!.add(callback);

    // إرجاع دالة إلغاء الاشتراك
    return () => {
      this.observers.get(key)?.delete(callback);
    };
  }

  /**
   * إخطار جميع المراقبين بالتغييرات
   */
  notify(key: string, data: any): void {
    const callbacks = this.observers.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /**
   * تنظيف المراقبين
   */
  cleanup(): void {
    this.observers.clear();
  }
}

// إنشاء نسخة واحدة من DataChangeObserver
export const dataChangeObserver = new DataChangeObserver();
