const admin = require("firebase-admin");
const db = admin.firestore();

// ==================== CHECKOUT ====================

exports.getCheckoutPage = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect("/login");
        }

        const settings = await db.collection("settings").doc("store").get();
        const storeSettings = settings.exists ? settings.data() : {};
        const categories = await db.collection("categories").where("isActive", "==", true).get();

        // جلب السلة من Firestore
        const cartDoc = await db.collection('carts').doc(req.user.uid).get();
        let cartData = {
            items: [],
            subtotal: 0,
            shipping: 0,
            total: 0
        };

        if (cartDoc.exists) {
            const cartItems = cartDoc.data().items || [];
            
            if (cartItems.length > 0) {
                const productIds = cartItems.map(item => item.id);
                const verifiedItems = [];
                let subtotal = 0;

                for (let i = 0; i < productIds.length; i += 30) {
                    const chunk = productIds.slice(i, i + 30);
                    const snapshot = await db.collection('products')
                        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                        .get();

                    snapshot.docs.forEach(doc => {
                        const productData = doc.data();
                        const cartItem = cartItems.find(item => item.id === doc.id);
                        
                        if (productData.isActive) {
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

                const freeShippingLimit = storeSettings.freeShippingLimit || 20000;
                const shipping = subtotal >= freeShippingLimit ? 0 : (storeSettings.shippingCost || 2000);

                cartData = {
                    items: verifiedItems,
                    subtotal: subtotal,
                    shipping: shipping,
                    total: subtotal + shipping
                };
            }
        }

        // جلب بيانات المستخدم
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        res.render("checkout", {
            settings: storeSettings,
            categories: categories.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            cart: cartData,
            user: req.user,
            userData,
            page: "checkout",
            title: "إتمام الشراء"
        });
    } catch (error) {
        console.error("Checkout Page Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ==================== CREATE ORDER ====================

exports.createOrder = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { shippingAddress, phone, notes, couponCode } = req.body;

        if (!shippingAddress || !phone) {
            return res.status(400).json({ success: false, error: "البيانات المطلوبة ناقصة" });
        }

        // جلب السلة
        const cartDoc = await db.collection('carts').doc(req.user.uid).get();
        
        if (!cartDoc.exists || !cartDoc.data().items || cartDoc.data().items.length === 0) {
            return res.status(400).json({ success: false, error: "السلة فارغة" });
        }

        const cartItems = cartDoc.data().items;
        const productIds = cartItems.map(item => item.id);
        const orderItems = [];
        let subtotal = 0;

        // التحقق من المنتجات والمخزون
        for (let i = 0; i < productIds.length; i += 30) {
            const chunk = productIds.slice(i, i + 30);
            const snapshot = await db.collection('products')
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();

            snapshot.docs.forEach(doc => {
                const productData = doc.data();
                const cartItem = cartItems.find(item => item.id === doc.id);
                
                if (!productData.isActive) {
                    throw new Error(`المنتج ${productData.name} غير متاح`);
                }

                if (productData.stock < cartItem.quantity) {
                    throw new Error(`المخزون غير كافي للمنتج ${productData.name}`);
                }

                const price = productData.price || 0;
                const quantity = cartItem.quantity || 1;
                
                orderItems.push({
                    id: doc.id,
                    name: productData.name,
                    price: price,
                    quantity: quantity,
                    image: productData.image || productData.images?.[0] || ''
                });
                
                subtotal += price * quantity;
            });
        }

        // حساب التوصيل
        const settingsDoc = await db.collection('settings').doc('store').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const freeShippingLimit = settings.freeShippingLimit || 20000;
        const shipping = subtotal >= freeShippingLimit ? 0 : (settings.shippingCost || 2000);

        let discount = 0;
        let couponId = null;

        // التحقق من الكوبون
        if (couponCode) {
            const couponSnapshot = await db.collection('coupons')
                .where('code', '==', couponCode.toUpperCase())
                .where('isActive', '==', true)
                .get();

            if (couponSnapshot.empty) {
                return res.status(400).json({ success: false, error: "الكوبون غير صحيح" });
            }

            const coupon = couponSnapshot.docs[0];
            couponId = coupon.id;
            const couponData = coupon.data();

            // التحقق من صلاحية الكوبون
            if (couponData.expiryDate && new Date(couponData.expiryDate) < new Date()) {
                return res.status(400).json({ success: false, error: "انتهت صلاحية الكوبون" });
            }

            if (couponData.maxUses && couponData.usedCount >= couponData.maxUses) {
                return res.status(400).json({ success: false, error: "تم استنفاد عدد استخدامات الكوبون" });
            }

            // حساب الخصم
            if (couponData.discountType === 'percentage') {
                discount = Math.floor(subtotal * (couponData.discount / 100));
            } else {
                discount = couponData.discount;
            }
        }

        const total = subtotal + shipping - discount;

        // إنشاء الطلب
        const orderData = {
            userId: req.user.uid,
            userEmail: req.user.email,
            items: orderItems,
            subtotal: subtotal,
            shipping: shipping,
            discount: discount,
            couponId: couponId,
            total: total,
            shippingAddress: shippingAddress,
            phone: phone,
            notes: notes || "",
            status: "pending",
            paymentStatus: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const orderRef = await db.collection('orders').add(orderData);

        // تحديث عدد استخدامات الكوبون
        if (couponId) {
            await db.collection('coupons').doc(couponId).update({
                usedCount: admin.firestore.FieldValue.increment(1)
            });
        }

        // تحديث المخزون
        for (const item of orderItems) {
            await db.collection('products').doc(item.id).update({
                stock: admin.firestore.FieldValue.increment(-item.quantity)
            });
        }

        // مسح السلة
        await db.collection('carts').doc(req.user.uid).set({ items: [] });

        res.json({
            success: true,
            message: "تم إنشاء الطلب بنجاح",
            orderId: orderRef.id,
            orderData: orderData
        });
    } catch (error) {
        console.error("Create Order Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET ORDER ====================

exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const orderDoc = await db.collection('orders').doc(id).get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ success: false, error: "الطلب غير موجود" });
        }

        const orderData = orderDoc.data();

        // التحقق من أن المستخدم هو صاحب الطلب أو أدمن
        if (orderData.userId !== req.user?.uid && !req.user?.isAdmin) {
            return res.status(403).json({ success: false, error: "لا توجد صلاحيات" });
        }

        res.json({
            success: true,
            data: { id: orderDoc.id, ...orderData }
        });
    } catch (error) {
        console.error("Get Order Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET USER ORDERS ====================

exports.getUserOrders = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { page = 1, limit = 10 } = req.query;

        const snapshot = await db.collection('orders')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();

        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // الترقيم
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedOrders = orders.slice(startIndex, startIndex + limitNum);

        res.json({
            success: true,
            data: paginatedOrders,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(orders.length / limitNum),
                totalItems: orders.length
            }
        });
    } catch (error) {
        console.error("Get User Orders Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== TRACK ORDER ====================

exports.trackOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const orderDoc = await db.collection('orders').doc(id).get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ success: false, error: "الطلب غير موجود" });
        }

        const orderData = orderDoc.data();

        res.json({
            success: true,
            data: {
                id: orderDoc.id,
                status: orderData.status,
                paymentStatus: orderData.paymentStatus,
                createdAt: orderData.createdAt,
                updatedAt: orderData.updatedAt,
                total: orderData.total,
                items: orderData.items
            }
        });
    } catch (error) {
        console.error("Track Order Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
