/**
 * ============================================================
 * PERFORMANCE-ENHANCED.JS - تحسينات الأداء الفائقة
 * ============================================================
 * 
 * يحتوي على:
 * 1. نظام التخزين المؤقت الذكي (Smart Caching)
 * 2. ضغط البيانات (Compression)
 * 3. تحسين الصور (Image Optimization)
 * 4. تقليل حجم الملفات (Minification)
 * 5. تحميل كسول (Lazy Loading)
 * 
 * ============================================================
 */

const compression = require('compression');
const NodeCache = require('node-cache');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// ============================================================
// 1. نظام التخزين المؤقت الذكي (Smart Caching)
// ============================================================

/**
 * إنشاء نظام cache محلي
 * stdTTL: 600 ثانية (10 دقائق)
 * checkperiod: 120 ثانية
 */
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

/**
 * دالة للحصول على بيانات من الـ cache أو من قاعدة البيانات
 */
const getCachedData = async (key, fetchFunction, ttl = 600) => {
    // البحث في الـ cache
    const cachedData = cache.get(key);
    if (cachedData) {
        console.log(`[CACHE HIT] ${key}`);
        return cachedData;
    }
    
    // إذا لم تكن موجودة، جلبها من قاعدة البيانات
    console.log(`[CACHE MISS] ${key} - Fetching from database`);
    const data = await fetchFunction();
    
    // حفظها في الـ cache
    cache.set(key, data, ttl);
    return data;
};

/**
 * حذف البيانات من الـ cache (عند التحديث)
 */
const invalidateCache = (keys) => {
    if (Array.isArray(keys)) {
        keys.forEach(key => cache.del(key));
    } else {
        cache.del(keys);
    }
    console.log(`[CACHE INVALIDATED] ${Array.isArray(keys) ? keys.join(', ') : keys}`);
};

/**
 * حذف جميع البيانات من الـ cache
 */
const clearAllCache = () => {
    cache.flushAll();
    console.log('[CACHE CLEARED] All cache data has been cleared');
};

/**
 * الحصول على إحصائيات الـ cache
 */
const getCacheStats = () => {
    return cache.getStats();
};

// ============================================================
// 2. ضغط البيانات (Compression)
// ============================================================

/**
 * إعداد ضغط Gzip
 */
const compressionConfig = compression({
    level: 6, // مستوى الضغط (1-9)
    threshold: 1024, // ضغط الملفات التي حجمها أكبر من 1KB
    filter: (req, res) => {
        // لا تضغط الصور والملفات الثنائية
        if (req.headers['content-type']?.includes('image')) {
            return false;
        }
        return compression.filter(req, res);
    }
});

// ============================================================
// 3. تحسين الصور (Image Optimization)
// ============================================================

/**
 * تحويل الصورة إلى WebP وتصغير حجمها
 */
const optimizeImage = async (inputPath, outputPath, options = {}) => {
    try {
        const {
            width = 800,
            height = 600,
            quality = 80,
            format = 'webp'
        } = options;
        
        let transformer = sharp(inputPath);
        
        // تصغير الحجم
        if (width || height) {
            transformer = transformer.resize(width, height, {
                fit: 'cover',
                position: 'center'
            });
        }
        
        // تحويل الصيغة وضبط الجودة
        if (format === 'webp') {
            transformer = transformer.webp({ quality });
        } else if (format === 'jpeg') {
            transformer = transformer.jpeg({ quality });
        } else if (format === 'png') {
            transformer = transformer.png({ quality });
        }
        
        await transformer.toFile(outputPath);
        
        console.log(`[IMAGE OPTIMIZED] ${inputPath} -> ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error('Image optimization error:', error);
        return null;
    }
};

/**
 * توليد عدة نسخ من الصورة بأحجام مختلفة (Responsive Images)
 */
const generateResponsiveImages = async (inputPath, outputDir) => {
    try {
        const sizes = [
            { width: 300, height: 300, name: 'sm' },
            { width: 600, height: 600, name: 'md' },
            { width: 1200, height: 1200, name: 'lg' }
        ];
        
        const results = [];
        
        for (const size of sizes) {
            const outputPath = path.join(outputDir, `image-${size.name}.webp`);
            await optimizeImage(inputPath, outputPath, {
                width: size.width,
                height: size.height,
                format: 'webp'
            });
            results.push({
                size: size.name,
                path: outputPath
            });
        }
        
        return results;
    } catch (error) {
        console.error('Responsive images generation error:', error);
        return [];
    }
};

// ============================================================
// 4. Middleware للأداء
// ============================================================

/**
 * إضافة رؤوس الأداء والـ Cache Control
 */
const performanceHeaders = (req, res, next) => {
    // تحديد مدة التخزين المؤقت للملفات الثابتة
    if (req.path.startsWith('/static') || req.path.startsWith('/public')) {
        res.set('Cache-Control', 'public, max-age=31536000'); // سنة واحدة
    } else if (req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
        res.set('Cache-Control', 'public, max-age=3600'); // ساعة واحدة
    }
    
    // تقليل حجم الـ payload
    res.set('Content-Encoding', 'gzip');
    
    next();
};

/**
 * Middleware لقياس وقت الاستجابة
 */
const responseTimeLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[RESPONSE TIME] ${req.method} ${req.path} - ${duration}ms`);
        
        // تنبيه إذا كانت الاستجابة بطيئة
        if (duration > 1000) {
            console.warn(`[SLOW RESPONSE] ${req.method} ${req.path} took ${duration}ms`);
        }
    });
    
    next();
};

