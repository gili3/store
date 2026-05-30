const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * قاموس الأخطاء الإملائية الشائعة في العربية
 * يساعد في البحث عن المنتجات حتى مع الأخطاء الشائعة
 */
const arabicSpellingMap = {
    'ا': ['ا', 'أ', 'إ', 'آ'],
    'ي': ['ي', 'ى'],
    'ه': ['ه', 'ة'],
    'ء': ['ء', 'ؤ', 'ئ'],
    'و': ['و', 'ؤ'],
    'ع': ['ع', 'غ'],
    'ح': ['ح', 'خ'],
    'ص': ['ص', 'س'],
    'ط': ['ط', 'ت'],
    'ض': ['ض', 'د'],
    'ظ': ['ظ', 'ذ'],
    'ق': ['ق', 'غ'],
    'ك': ['ك', 'ق'],
    'ل': ['ل', 'ا'],
    'ن': ['ن', 'م'],
    'ب': ['ب', 'ت', 'ث'],
};

/**
 * تطبيع النص العربي لتحسين البحث
 * يزيل التشكيل والرموز الخاصة
 */
function normalizeArabicText(text) {
    if (!text) return '';
    return String(text)
        .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
        .replace(/[إأٱآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ؤئ]/g, 'ء')
        .toLowerCase()
        .trim();
}

/**
 * إنشاء متغيرات بحث بديلة للتعامل مع الأخطاء الإملائية
 */
function generateSearchVariations(query) {
    const normalized = normalizeArabicText(query);
    const variations = new Set([normalized]);
    
    // إضافة متغيرات بديلة للأحرف الشائعة
    let variant = normalized;
    for (const [key, values] of Object.entries(arabicSpellingMap)) {
        for (const alt of values) {
            if (variant.includes(alt)) {
                const newVariant = variant.replace(new RegExp(alt, 'g'), key);
                variations.add(newVariant);
            }
        }
    }
    
    return Array.from(variations);
}

/**
 * جلب جميع المنتجات النشطة مع البحث والتصفية في قاعدة البيانات
 * GET /api/products/search-advanced
 * Query Parameters:
 *   - q: كلمة البحث (اختياري)
 *   - category: معرف الفئة (اختياري)
 *   - sort: ترتيب النتائج (newest, price-asc, price-desc, popular)
 *   - limit: عدد النتائج (افتراضي: 20، أقصى: 100)
 *   - page: رقم الصفحة (افتراضي: 1)
 */
router.get('/search-advanced', async (req, res) => {
    try {
        const { q, category, sort = 'newest', limit = 20, page = 1 } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const offset = (pageNum - 1) * limitNum;

        let query = db.collection('products').where('isActive', '==', true);

        // تطبيق فلتر الفئة
        if (category && category !== 'all') {
            query = query.where('categoryId', '==', category);
        }

        // تطبيق الترتيب
        switch (sort) {
            case 'price-asc':
                query = query.orderBy('price', 'asc');
                break;
            case 'price-desc':
                query = query.orderBy('price', 'desc');
                break;
            case 'popular':
                query = query.orderBy('salesCount', 'desc').orderBy('createdAt', 'desc');
                break;
            case 'newest':
            default:
                query = query.orderBy('createdAt', 'desc');
        }

        // الحصول على المنتجات من قاعدة البيانات
        const snapshot = await query.limit(offset + limitNum).get();
        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // تطبيق البحث المحلي إذا كانت هناك كلمة بحث
        if (q && q.trim().length >= 2) {
            const searchVariations = generateSearchVariations(q);
            const normalizedQuery = normalizeArabicText(q);
            
            products = products.filter(product => {
                if (!product || !product.name) return false;

                const name = normalizeArabicText(product.name || '');
                const desc = normalizeArabicText(product.description || '');
                const brand = normalizeArabicText(product.brand || '');
                const keywords = (product.keywords || []).map(k => normalizeArabicText(k));

                // البحث في الاسم والوصف والعلامة التجارية
                const directMatch = (
                    name.includes(normalizedQuery) ||
                    desc.includes(normalizedQuery) ||
                    brand.includes(normalizedQuery) ||
                    keywords.some(k => k.includes(normalizedQuery))
                );

                // البحث مع متغيرات الأخطاء الإملائية
                const variationMatch = searchVariations.some(variation =>
                    name.includes(variation) ||
                    desc.includes(variation) ||
                    brand.includes(variation) ||
                    keywords.some(k => k.includes(variation))
                );

                return directMatch || variationMatch;
            });
        }

        // تطبيق الـ pagination
        const paginatedProducts = products.slice(offset, offset + limitNum);

        res.json({
            products: paginatedProducts,
            count: paginatedProducts.length,
            total: products.length,
            page: pageNum,
            limit: limitNum,
            hasMore: (offset + limitNum) < products.length
        });
    } catch (error) {
        console.error('❌ خطأ في البحث المتقدم:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب جميع المنتجات النشطة (الطريقة الأصلية - محسّنة)
 * GET /api/products
 */
router.get('/', async (req, res) => {
    try {
        const { category, search, limit = 20, page = 1 } = req.query;

        let query = db.collection('products').where('isActive', '==', true);

        if (category && category !== 'all') {
            query = query.where('categoryId', '==', category);
        }

        const snapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit))
            .offset((parseInt(page) - 1) * parseInt(limit))
            .get();

        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // البحث المحلي (محسّن)
        if (search && search.trim().length >= 2) {
            const searchVariations = generateSearchVariations(search);
            const normalizedSearch = normalizeArabicText(search);
            
            products = products.filter(p => {
                if (!p || !p.name) return false;

                const name = normalizeArabicText(p.name || '');
                const desc = normalizeArabicText(p.description || '');

                return searchVariations.some(variation =>
                    name.includes(variation) ||
                    desc.includes(variation)
                ) || name.includes(normalizedSearch) || desc.includes(normalizedSearch);
            });
        }

        res.json({
            products,
            count: products.length,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('❌ خطأ في جلب المنتجات:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب منتج واحد
 * GET /api/products/:productId
 */
router.get('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const doc = await db.collection('products').doc(productId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        res.json({
            id: doc.id,
            ...doc.data()
        });
    } catch (error) {
        console.error('❌ خطأ في جلب المنتج:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب المنتجات المميزة
 * GET /api/products/featured
 */
router.get('/featured', async (req, res) => {
    try {
        const snapshot = await db.collection('products')
            .where('isActive', '==', true)
            .where('isFeatured', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ products });
    } catch (error) {
        console.error('❌ خطأ في جلب المنتجات المميزة:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * البحث عن المنتجات (الطريقة الأصلية - محسّنة)
 * GET /api/products/search?q=keyword
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'يجب إدخال كلمة بحث بطول 2 أحرف على الأقل' });
        }

        const snapshot = await db.collection('products')
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const searchVariations = generateSearchVariations(q);
        const normalizedQuery = normalizeArabicText(q);

        const products = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => {
                if (!p || !p.name) return false;

                const name = normalizeArabicText(p.name || '');
                const desc = normalizeArabicText(p.description || '');
                const keywords = (p.keywords || []).map(k => normalizeArabicText(k));

                return searchVariations.some(variation =>
                    name.includes(variation) ||
                    desc.includes(variation) ||
                    keywords.some(k => k.includes(variation))
                ) || name.includes(normalizedQuery) || desc.includes(normalizedQuery);
            })
            .slice(0, 20);

        res.json({ products, count: products.length });
    } catch (error) {
        console.error('❌ خطأ في البحث:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
