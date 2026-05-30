/**
 * ============================================================
 * SERVER.JS - نسخة محسّنة ومركزية
 * ============================================================
 * 
 * الهدف: توحيد كل المنطق البرمجي في السيرفر
 * - جلب البيانات من Firebase وإرسالها مع الصفحة (SSR)
 * - إدارة جميع الـ APIs بشكل آمن
 * - تقليل حجم JavaScript في الواجهة الأمامية
 * 
 * ============================================================
 */

const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// ============================================================
// 1. إعداد التطبيق والـ Middleware
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// إعداد Firebase Admin
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================
// 2. Middleware للمصادقة والتحقق من الصلاحيات
// ============================================================
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        if (db) {
            const userDoc = await db.collection("users").doc(decodedToken.uid).get();
            if (userDoc.exists) {
                req.user.isAdmin = userDoc.data().isAdmin || false;
            }
        }
        next();
    } catch (error) {
        next();
    }
};

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

app.use(authenticateUser);

// ============================================================
// 3. دوال مساعدة لجلب البيانات من Firebase
// ============================================================

/**
 * جلب إعدادات المتجر
 */
async function getSettings() {
    try {
        const doc = await db.collection("settings").doc("store").get();
        return doc.exists ? doc.data() : {
            storeName: 'Eleven Store',
            storeCurrency: 'SDG',
            theme: { primaryColor: '#c9a24d', secondaryColor: '#a88b3d' }
        };
    } catch (error) {
        logger.error("Error fetching settings:", error);
        return {};
    }
}

/**
 * جلب الفئات النشطة
 */
async function getCategories() {
    try {
        const snapshot = await db.collection("categories")
            .where("isActive", "==", true)
            .orderBy("order", "asc")
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error("Error fetching categories:", error);
        return [];
    }
}

/**
 * جلب المنتجات مع الفلترة والبحث
 */
async function getProducts(filters = {}) {
    try {
        const { categoryId = null, search = null, limit = 20, page = 1 } = filters;
        
        let query = db.collection("products").where("isActive", "==", true);
        
        if (categoryId) {
            query = query.where("categoryId", "==", categoryId);
        }
        
        // جلب المنتجات مع الترتيب والحد
        const snapshot = await query
            .orderBy("createdAt", "desc")
            .limit(limit * page)
            .get();
        
        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // البحث المحلي (بعد جلب البيانات)
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p =>
                p.name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
            );
        }
        
        // تطبيق الـ Pagination
        const startIndex = (page - 1) * limit;
        products = products.slice(startIndex, startIndex + limit);
        
        return products;
    } catch (error) {
        logger.error("Error fetching products:", error);
        return [];
    }
}

/**
 * جلب منتج واحد بناءً على الـ ID
 */
async function getProductById(productId) {
    try {
        const doc = await db.collection("products").doc(productId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        logger.error("Error fetching product:", error);
        return null;
    }
}

/**
 * جلب أحدث المنتجات (للصفحة الرئيسية)
 */
async function getFeaturedProducts(limit = 8) {
    try {
        const snapshot = await db.collection("products")
            .where("isActive", "==", true)
            .where("isFeatured", "==", true)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error("Error fetching featured products:", error);
        return [];
    }
}

// ============================================================
// 4. مسارات الصفحات الرئيسية (SSR - Server-Side Rendering)
// ============================================================

/**
 * الصفحة الرئيسية
 */
app.get("/", async (req, res) => {
    try {
        const [settings, categories, featuredProducts] = await Promise.all([
            getSettings(),
            getCategories(),
            getFeaturedProducts(8)
        ]);
        
        res.render("index", {
            settings,
            categories,
            featuredProducts,
            page: "home"
        });
    } catch (error) {
        logger.error("Error rendering home page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

/**
 * صفحة المنتجات
 */
app.get("/products", async (req, res) => {
    try {
        const categoryId = req.query.category || null;
        const search = req.query.search || null;
        const page = parseInt(req.query.page) || 1;
        
        const [settings, categories, products] = await Promise.all([
            getSettings(),
            getCategories(),
            getProducts({
                categoryId,
                search,
                limit: 12,
                page
            })
        ]);
        
        res.render("products", {
            settings,
            categories,
            products,
            selectedCategory: categoryId,
            searchTerm: search,
            currentPage: page,
            page: "products"
        });
    } catch (error) {
        logger.error("Error rendering products page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

/**
 * صفحة تفاصيل المنتج
 */
app.get("/product/:id", async (req, res) => {
    try {
        const [settings, product] = await Promise.all([
            getSettings(),
            getProductById(req.params.id)
        ]);
        
        if (!product) {
            return res.status(404).render("404", { settings });
        }
        
        res.render("product-detail", {
            settings,
            product,
            page: "product"
        });
    } catch (error) {
        logger.error("Error rendering product detail:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

/**
 * الصفحات الثابتة (SPA)
 */
const staticPages = ["/cart", "/checkout", "/profile", "/my-orders"];
staticPages.forEach(page => {
    app.get(page, (req, res) => {
        res.sendFile(path.join(__dirname, "static", "index.html"));
    });
});

// ============================================================
// 5. API Endpoints - جلب البيانات (للتحديثات الديناميكية)
// ============================================================

/**
 * API: جلب المنتجات (مع الفلترة والبحث)
 * GET /api/products?category=...&search=...&page=...
 */
app.get("/api/products", async (req, res) => {
    try {
        const categoryId = req.query.category || null;
        const search = req.query.search || null;
        const page = parseInt(req.query.page) || 1;
        
        const products = await getProducts({
            categoryId,
            search,
            limit: 12,
            page
        });
        
        res.json({
            success: true,
            products,
            count: products.length,
            page
        });
    } catch (error) {
        logger.error("Error fetching products API:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: جلب منتج واحد
 * GET /api/products/:productId
 */
app.get("/api/products/:productId", async (req, res) => {
    try {
        const product = await getProductById(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: "المنتج غير موجود" });
        }
        res.json({ success: true, product });
    } catch (error) {
        logger.error("Error fetching product API:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: جلب الفئات
 * GET /api/categories
 */
app.get("/api/categories", async (req, res) => {
    try {
        const categories = await getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        logger.error("Error fetching categories API:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: جلب الإعدادات
 * GET /api/settings
 */
app.get("/api/settings", async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ success: true, settings });
    } catch (error) {
        logger.error("Error fetching settings API:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: إنشاء طلب جديد (آمن - يتطلب مصادقة)
 * POST /api/orders
 */
app.post("/api/orders", requireAuth, async (req, res) => {
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
            
            // التحقق من المنتجات والأسعار
            for (const item of items) {
                const productRef = db.collection('products').doc(item.id);
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists) {
                    throw new Error(`المنتج ${item.id} غير موجود`);
                }
                
                const product = productDoc.data();
                
                // التحقق من المخزون
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
        logger.error("Error creating order:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: جلب طلبات المستخدم
 * GET /api/orders
 */
app.get("/api/orders", requireAuth, async (req, res) => {
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
        logger.error("Error fetching orders:", error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 6. معالجة الأخطاء والـ 404
// ============================================================

app.use((req, res) => {
    res.status(404).send("404 - الصفحة غير موجودة");
});

// ============================================================
// 7. بدء السيرفر
// ============================================================

app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
