const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

const { requireAuth } = require('../middleware/auth');

/**
 * إنشاء طلب جديد باستخدام Firestore Transaction
 * POST /api/orders
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { items, address, phone, userName } = req.body;
        const userId = req.user.uid; // استخدام المعرف من التوكن الموثق

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }

        if (!address || !phone || !userName) {
            return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن' });
        }

        // حماية ضد التكرار: التحقق من وجود طلب مماثل في آخر 30 ثانية
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
        const orderRef = db.collection('orders').doc();

        let finalOrderData = null;

        await db.runTransaction(async (transaction) => {
            let subtotal = 0;
            const verifiedItems = [];
            
            // جلب الإعدادات لحساب الشحن
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
                
                const productData = productDoc.data();
                if (!productData.isActive) {
                    throw new Error(`المنتج ${productData.name} غير متاح حالياً`);
                }
                
                if (productData.stock < item.quantity) {
                    throw new Error(`المنتج ${productData.name} غير متوفر بالكمية المطلوبة`);
                }

                const itemPrice = productData.price || 0;
                subtotal += itemPrice * item.quantity;
                
                verifiedItems.push({
                    id: item.id,
                    name: productData.name,
                    price: itemPrice,
                    quantity: item.quantity,
                    image: productData.images?.[0] || productData.image || ''
                });

                // تحديث المخزون
                transaction.update(productRef, { 
                    stock: productData.stock - item.quantity,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            const shippingCost = subtotal >= freeShippingLimit ? 0 : defaultShippingCost;
            const total = subtotal + shippingCost;

            finalOrderData = {
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
            };

            transaction.set(orderRef, finalOrderData);
        });

        res.json({ success: true, orderId: orderRef.id, orderNumber: orderId });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * جلب طلبات المستخدم
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
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
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب تفاصيل طلب واحد
 */
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const doc = await db.collection('orders').doc(orderId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        res.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date()
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: error.message });
    }
});

const { requireAdmin } = require('../middleware/auth');

/**
 * تحديث حالة الطلب (للأدمن فقط)
 */
router.patch('/:orderId', requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صالحة' });
        }

        const orderRef = db.collection('orders').doc(orderId);

        await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) {
                throw new Error('الطلب غير موجود');
            }

            const currentData = orderDoc.data();
            
            if (status === 'cancelled' && currentData.status !== 'cancelled') {
                for (const item of currentData.items) {
                    const productRef = db.collection('products').doc(item.id);
                    transaction.update(productRef, {
                        stock: admin.firestore.FieldValue.increment(item.quantity)
                    });
                }
            }
            else if (currentData.status === 'cancelled' && status !== 'cancelled') {
                for (const item of currentData.items) {
                    const productRef = db.collection('products').doc(item.id);
                    const productDoc = await transaction.get(productRef);
                    if (productDoc.exists && productDoc.data().stock < item.quantity) {
                        throw new Error(`لا يمكن تفعيل الطلب، المنتج ${productDoc.data().name} نفد من المخزون`);
                    }
                    transaction.update(productRef, {
                        stock: admin.firestore.FieldValue.increment(-item.quantity)
                    });
                }
            }

            transaction.update(orderRef, {
                status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        res.json({ success: true, message: 'تم تحديث الطلب بنجاح' });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * رفع إيصال الدفع وتحديث حالة الطلب (للمستخدم صاحب الطلب)
 * POST /api/orders/:orderId/receipt
 */
router.post('/:orderId/receipt', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { receiptUrl } = req.body;

        if (!receiptUrl) {
            return res.status(400).json({ error: 'رابط الإيصال مطلوب' });
        }

        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        const orderData = orderDoc.data();
        if (orderData.userId !== req.user.uid) {
            return res.status(403).json({ error: 'غير مصرح لك بتحديث هذا الطلب' });
        }

        await orderRef.update({
            receiptUrl,
            status: 'paid',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'تم رفع الإيصال بنجاح' });
    } catch (error) {
        console.error('Error uploading receipt:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * حساب تكلفة الطلب
 */
router.post('/calculate', async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'بيانات غير صالحة' });
        }

        let subtotal = 0;
        for (const item of items) {
            const productDoc = await db.collection('products').doc(item.id).get();
            if (productDoc.exists) {
                subtotal += (productDoc.data().price || 0) * (item.quantity || 1);
            }
        }

        const settingsDoc = await db.collection('settings').doc('store').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const freeShippingLimit = settings.freeShippingLimit || 20000;
        const shippingCost = subtotal < freeShippingLimit ? (settings.shippingCost || 2000) : 0;

        res.json({
            subtotal,
            shippingCost,
            total: subtotal + shippingCost
        });
    } catch (error) {
        console.error('Error calculating order:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
