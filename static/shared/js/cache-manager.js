// cache-manager.js - نظام تخزين مؤقت موحد
(function() {
    'use strict';

    if (window.CacheManager) return;

    const CacheManager = {
        memoryCache: new Map(),
        
        set(key, data, ttl = 300000) { // ttl بالمللي ثانية (افتراضي 5 دقائق)
            this.memoryCache.set(key, {
                data: data,
                expires: Date.now() + ttl
            });
            // محاولة حفظ في sessionStorage كنسخة احتياطية
            try {
                const cacheItem = {
                    data: data,
                    expires: Date.now() + ttl
                };
                sessionStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
            } catch(e) {}
        },
        
        get(key) {
            // أولاً من الذاكرة
            const memItem = this.memoryCache.get(key);
            if (memItem && Date.now() < memItem.expires) {
                return memItem.data;
            }
            if (memItem) this.memoryCache.delete(key);
            
            // ثم من sessionStorage
            try {
                const stored = sessionStorage.getItem(`cache_${key}`);
                if (stored) {
                    const item = JSON.parse(stored);
                    if (Date.now() < item.expires) {
                        // إعادة تخزين في الذاكرة
                        this.memoryCache.set(key, item);
                        return item.data;
                    } else {
                        sessionStorage.removeItem(`cache_${key}`);
                    }
                }
            } catch(e) {}
            return null;
        },
        
        clear(key) {
            if (key) {
                this.memoryCache.delete(key);
                sessionStorage.removeItem(`cache_${key}`);
            } else {
                this.memoryCache.clear();
                // مسح كل مفاتيح cache_ من sessionStorage
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    if (k && k.startsWith('cache_')) sessionStorage.removeItem(k);
                }
            }
        },
        
        // دالة مساعدة لتحميل البيانات مع التخزين المؤقت
        async fetchWithCache(key, fetcher, ttl = 300000) {
            const cached = this.get(key);
            if (cached !== null) return cached;
            
            const fresh = await fetcher();
            this.set(key, fresh, ttl);
            return fresh;
        }
    };

    window.CacheManager = CacheManager;
    console.log('✅ Cache Manager initialized');
})();

