const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const authMiddleware = require('../middleware/auth-enhanced')(db, admin);
    const { requireAuth } = authMiddleware;

    /**
     * جلب السلة الحالية
     */
    router.get('/session', async (req, res) => {
        try {
            if (req.user) {
                const userId = req.user.uid;
                const cartData = await dataService.getCart(userId);
                
                if (cartData.items.length === 0) {
                    return res.json({ success: true, items: [], subtotal: 0, shipping: 0, total: 0, source: 'firestore' });
                }

                const verifiedItems = [];
                let subtotal = 0;

                for (const item of cartData.items) {
                    const productData = await dataService.getProductById(item.id);
                    if (productData && productData.isActive && productData.stock > 0) {
                        const price = productData.price || 0;
                        const quantity = item.quantity || 1;
                        verifiedItems.push({
                            id: item.id,
                            name: productData.name,
                            price: price,
                            quantity: quantity,
                            image: productData.image || productData.images?.[0] || '',
                            stock: productData.stock
                        });
                        subtotal += price * quantity;
                    }
                }

                const settings = await dataService.getStoreSettings();
                const freeShippingLimit = settings.freeShippingLimit || 20000;
                const shipping = subtotal >= freeShippingLimit ? 0 : (settings.shippingCost || 2000);

                return res.json({
                    success: true,
                    items: verifiedItems,
                    subtotal: subtotal,
                    shipping: shipping,
                    total: subtotal + shipping,
                    source: 'firestore'
                });
            }

            const sessionCart = req.session.cart || [];
            let subtotal = 0;
            let verifiedItems = [];

            if (sessionCart.length > 0) {
                for (const item of sessionCart) {
                    const productData = await dataService.getProductById(item.id);
                    if (productData && productData.isActive && productData.stock > 0) {
                        const price = productData.price || 0;
                        const quantity = item.quantity || 1;
                        verifiedItems.push({
                            id: item.id,
                            name: productData.name,
                            price: price,
                            quantity: quantity,
                            image: productData.image || productData.images?.[0] || '',
                            stock: productData.stock
                        });
                        subtotal += price * quantity;
                    }
                }
            }

            const settings = await dataService.getStoreSettings();
            const freeShippingLimit = settings.freeShippingLimit || 20000;
            const shipping = subtotal >= freeShippingLimit ? 0 : (settings.shippingCost || 2000);

            res.json({
                success: true,
                items: verifiedItems,
                subtotal: subtotal,
                shipping: shipping,
                total: subtotal + shipping,
                source: 'session'
            });
        } catch (error) {
            console.error('Error fetching cart:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * إضافة منتج إلى السلة
     */
    router.post('/add-session', async (req, res) => {
        try {
            const { productId, quantity = 1 } = req.body;

            if (!productId) return res.status(400).json({ error: 'معرف المنتج مطلوب' });
            if (quantity <= 0) return res.status(400).json({ error: 'الكمية يجب أن تكون أكبر من صفر' });

            const productData = await dataService.getProductById(productId);
            if (!productData) return res.status(404).json({ error: 'المنتج غير موجود' });
            if (!productData.isActive) return res.status(400).json({ error: 'المنتج غير متاح حالياً' });
            if (productData.stock < quantity) return res.status(400).json({ error: `المخزون المتاح: ${productData.stock}` });

            if (req.user) {
                const userId = req.user.uid;
                const cartRef = db.collection('carts').doc(userId);
                
                await db.runTransaction(async (transaction) => {
                    const cartDoc = await transaction.get(cartRef);
                    let cartItems = cartDoc.exists ? (cartDoc.data().items || []) : [];
                    const existingItemIndex = cartItems.findIndex(item => item.id === productId);

                    if (existingItemIndex >= 0) {
                        const newQuantity = cartItems[existingItemIndex].quantity + quantity;
                        if (newQuantity > productData.stock) throw new Error('الكمية المطلوبة تتجاوز المخزون');
                        cartItems[existingItemIndex].quantity = newQuantity;
                    } else {
                        cartItems.push({ id: productId, quantity: quantity, addedAt: admin.firestore.FieldValue.serverTimestamp() });
                    }

                    transaction.set(cartRef, { userId: userId, items: cartItems, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                });

                return res.json({ success: true, message: 'تمت إضافة المنتج بنجاح', source: 'firestore' });
            }

            if (!req.session.cart) req.session.cart = [];
            const existingItemIndex = req.session.cart.findIndex(item => item.id === productId);

            if (existingItemIndex >= 0) {
                const newQuantity = req.session.cart[existingItemIndex].quantity + quantity;
                if (newQuantity > productData.stock) return res.status(400).json({ error: 'الكمية المطلوبة تتجاوز المخزون' });
                req.session.cart[existingItemIndex].quantity = newQuantity;
            } else {
                req.session.cart.push({ id: productId, quantity: quantity });
            }

            res.json({ success: true, message: 'تمت إضافة المنتج بنجاح', source: 'session' });
        } catch (error) {
            console.error('Error adding to cart:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * تحديث كمية المنتج في السلة
     */
    router.put('/update-session/:productId', async (req, res) => {
        try {
            const { productId } = req.params;
            const { quantity } = req.body;

            if (quantity === undefined || quantity < 0) return res.status(400).json({ error: 'كمية غير صالحة' });

            if (req.user) {
                const userId = req.user.uid;
                const cartRef = db.collection('carts').doc(userId);

                await db.runTransaction(async (transaction) => {
                    const cartDoc = await transaction.get(cartRef);
                    if (!cartDoc.exists) throw new Error('السلة غير موجودة');

                    let cartItems = cartDoc.data().items || [];
                    const cartItemIndex = cartItems.findIndex(item => item.id === productId);
                    if (cartItemIndex === -1) throw new Error('المنتج غير موجود في السلة');

                    const productDoc = await transaction.get(db.collection('products').doc(productId));
                    if (!productDoc.exists) throw new Error('المنتج غير موجود');

                    const stock = productDoc.data().stock || 0;
                    if (quantity > stock && quantity !== 0) throw new Error(`المخزون المتاح: ${stock}`);

                    if (quantity === 0) {
                        cartItems = cartItems.filter(item => item.id !== productId);
                    } else {
                        cartItems[cartItemIndex].quantity = quantity;
                    }

                    transaction.set(cartRef, { items: cartItems, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                });

                return res.json({ success: true, message: 'تم تحديث السلة بنجاح', source: 'firestore' });
            }

            if (!req.session.cart) return res.status(400).json({ error: 'السلة فارغة' });
            const cartItemIndex = req.session.cart.findIndex(item => item.id === productId);
            if (cartItemIndex === -1) return res.status(400).json({ error: 'المنتج غير موجود في السلة' });

            if (quantity === 0) {
                req.session.cart = req.session.cart.filter(item => item.id !== productId);
            } else {
                req.session.cart[cartItemIndex].quantity = quantity;
            }

            res.json({ success: true, message: 'تم تحديث السلة بنجاح', source: 'session' });
        } catch (error) {
            console.error('Error updating cart:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * حذف منتج من السلة
     */
    router.delete('/remove-session/:productId', async (req, res) => {
        try {
            const { productId } = req.params;

            if (req.user) {
                const userId = req.user.uid;
                const cartRef = db.collection('carts').doc(userId);

                await db.runTransaction(async (transaction) => {
                    const cartDoc = await transaction.get(cartRef);
                    if (!cartDoc.exists) throw new Error('السلة غير موجودة');

                    let cartItems = cartDoc.data().items || [];
                    const initialLength = cartItems.length;
                    cartItems = cartItems.filter(item => item.id !== productId);
                    if (cartItems.length === initialLength) throw new Error('المنتج غير موجود في السلة');

                    transaction.set(cartRef, { items: cartItems, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                });

                return res.json({ success: true, message: 'تم حذف المنتج بنجاح', source: 'firestore' });
            }

            if (!req.session.cart) return res.status(400).json({ error: 'السلة فارغة' });
            const initialLength = req.session.cart.length;
            req.session.cart = req.session.cart.filter(item => item.id !== productId);
            if (req.session.cart.length === initialLength) return res.status(400).json({ error: 'المنتج غير موجود في السلة' });

            res.json({ success: true, message: 'تم حذف المنتج بنجاح', source: 'session' });
        } catch (error) {
            console.error('Error removing from cart:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};