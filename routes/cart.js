const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * جلب السلة الحالية للمستخدم من Firestore
 * GET /api/cart
 * يتطلب: Authorization Header مع Firebase ID Token
 */
router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
        }

        const userId = req.user.uid;
        const cartDoc = await db.collection('carts').doc(userId).get();
        
        if (!cartDoc.exists) {
            return res.json({ 
                success: true, 
                items: [], 
                subtotal: 0, 
                shipping: 0, 
                total: 0 
            });
        }

        const cartData = cartDoc.data();
        const cartItems = cartData.items || [];

        if (cartItems.length === 0) {
            return res.json({ 
                success: true, 
                items: [], 
                subtotal: 0, 
                shipping: 0, 
                total: 0 
            });
        }

        // جلب بيانات المنتجات من Firestore للتحقق من الأسعار والمخزون
        const productIds = cartItems.map(item => item.id);
        const verifiedItems = [];
        let subtotal = 0;

        // معالجة المنتجات على دفعات (Firestore يسمح بـ 30 منتج في الاستعلام الواحد)
        for (let i = 0; i < productIds.length; i += 30) {
            const chunk = productIds.slice(i, i + 30);
            const snapshot = await db.collection('products')
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();

            snapshot.docs.forEach(doc => {
                const productData = doc.data();
                const cartItem = cartItems.find(item => item.id === doc.id);
                
                if (productData.isActive && productData.stock > 0) {
                    const price = productData.price || 0;
                    const quantity = cartItem.quantity || 1;
                    
                    verifiedItems.push({
                        id: doc.id,
                        name: productData.name,
                        price: price,
                        quantity: quantity,
                        image: productData.image || productData.images?.[0] || '',
                        stock: productData.stock
                    });
                    
                    subtotal += price * quantity;
                }
            });
        }

        // حساب تكلفة التوصيل
        const settingsDoc = await db.collection('settings').doc('store').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const freeShippingLimit = settings.freeShippingLimit || 20000;
        const shipping = subtotal >= freeShippingLimit ? 0 : (settings.shippingCost || 2000);

        res.json({
            success: true,
            items: verifiedItems,
            subtotal: subtotal,
            shipping: shipping,
            total: subtotal + shipping
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * إضافة منتج إلى السلة في Firestore
 * POST /api/cart/add
 * Body: { productId, quantity }
 */
router.post('/add', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
        }

        const userId = req.user.uid;
        const { productId, quantity = 1 } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'معرف المنتج مطلوب' });
        }

        if (quantity <= 0) {
            return res.status(400).json({ error: 'الكمية يجب أن تكون أكبر من صفر' });
        }

        // التحقق من وجود المنتج والمخزون
        const productDoc = await db.collection('products').doc(productId).get();
        
        if (!productDoc.exists) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        const productData = productDoc.data();
        
        if (!productData.isActive) {
            return res.status(400).json({ error: 'المنتج غير متاح حالياً' });
        }

        if (productData.stock < quantity) {
            return res.status(400).json({ error: `المخزون المتاح: ${productData.stock}` });
        }

        // إضافة أو تحديث في السلة في Firestore
        const cartRef = db.collection('carts').doc(userId);
        
        await db.runTransaction(async (transaction) => {
            const cartDoc = await transaction.get(cartRef);
            let cartItems = [];

            if (cartDoc.exists) {
                cartItems = cartDoc.data().items || [];
            }

            // البحث عن المنتج في السلة
            const existingItemIndex = cartItems.findIndex(item => item.id === productId);

            if (existingItemIndex >= 0) {
                // تحديث الكمية
                const newQuantity = cartItems[existingItemIndex].quantity + quantity;
                if (newQuantity > productData.stock) {
                    throw new Error('الكمية المطلوبة تتجاوز المخزون');
                }
                cartItems[existingItemIndex].quantity = newQuantity;
            } else {
                // إضافة منتج جديد
                cartItems.push({
                    id: productId,
                    quantity: quantity,
                    addedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            transaction.set(cartRef, {
                userId: userId,
                items: cartItems,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        res.json({ success: true, message: 'تمت إضافة المنتج بنجاح' });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * تحديث كمية المنتج في السلة
 * PUT /api/cart/update/:productId
 * Body: { quantity }
 */
router.put('/update/:productId', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
        }

        const userId = req.user.uid;
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity === undefined || quantity < 0) {
            return res.status(400).json({ error: 'كمية غير صالحة' });
        }

        const cartRef = db.collection('carts').doc(userId);

        await db.runTransaction(async (transaction) => {
            const cartDoc = await transaction.get(cartRef);

            if (!cartDoc.exists) {
                throw new Error('السلة غير موجودة');
            }

            let cartItems = cartDoc.data().items || [];
            const cartItemIndex = cartItems.findIndex(item => item.id === productId);

            if (cartItemIndex === -1) {
                throw new Error('المنتج غير موجود في السلة');
            }

            // التحقق من المخزون
            const productDoc = await transaction.get(db.collection('products').doc(productId));
            if (!productDoc.exists) {
                throw new Error('المنتج غير موجود');
            }

            const stock = productDoc.data().stock || 0;
            if (quantity > stock && quantity !== 0) {
                throw new Error(`المخزون المتاح: ${stock}`);
            }

            if (quantity === 0) {
                // حذف المنتج إذا كانت الكمية صفر
                cartItems = cartItems.filter(item => item.id !== productId);
            } else {
                cartItems[cartItemIndex].quantity = quantity;
            }

            transaction.set(cartRef, {
                items: cartItems,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        res.json({ success: true, message: 'تم تحديث السلة بنجاح' });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * حذف منتج من السلة
 * DELETE /api/cart/remove/:productId
 */
router.delete('/remove/:productId', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
        }

        const userId = req.user.uid;
        const { productId } = req.params;
        const cartRef = db.collection('carts').doc(userId);

        await db.runTransaction(async (transaction) => {
            const cartDoc = await transaction.get(cartRef);

            if (!cartDoc.exists) {
                throw new Error('السلة غير موجودة');
            }

            let cartItems = cartDoc.data().items || [];
            const initialLength = cartItems.length;
            cartItems = cartItems.filter(item => item.id !== productId);

            if (cartItems.length === initialLength) {
                throw new Error('المنتج غير موجود في السلة');
            }

            transaction.set(cartRef, {
                items: cartItems,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * تفريغ السلة
 * DELETE /api/cart/clear
 */
router.delete('/clear', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
        }

        const userId = req.user.uid;
        const cartRef = db.collection('carts').doc(userId);

        await cartRef.set({
            items: [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.json({ success: true, message: 'تم تفريغ السلة بنجاح' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
