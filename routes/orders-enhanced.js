const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const authMiddleware = require('../middleware/auth-enhanced')(db, admin);
    const { requireAuth, requireAdmin } = authMiddleware;

    /**
     * حساب إجمالي الطلب قبل الإنشاء
     */
    router.post('/calculate-session', async (req, res) => {
        try {
            const { items } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'السلة فارغة' });
            }

            let subtotal = 0;
            const verifiedItems = [];
            
            const settings = await dataService.getStoreSettings();
            const freeShippingLimit = settings.freeShippingLimit || 20000;
            const defaultShippingCost = settings.shippingCost || 2000;

            for (const item of items) {
                const productData = await dataService.getProductById(item.id);
                
                if (!productData) {
                    return res.status(404).json({ error: `المنتج ${item.id} غير موجود` });
                }
                
                if (!productData.isActive) {
                    return res.status(400).json({ error: `المنتج ${productData.name} غير متاح حالياً` });
                }
                if (productData.stock < item.quantity) {
                    return res.status(400).json({ error: `المنتج ${productData.name} غير متوفر بالكمية المطلوبة. المتاح: ${productData.stock}` });
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
            }

            const shippingCost = subtotal >= freeShippingLimit ? 0 : defaultShippingCost;
            const total = subtotal + shippingCost;

            res.json({
                success: true,
                items: verifiedItems,
                subtotal: subtotal,
                shippingCost: shippingCost,
                total: total,
                freeShippingLimit: freeShippingLimit,
                freeShippingApplied: subtotal >= freeShippingLimit
            });
        } catch (error) {
            console.error('Error calculating order:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * إنشاء طلب جديد من السلة
     */
    router.post('/create-session', async (req, res) => {
        try {
            const { items, address, phone, userName, email } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'السلة فارغة' });
            }

            if (!address || !phone || !userName) {
                return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن' });
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
                    userId: req.user?.uid || null,
                    guestEmail: !req.user ? email : null,
                    items: verifiedItems,
                    subtotal,
                    shippingCost,
                    total,
                    address,
                    phone,
                    userName,
                    status: 'pending',
                    paymentStatus: 'unpaid',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    orderId: orderId
                });

                if (req.user) {
                    const cartRef = db.collection('carts').doc(req.user.uid);
                    transaction.set(cartRef, {
                        items: [],
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            });

            res.json({ 
                success: true, 
                orderId: orderRef.id, 
                orderNumber: orderId,
                message: 'تم إنشاء الطلب بنجاح' 
            });
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(400).json({ error: error.message });
        }
    });

    /**
     * جلب طلبات المستخدم الحالي
     */
    router.get('/my-orders', requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const orders = await dataService.getUserOrders(userId);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            console.error('Error fetching user orders:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * جلب تفاصيل طلب واحد
     */
    router.get('/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) {
                return res.status(404).json({ error: 'الطلب غير موجود' });
            }

            const orderData = orderDoc.data();

            if (req.user && req.user.uid !== orderData.userId) {
                const userData = await dataService.getUserData(req.user.uid);
                if (!userData || !userData.isAdmin) {
                    return res.status(403).json({ error: 'لا توجد صلاحيات كافية' });
                }
            }

            res.json({
                success: true,
                data: {
                    id: orderDoc.id,
                    ...orderData,
                    createdAt: orderData.createdAt?.toDate?.() || new Date()
                }
            });
        } catch (error) {
            console.error('Error fetching order:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};