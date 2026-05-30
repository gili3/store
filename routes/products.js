const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * جلب جميع المنتجات النشطة
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

        // البحث المحلي
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p =>
                p.name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
            );
        }

        res.json({
            products,
            count: products.length,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching products:', error);
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
        console.error('Error fetching product:', error);
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
        console.error('Error fetching featured products:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * البحث عن المنتجات
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

        const searchLower = q.toLowerCase();
        const products = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p =>
                p.name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower) ||
                p.keywords?.some(k => k.toLowerCase().includes(searchLower))
            )
            .slice(0, 20);

        res.json({ products, count: products.length });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