// ============================================================
// 5. تحسين استعلامات قاعدة البيانات
// ============================================================

/**
 * دالة لإضافة Indexes على قاعدة البيانات Firebase
 * (يجب تطبيقها يدوياً في Firebase Console)
 */
const firebaseIndexes = {
    products: [
        { field: 'isActive', order: 'ASCENDING' },
        { field: 'createdAt', order: 'DESCENDING' },
        { field: 'categoryId', order: 'ASCENDING' },
        { field: 'isFeatured', order: 'ASCENDING' }
    ],
    orders: [
        { field: 'userId', order: 'ASCENDING' },
        { field: 'createdAt', order: 'DESCENDING' },
        { field: 'status', order: 'ASCENDING' }
    ],
    categories: [
        { field: 'isActive', order: 'ASCENDING' },
        { field: 'order', order: 'ASCENDING' }
    ]
};

// ============================================================
// 6. Lazy Loading للصور
// ============================================================

/**
 * إنشاء HTML لصورة مع Lazy Loading
 */
const createLazyImage = (src, alt, className = '') => {
    return `
        <img 
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3C/svg%3E"
            data-src="${src}"
            alt="${alt}"
            class="lazy-image ${className}"
            loading="lazy"
        />
    `;
};

/**
 * JavaScript لتحميل الصور الكسول
 */
const lazyLoadingScript = `
<script>
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('.lazy-image').forEach(img => imageObserver.observe(img));
    }
</script>
`;

// ============================================================
// 7. تقليل حجم CSS و JavaScript
// ============================================================

/**
 * دالة لتقليل حجم CSS (Minification)
 */
const minifyCSS = (css) => {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '') // حذف التعليقات
        .replace(/\s+/g, ' ') // تقليل الفراغات
        .replace(/\s*([{}:;,])\s*/g, '$1') // حذف الفراغات حول الأقواس
        .trim();
};

/**
 * دالة لتقليل حجم JavaScript (Minification)
 */
const minifyJS = (js) => {
    return js
        .replace(/\/\/.*$/gm, '') // حذف التعليقات
        .replace(/\/\*[\s\S]*?\*\//g, '') // حذف التعليقات متعددة الأسطر
        .replace(/\s+/g, ' ') // تقليل الفراغات
        .replace(/\s*([{}:;,=])\s*/g, '$1') // حذف الفراغات حول الأقواس
        .trim();
};

// ============================================================
// 8. CDN Configuration
// ============================================================

/**
 * إعدادات CDN للملفات الثابتة
 */
const cdnConfig = {
    // استخدم CDN عام لملفات المكتبات الشهيرة
    libraries: {
        jquery: 'https://code.jquery.com/jquery-3.6.0.min.js',
        bootstrap: 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
        fontAwesome: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
    },
    
    // استخدم CDN خاص للصور والملفات الثابتة
    customCDN: process.env.CDN_URL || 'https://cdn.example.com'
};

// ============================================================
// Export
// ============================================================

module.exports = {
    // Caching
    cache,
    getCachedData,
    invalidateCache,
    clearAllCache,
    getCacheStats,
    
    // Compression
    compressionConfig,
    
    // Image Optimization
    optimizeImage,
    generateResponsiveImages,
    
    // Middleware
    performanceHeaders,
    responseTimeLogger,
    
    // Database
    firebaseIndexes,
    
    // Lazy Loading
    createLazyImage,
    lazyLoadingScript,
    
    // Minification
    minifyCSS,
    minifyJS,
    
    // CDN
    cdnConfig
};
