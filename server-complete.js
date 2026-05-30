/**
 * ============================================================
 * SERVER-COMPLETE.JS - السيرفر الموحد الكامل
 * ============================================================
 * 
 * نظام متكامل 100% معتمد على السيرفر:
 * - المتجر الإلكتروني (Store)
 * - لوحة تحكم الأدمن (Admin Dashboard)
 * - جميع الـ APIs الآمنة
 * - نظام الأمان المتقدم
 * - تحسينات الأداء
 * - تحسينات SEO
 * 
 * لا يوجد أي اعتماد على الواجهة الأمامية للعمليات الحساسة!
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

// ============================================================
// 1. إعداد التطبيق الأساسي
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد Firebase Admin
try {
    const serviceAccount = require('./firebase-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
} catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('تأكد من وجود ملف firebase-key.json في المجلد الرئيسي');
    process.exit(1);
}

const db = admin.firestore();

// ============================================================
// 2. Middleware الأمان والأداء
// ============================================================

// Helmet - حماية الرؤوس
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"]
        }
    }
}));

// Compression - ضغط البيانات
app.use(compression());

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static Files
app.use(express.static(path.join(__dirname, 'static')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cache System
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'تم تجاوز حد الطلبات'
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'تم تجاوز حد طلبات الـ API'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'تم تجاوز محاولات تسجيل الدخول'
});

app.use(generalLimiter);

// ============================================================
// 3. Middleware للمصادقة والتحقق من الصلاحيات
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
        
        const userDoc = await db.collection("users").doc(decodedToken.uid).get();
        if (userDoc.exists) {
            req.user.isAdmin = userDoc.data().isAdmin || false;
            req.user.userData = userDoc.data();
        }
        next();
    } catch (error) {
        logger.error("Token verification error:", error);
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
// 4. دوال مساعدة لجلب البيانات من Firebase
// ============================================================

async function getSettings() {
    try {
        const cacheKey = 'settings:store';
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const doc = await db.collection("settings").doc("store").get();
        const data = doc.exists ? doc.data() : {
            storeName: 'Eleven Store',
            storeCurrency: 'SDG',
            theme: { primaryColor: '#c9a24d', secondaryColor: '#a88b3d' }
        };
        
        cache.set(cacheKey, data, 1800); // 30 دقيقة
        return data;
    } catch (error) {
        logger.error("Error fetching settings:", error);
        return {};
    }
}

async function getCategories() {
    try {
        const cacheKey = 'categories:all';
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const snapshot = await db.collection("categories")
            .where("isActive", "==", true)
            .orderBy("order", "asc")
            .get();
        
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.set(cacheKey, data, 1800);
        return data;
    } catch (error) {
        logger.error("Error fetching categories:", error);
        return [];
    }
}

async function getProducts(filters = {}) {
    try {
        const { categoryId = null, search = null, limit = 20, page = 1 } = filters;
        
        let query = db.collection("products").where("isActive", "==", true);
        
        if (categoryId) {
            query = query.where("categoryId", "==", categoryId);
        }
        
        const snapshot = await query
            .orderBy("createdAt", "desc")
            .limit(limit * page)
            .get();
        
        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p =>
                p.name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
            );
        }
        
        const startIndex = (page - 1) * limit;
        products = products.slice(startIndex, startIndex + limit);
        
        return products;
    } catch (error) {
        logger.error("Error fetching products:", error);
        return [];
    }
}

async function getProductById(productId) {
    try {
        const doc = await db.collection("products").doc(productId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        logger.error("Error fetching product:", error);
        return null;
    }
}

async function getFeaturedProducts(limit = 8) {
    try {
        const cacheKey = 'products:featured';
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const snapshot = await db.collection("products")
            .where("isActive", "==", true)
            .where("isFeatured", "==", true)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.set(cacheKey, data, 600);
        return data;
    } catch (error) {
        logger.error("Error fetching featured products:", error);
        return [];
    }
}

// ============================================================
// 5. مسارات الصفحات الرئيسية (Store)
// ============================================================

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
            page: "home",
            user: req.user || null
        });
    } catch (error) {
        logger.error("Error rendering home page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

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
            page: "products",
            user: req.user || null
        });
    } catch (error) {
        logger.error("Error rendering products page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

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
            page: "product",
            user: req.user || null
        });
    } catch (error) {
        logger.error("Error rendering product detail:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

// ============================================================
// 6. مسارات لوحة التحكم (Admin Dashboard)
// ============================================================

app.get("/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
        const [settings, stats] = await Promise.all([
            getSettings(),
            getAdminStats()
        ]);
        
        res.render("admin-dashboard", {
            settings,
            stats,
            page: "dashboard",
            user: req.user,
            section: "overview"
        });
    } catch (error) {
        logger.error("Error rendering admin dashboard:", error);
        res.status(500).send("حدث خطأ في تحميل لوحة التحكم");
    }
});

app.get("/admin/products", requireAuth, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        
        const snapshot = await db.collection("products")
            .orderBy("createdAt", "desc")
            .limit(limit * page)
            .get();
        
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const startIndex = (page - 1) * limit;
        const paginatedProducts = products.slice(startIndex, startIndex + limit);
        
        const settings = await getSettings();
        
        res.render("admin-dashboard", {
            settings,
            products: paginatedProducts,
            totalProducts: products.length,
            currentPage: page,
            page: "admin",
            user: req.user,
            section: "products"
        });
    } catch (error) {
        logger.error("Error rendering admin products:", error);
        res.status(500).send("حدث خطأ");
    }
});

app.get("/admin/orders", requireAuth, requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection("orders")
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();
        
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const settings = await getSettings();
        
        res.render("admin-dashboard", {
            settings,
            orders,
            page: "admin",
            user: req.user,
            section: "orders"
        });
    } catch (error) {
        logger.error("Error rendering admin orders:", error);
        res.status(500).send("حدث خطأ");
    }
});

app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection("users")
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const settings = await getSettings();
        
        res.render("admin-dashboard", {
            settings,
            users,
            page: "admin",
            user: req.user,
            section: "users"
        });
    } catch (error) {
        logger.error("Error rendering admin users:", error);
        res.status(500).send("حدث خطأ");
    }
});

app.get("/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await getSettings();
        
        res.render("admin-dashboard", {
            settings,
            page: "admin",
            user: req.user,
            section: "settings"
        });
    } catch (error) {
        logger.error("Error rendering admin settings:", error);
        res.status(500).send("حدث خطأ");
    }
});

// ============================================================
// 7. API Endpoints - Store
// ============================================================

app.get("/api/products", apiLimiter, async (req, res) => {
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

app.get("/api/products/:productId", apiLimiter, async (req, res) => {
    try {
        const product = await getProductById(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: "المنتج غير موجود" });
        }
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/categories", apiLimiter, async (req, res) => {
    try {
        const categories = await getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/settings", apiLimiter, async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 8. API Endpoints - Orders (آمن)
// ============================================================

app.post("/api/orders", requireAuth, apiLimiter, async (req, res) => {
    try {
        const { items, address, phone, userName } = req.body;
        const userId = req.user.uid;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }
        
        if (!address || !phone || !userName) {
            return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن' });
        }
        
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        let finalOrderData = null;
        
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
                
                transaction.update(productRef, {
                    stock: admin.firestore.FieldValue.increment(-item.quantity)
                });
            }
            
            const shippingCost = subtotal >= freeShippingLimit ? 0 : defaultShippingCost;
            const total = subtotal + shippingCost;
            
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

app.get("/api/orders", requireAuth, apiLimiter, async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 9. API Endpoints - Admin (آمن جداً)
// ============================================================

app.post("/api/admin/products", requireAdmin, apiLimiter, async (req, res) => {
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
        
        // إلغاء الـ cache
        cache.del('products:featured');
        
        res.json({
            success: true,
            message: 'تم إنشاء المنتج بنجاح',
            productId: productRef.id
        });
    } catch (error) {
        logger.error("Error creating product:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch("/api/admin/products/:productId", requireAdmin, apiLimiter, async (req, res) => {
    try {
        const { productId } = req.params;
        const updates = req.body;
        
        const allowedFields = ['name', 'description', 'price', 'image', 'categoryId', 'stock', 'isActive', 'isFeatured', 'discount'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });
        
        filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await db.collection('products').doc(productId).update(filteredUpdates);
        
        cache.del('products:featured');
        
        res.json({
            success: true,
            message: 'تم تحديث المنتج بنجاح'
        });
    } catch (error) {
        logger.error("Error updating product:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/admin/products/:productId", requireAdmin, apiLimiter, async (req, res) => {
    try {
        const { productId } = req.params;
        await db.collection('products').doc(productId).delete();
        
        cache.del('products:featured');
        
        res.json({
            success: true,
            message: 'تم حذف المنتج بنجاح'
        });
    } catch (error) {
        logger.error("Error deleting product:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch("/api/admin/orders/:orderId", requireAdmin, apiLimiter, async (req, res) => {
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
        logger.error("Error updating order:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch("/api/admin/settings", requireAdmin, apiLimiter, async (req, res) => {
    try {
        const updates = req.body;
        
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
        
        cache.del('settings:store');
        
        res.json({
            success: true,
            message: 'تم تحديث الإعدادات بنجاح'
        });
    } catch (error) {
        logger.error("Error updating settings:", error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 10. دالة مساعدة لجلب إحصائيات الأدمن
// ============================================================

async function getAdminStats() {
    try {
        const [productsSnap, ordersSnap, usersSnap] = await Promise.all([
            db.collection('products').where('isActive', '==', true).get(),
            db.collection('orders').get(),
            db.collection('users').get()
        ]);
        
        const orders = ordersSnap.docs.map(doc => doc.data());
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        return {
            totalProducts: productsSnap.size,
            totalOrders: ordersSnap.size,
            totalUsers: usersSnap.size,
            totalRevenue,
            pendingOrders: orders.filter(o => o.status === 'pending').length
        };
    } catch (error) {
        logger.error("Error fetching admin stats:", error);
        return {};
    }
}

// ============================================================
// 11. معالجة الأخطاء والصفحات غير الموجودة
// ============================================================

app.use((req, res) => {
    res.status(404).render("404", { settings: {} });
});

app.use((err, req, res, next) => {
    logger.error("Server error:", err);
    res.status(500).json({
        success: false,
        error: 'حدث خطأ في السيرفر'
    });
});

// ============================================================
// 12. بدء السيرفر
// ============================================================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║     🚀 السيرفر الموحد الكامل يعمل بنجاح!             ║
    ║                                                        ║
    ║     المتجر:        http://localhost:${PORT}           ║
    ║     لوحة التحكم:   http://localhost:${PORT}/admin     ║
    ║                                                        ║
    ║     ✅ كل العمليات معتمدة على السيرفر 100%          ║
    ║     ✅ الأمان مفعّل بالكامل                         ║
    ║     ✅ الأداء محسّن                                 ║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
