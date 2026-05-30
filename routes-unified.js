/**
 * ============================================================
 * ROUTES-UNIFIED.JS - توحيد جميع الـ Routes في ملف واحد
 * ============================================================
 * 
 * بدلاً من تقسيم الـ Routes على ملفات متعددة، جميع الـ APIs
 * موجودة هنا في مكان واحد سهل الصيانة والتطوير.
 * 
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

// ============================================================
// Middleware للمصادقة والتحقق من الصلاحيات
// ============================================================

const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }
    try {
        const userDoc = await db.collection("users").doc(req.user.uid).get();
        if (!userDoc.exists || !userDoc.data().isAdmin) {
            return res.status(403).json({ error: 'لا توجد صلاحيات كافية' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================================
// 1. PRODUCTS APIs
// ============================================================

/**
 * GET /api/products - جلب المنتجات مع الفلترة والبحث
 */
router.get('/products', async (req, res) => {
    try {
        const { categoryId, search, limit = 12, page = 1 } = req.query;
        
        let query = db.collection("products").where("isActive", "==", true);
        
        if (categoryId) {
            query = query.where("categoryId", "==", categoryId);
        }
        
        const snapshot = await query
            .orderBy("createdAt", "desc")
            .limit(parseInt(limit) * parseInt(page))
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
        
        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        products = products.slice(startIndex, startIndex + parseInt(limit));
        
        res.json({
            success: true,
            products,
            count: products.length,
            page: parseInt(page)
        });
    } catch (error) {
        logger.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/products/:productId - جلب منتج واحد
 */
router.get('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const doc = await db.collection('products').doc(productId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }
        
        res.json({
            success: true,
            product: { id: doc.id, ...doc.data() }
        });
    } catch (error) {
        logger.error('Error fetching product:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/products - إنشاء منتج جديد (أدمن فقط)
 */
router.post('/products', requireAdmin, async (req, res) => {
    try {
        const { name, description, price, image, categoryId, stock } = req.body;
        
        if (!name || !price || !categoryId) {
            return res.status(400).json({ error: 'البيانات المطلوبة ناقصة' });
        }
        
        const productRef = await db.collection('products').add({
            name,
            description: description || '',
            price: parseFloat(price),
            image: image || '/public/images/placeholder.png',
            categoryId,
            stock: parseInt(stock) || 0,
            isActive: true,
            isFeatured: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            message: 'تم إنشاء المنتج بنجاح',
            productId: productRef.id
        });
    } catch (error) {
        logger.error('Error creating product:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/products/:productId - تحديث منتج (أدمن فقط)
 */
router.patch('/products/:productId', requireAdmin, async (req, res) => {
    try {
        const { productId } = req.params;
        const updates = req.body;
        
        // تصفية الحقول المسموح بتحديثها
        const allowedFields = ['name', 'description', 'price', 'image', 'categoryId', 'stock', 'isActive', 'isFeatured', 'discount'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });
        
        filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await db.collection('products').doc(productId).update(filteredUpdates);
        
        res.json({
            success: true,
            message: 'تم تحديث المنتج بنجاح'
        });
    } catch (error) {
        logger.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/products/:productId - حذف منتج (أدمن فقط)
 */
router.delete('/products/:productId', requireAdmin, async (req, res) => {
    try {
        const { productId } = req.params;
        await db.collection('products').doc(productId).delete();
        
        res.json({
            success: true,
            message: 'تم حذف المنتج بنجاح'
        });
    } catch (error) {
        logger.error('Error deleting product:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 2. CATEGORIES APIs
// ============================================================

/**
 * GET /api/categories - جلب جميع الفئات
 */
router.get('/categories', async (req, res) => {
    try {
        const snapshot = await db.collection('categories')
            .where('isActive', '==', true)
            .orderBy('order', 'asc')
            .get();
        
        const categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({ success: true, categories });
    } catch (error) {
        logger.error('Error fetching categories:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/categories/:categoryId - جلب فئة واحدة
 */
router.get('/categories/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const doc = await db.collection('categories').doc(categoryId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'الفئة غير موجودة' });
        }
        
        res.json({
            success: true,
            category: { id: doc.id, ...doc.data() }
        });
    } catch (error) {
        logger.error('Error fetching category:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/categories - إنشاء فئة جديدة (أدمن فقط)
 */
router.post('/categories', requireAdmin, async (req, res) => {
    try {
        const { name, icon, color, order } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'اسم الفئة مطلوب' });
        }
        
        const categoryRef = await db.collection('categories').add({
            name,
            icon: icon || 'fas fa-tag',
            color: color || '#c9a24d',
            order: parseInt(order) || 0,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            message: 'تم إنشاء الفئة بنجاح',
            categoryId: categoryRef.id
        });
    } catch (error) {
        logger.error('Error creating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 3. ORDERS APIs
// ============================================================

/**
 * POST /api/orders - إنشاء طلب جديد (آمن)
 */
router.post('/orders', requireAuth, async (req, res) => {
    try {
        const { items, address, phone, userName } = req.body;
        const userId = req.user.uid;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }
        
        if (!address || !phone || !userName) {
            return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن' });
        }
        
        // حماية ضد التكرار
        const recentOrders = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        
        if (!recentOrders.empty) {
            const lastOrder = recentOrders.docs[0].data();
            const lastOrderTime = lastOrder.createdAt?.toDate?.() || new Date(0);
            const now = new Date();
            if (now - lastOrderTime < 30000) {
                return res.status(429).json({ error: 'يرجى الانتظار قليلاً قبل إرسال طلب آخر' });
            }
        }
        
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        let finalOrderData = null;
        
        await db.runTransaction(async (transaction) => {
            let subtotal = 0;
            const verifiedItems = [];
            
            // جلب الإعدادات
            const settingsDoc = await transaction.get(db.collection('settings').doc('store'));
            const settings = settingsDoc.exists ? settingsDoc.data() : {};
            const freeShippingLimit = settings.freeShippingLimit || 20000;
            const defaultShippingCost = settings.shippingCost || 2000;
            
            // التحقق من المنتجات والأسعار والمخزون
            for (const item of items) {
                const productRef = db.collection('products').doc(item.id);
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists) {
                    throw new Error(`المنتج ${item.id} غير موجود`);
                }
                
                const product = productDoc.data();
                
                if (product.stock < item.quantity) {
                    throw new Error(`المخزون غير كافي للمنتج ${product.name}`);
                }
                
                const itemTotal = product.price * item.quantity;
                subtotal += itemTotal;
                
                verifiedItems.push({
                    id: item.id,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity,
                    total: itemTotal
                });
                
                // خصم المخزون
                transaction.update(productRef, {
                    stock: admin.firestore.FieldValue.increment(-item.quantity)
                });
            }
            
            // حساب الشحن
            const shippingCost = subtotal >= freeShippingLimit ? 0 : defaultShippingCost;
            const total = subtotal + shippingCost;
            
            // إنشاء الطلب
            finalOrderData = {
                orderId,
                userId,
                items: verifiedItems,
                subtotal,
                shippingCost,
                total,
                address,
                phone,
                userName,
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            const orderRef = db.collection('orders').doc();
            transaction.set(orderRef, finalOrderData);
        });
        
        res.json({
            success: true,
            message: 'تم إنشاء الطلب بنجاح',
            order: finalOrderData
        });
    } catch (error) {
        logger.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/orders - جلب طلبات المستخدم
 */
router.get('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({ success: true, orders });
    } catch (error) {
        logger.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/orders/:orderId - جلب طلب واحد
 */
router.get('/orders/:orderId', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const doc = await db.collection('orders').doc(orderId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }
        
        const order = doc.data();
        
        // التحقق من أن الطلب يخص المستخدم الحالي
        if (order.userId !== req.user.uid) {
            return res.status(403).json({ error: 'لا توجد صلاحيات' });
        }
        
        res.json({
            success: true,
            order: { id: doc.id, ...order }
        });
    } catch (error) {
        logger.error('Error fetching order:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/orders/:orderId - تحديث حالة الطلب (أدمن فقط)
 */
router.patch('/orders/:orderId', requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صحيحة' });
        }
        
        await db.collection('orders').doc(orderId).update({
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            message: 'تم تحديث حالة الطلب بنجاح'
        });
    } catch (error) {
        logger.error('Error updating order:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 4. SETTINGS APIs
// ============================================================

/**
 * GET /api/settings - جلب إعدادات المتجر
 */
router.get('/settings', async (req, res) => {
    try {
        const doc = await db.collection('settings').doc('store').get();
        
        if (!doc.exists) {
            return res.json({
                success: true,
                settings: {
                    storeName: 'Eleven Store',
                    storeCurrency: 'SDG',
                    theme: { primaryColor: '#c9a24d', secondaryColor: '#a88b3d' }
                }
            });
        }
        
        res.json({ success: true, settings: doc.data() });
    } catch (error) {
        logger.error('Error fetching settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/settings - تحديث الإعدادات (أدمن فقط)
 */
router.patch('/settings', requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        
        // تصفية الحقول المسموح بتحديثها
        const allowedUpdates = [
            'storeName', 'storeCurrency', 'theme', 'shippingCost',
            'freeShippingLimit', 'contactEmail', 'contactPhone', 'address', 'logoUrl'
        ];
        
        const filteredUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });
        
        filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await db.collection('settings').doc('store').set(filteredUpdates, { merge: true });
        
        res.json({
            success: true,
            message: 'تم تحديث الإعدادات بنجاح'
        });
    } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 5. SEARCH API
// ============================================================

/**
 * GET /api/search - بحث متقدم في المنتجات
 */
router.get('/search', async (req, res) => {
    try {
        const { q, category, minPrice, maxPrice } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'يجب إدخال كلمة بحث على الأقل' });
        }
        
        let query = db.collection('products').where('isActive', '==', true);
        
        if (category) {
            query = query.where('categoryId', '==', category);
        }
        
        const snapshot = await query.limit(50).get();
        
        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // البحث المحلي
        const searchLower = q.toLowerCase();
        products = products.filter(p => {
            const nameMatch = p.name?.toLowerCase().includes(searchLower);
            const descMatch = p.description?.toLowerCase().includes(searchLower);
            const priceMatch = (!minPrice || p.price >= minPrice) && (!maxPrice || p.price <= maxPrice);
            return (nameMatch || descMatch) && priceMatch;
        });
        
        res.json({
            success: true,
            query: q,
            results: products,
            count: products.length
        });
    } catch (error) {
        logger.error('Error searching products:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
