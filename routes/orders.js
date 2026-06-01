const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * إنشاء طلب جديد باستخدام Firestore Transaction
 * POST /api/orders
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { items, address, phone, userName } = req.body;
        const userId = req.user.uid;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }

        if (!address || !phone || !userName) {
            return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن' });
        }

        // حماية ضد التكرار (30 ثانية)
        const recentOrders = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (!recentOrders.empty) {
            const lastOrder = recentOrders.docs[0].data();
            const lastOrderTime = lastOrder.createdAt?.toDate?.() || new Date(0);
            if (new Date() - lastOrderTime < 30000) {
                return res.status(429).json({ error: 'يرجى الانتظار قليلاً قبل إرسال طلب آخر' });
            }
        }

        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const orderRef = db.collection('orders').doc();

        await db.runTransaction(async (transaction) => {
            let subtotal = 0;
            const verifiedItems = [];
            
            const settingsDoc = await transaction.get(db.collection('settings').doc('store'));
            const settings = settingsDoc.exists ? settingsDoc.data() : {};
            const freeShippingLimit = settings.freeShippingLimit || 20000;
            const defaultShippingCost = settings.shippingCost || 2000;

            for (const item of items) {
                const productRef = db.collection('products').doc(item.id);
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists) throw new Error(`المنتج ${item.id} غير موجود`);
                
                const productData = productDoc.data();
                if (!productData.isActive) throw new Error(`المنتج ${productData.name} غير متاح حالياً`);
                if (productData.stock < item.quantity) throw new Error(`المنتج ${productData.name} غير متوفر بالكمية المطلوبة`);

                const itemPrice = productData.price || 0;
                subtotal += itemPrice * item.quantity;
                
                verifiedItems.push({
                    id: item.id,
                    name: productData.name,
                    price: itemPrice,
                    quantity: item.quantity,
                    image: productData.images?.[0] || productData.image || ''
                });

                transaction.update(productRef, { 
                    stock: productData.stock - item.quantity,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            const shippingCost = subtotal >= freeShippingLimit ? 0 : defaultShippingCost;
            const total = subtotal + shippingCost;

            transaction.set(orderRef, {
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
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                orderId: orderId
            });
        });

        res.json({ success: true, orderId: orderRef.id, orderNumber: orderId });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * حساب تكلفة الطلب (محسن لتقليل قراءات Firestore)
 */
router.post('/calculate', async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'بيانات غير صالحة' });
        }

        const itemIds = items.map(i => i.id);
        // جلب جميع المنتجات دفعة واحدة (بحد أقصى 30 منتج في الاستعلام الواحد لـ Firestore 'in')
        const productChunks = [];
        for (let i = 0; i < itemIds.length; i += 30) {
            productChunks.push(itemIds.slice(i, i + 30));
        }

        let subtotal = 0;
        const verifiedItems = [];
        for (const chunk of productChunks) {
            const snapshot = await db.collection('products').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            snapshot.docs.forEach(doc => {
                const productData = doc.data();
                const item = items.find(i => i.id === doc.id);
                const quantity = item.quantity || 1;
                const price = productData.price || 0;
                
                subtotal += price * quantity;
                verifiedItems.push({
                    id: doc.id,
                    name: productData.name,
                    price: price,
                    quantity: quantity,
                    image: productData.image || productData.images?.[0] || ''
                });
            });
        }

        const settingsDoc = await db.collection('settings').doc('store').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const freeShippingLimit = settings.freeShippingLimit || 20000;
        const shippingCost = subtotal < freeShippingLimit ? (settings.shippingCost || 2000) : 0;

        res.json({ success: true, items: verifiedItems, subtotal, shippingCost, total: subtotal + shippingCost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب طلبات المستخدم (مع حماية البيانات)
 */
router.get('/user/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        if (req.user.uid !== userId && !req.user.isAdmin) {
            return res.status(403).json({ error: 'غير مصرح لك بالوصول لهذه البيانات' });
        }

        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));

        res.json({ orders });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب تفاصيل طلب واحد
 */
router.get('/:orderId', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const doc = await db.collection('orders').doc(orderId).get();

        if (!doc.exists) return res.status(404).json({ error: 'الطلب غير موجود' });
        
        const orderData = doc.data();
        if (orderData.userId !== req.user.uid && !req.user.isAdmin) {
            return res.status(403).json({ error: 'غير مصرح لك بالوصول لهذا الطلب' });
        }

        res.json({ id: doc.id, ...orderData, createdAt: orderData.createdAt?.toDate?.() || new Date() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * تحديث حالة الطلب (للأدمن)
 */
router.patch('/:orderId', requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });

        const orderRef = db.collection('orders').doc(orderId);
        await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) throw new Error('الطلب غير موجود');

            const currentData = orderDoc.data();
            if (status === 'cancelled' && currentData.status !== 'cancelled') {
                for (const item of currentData.items) {
                    transaction.update(db.collection('products').doc(item.id), {
                        stock: admin.firestore.FieldValue.increment(item.quantity)
                    });
                }
            } else if (currentData.status === 'cancelled' && status !== 'cancelled') {
                for (const item of currentData.items) {
                    const productRef = db.collection('products').doc(item.id);
                    const productDoc = await transaction.get(productRef);
                    if (productDoc.exists && productDoc.data().stock < item.quantity) {
                        throw new Error(`المنتج ${productDoc.data().name} نفد من المخزون`);
                    }
                    transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
                }
            }
            transaction.update(orderRef, { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        res.json({ success: true, message: 'تم تحديث الطلب بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * رفع إيصال الدفع
 */
router.post('/:orderId/receipt', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { receiptUrl } = req.body;
        if (!receiptUrl) return res.status(400).json({ error: 'رابط الإيصال مطلوب' });

        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return res.status(404).json({ error: 'الطلب غير موجود' });

        if (orderDoc.data().userId !== req.user.uid) return res.status(403).json({ error: 'غير مصرح لك' });

        await orderRef.update({ receiptUrl, status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ success: true, message: 'تم رفع الإيصال بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
