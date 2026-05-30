const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const admin = require("firebase-admin");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const winston = require("winston");
require("dotenv").config();
const session = require("express-session");

// ============================================================
// 1. إعداد نظام تسجيل الأمان (Security Logging)
// ============================================================

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: "eleven-store-api" },
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/security.log", level: "warn" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

// تهيئة Firebase Admin
let db = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // إذا كان المفتاح مخزناً كـ JSON في متغير بيئة
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: `${serviceAccount.project_id}.appspot.com`
        });
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
        // إذا كانت المتغيرات مفصولة (لبيئة Render)
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            }),
            storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
        });
    } else {
        // الاستخدام المحلي من ملف الـ JSON
        const serviceAccountPath = path.join(__dirname, "queen-beauty-b811b-firebase-adminsdk-fbsvc-91e9e1bf26.json");
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: "queen-beauty-b811b.appspot.com"
            });
        } else {
            throw new Error("Firebase Service Account key not found");
        }
    }
    logger.info("✅ Firebase Admin Initialized Successfully");
    db = admin.firestore();
} catch (e) {
    logger.error("❌ Error initializing Firebase Admin: " + e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد محرك القوالب EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ============================================================
// 2. Middlewares الحماية والأساسية
// ============================================================

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// إعدادات الجلسة
app.use(session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 }
}));

// خدمة الملفات الثابتة مع التخزين المؤقت (Caching)
app.use(express.static(path.join(__dirname, "static"), {
    maxAge: '1d',
    etag: true
}));

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "عدد الطلبات كثير جداً، يرجى المحاولة لاحقاً" }
});
app.use("/api/", generalLimiter);

// Authentication Middleware
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
app.use(authenticateUser);

// ============================================================
// 3. API Endpoints
// ============================================================
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/settings", require("./routes/settings"));

// ============================================================
// 4. مسارات الصفحات (Frontend Routes) - SSR
// ============================================================

// الصفحة الرئيسية
app.get("/", async (req, res) => {
    try {
        const settings = await getSettings();
        const categories = await getCategories();
        res.render("index", { settings, categories, page: "home" });
    } catch (error) {
        logger.error("Error rendering home page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

// صفحة المنتجات
app.get("/products", async (req, res) => {
    try {
        const settings = await getSettings();
        const categories = await getCategories();
        const products = await getProducts(req.query.category);
        res.render("products", { settings, categories, products, page: "products" });
    } catch (error) {
        logger.error("Error rendering products page:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

// صفحة تفاصيل المنتج
app.get("/product/:id", async (req, res) => {
    try {
        const settings = await getSettings();
        const product = await getProductById(req.params.id);
        if (!product) return res.status(404).render("404", { settings });
        res.render("product-detail", { settings, product, page: "product" });
    } catch (error) {
        logger.error("Error rendering product detail:", error);
        res.status(500).send("حدث خطأ في تحميل الصفحة");
    }
});

// مسارات EJS مطابقة تماماً للتصميم الأصلي (1:1)
app.get("/login", async (req, res) => {
    const settings = await getSettings();
    res.render("login", { settings, page: "login" });
});

app.get("/admin", async (req, res) => {
    const settings = await getSettings();
    res.render("admin-dashboard", { settings, page: "admin" });
});

// كافة صفحات المستخدم تعتمد على index.ejs (SPA Architecture)
app.get(["/cart", "/checkout", "/profile", "/my-orders", "/about", "/contact", "/tracking"], async (req, res) => {
    const settings = await getSettings();
    const categories = await getCategories();
    res.render("index", { settings, categories, page: req.path.substring(1) });
});

// مسار 404 (Not Found)
app.use((req, res) => {
    res.status(404).send("404 - الصفحة غير موجودة");
});

// ============================================================
// 5. دوال مساعدة لجلب البيانات من Firebase
// ============================================================

async function getSettings() {
    try {
        if (!db) return {};
        const doc = await db.collection("settings").doc("store").get();
        return doc.exists ? doc.data() : {};
    } catch (error) {
        logger.error("Error fetching settings:", error);
        return {};
    }
}

async function getCategories() {
    try {
        if (!db) return [];
        const snapshot = await db.collection("categories").where("isActive", "==", true).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error("Error fetching categories:", error);
        return [];
    }
}

async function getProducts(categoryId = null) {
    try {
        if (!db) return [];
        let query = db.collection("products").where("isActive", "==", true);
        if (categoryId) query = query.where("categoryId", "==", categoryId);
        const snapshot = await query.orderBy("createdAt", "desc").limit(20).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error("Error fetching products:", error);
        return [];
    }
}

async function getProductById(productId) {
    try {
        if (!db) return null;
        const doc = await db.collection("products").doc(productId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        logger.error("Error fetching product:", error);
        return null;
    }
}

// تشغيل السيرفر
app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
