const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const admin = require("firebase-admin");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// تهيئة Firebase Admin
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "queen-beauty-b811b.appspot.com"
            });
        } else {
            admin.initializeApp({
                projectId: "queen-beauty-b811b",
                storageBucket: "queen-beauty-b811b.appspot.com"
            });
        }
        console.log("✅ Firebase Admin initialized successfully");
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error.message);
    }
}

const db = admin.firestore();
const dataService = require("./services/dataService")(db, admin);

// إعدادات الأمان والأداء
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "https://firebasestorage.googleapis.com"],
            connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://*.firebasestorage.googleapis.com", "wss://*.firebaseio.com"],
            frameAncestors: ["'none'"]
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
}));

app.use(cors({
    origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "http://localhost:3000",
    credentials: true
}));

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "لقد تجاوزت الحد الأقصى للطلبات، يرجى المحاولة مرة أخرى بعد 15 دقيقة."
});
app.use("/api/auth", apiLimiter);

// إعدادات الجلسة
app.use(session({
    secret: process.env.SESSION_SECRET || "eleven-store-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// خدمة الملفات الثابتة - استخدام Asset Handler
const assetHandler = require("./middleware/assetHandler");
assetHandler(app);

// Fallback static serving
app.use(express.static(path.join(__dirname, "static")));

// إعداد محرك القوالب EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ربط المسارات (Routes)
const indexRoutes = require("./routes/index")(dataService, db, admin);
const apiAuthRoutes = require("./routes/auth-enhanced")(dataService, db, admin);
const apiAdminRoutes = require("./routes/admin")(dataService, db, admin);
const apiProductRoutes = require("./routes/products")(dataService);
const imageProcessorRoutes = require("./routes/image-processor")(dataService);
const cartRoutes = require("./routes/cart-enhanced")(dataService, db, admin);
const checkoutRoutes = require("./routes/checkout")(dataService, db, admin);
const userRoutes = require("./routes/user")(dataService, db, admin);
const categoryRoutes = require("./routes/categories")(dataService);
const settingsRoutes = require("./routes/settings")(dataService, db, admin);
const orderRoutes = require("./routes/orders-enhanced")(dataService, db, admin);

// مسارات الويب
app.use("/", indexRoutes);

// مسارات API
app.use("/api/auth", apiAuthRoutes);
app.use("/api/admin", apiAdminRoutes);
app.use("/api/products", apiProductRoutes);
app.use("/api/image", imageProcessorRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/user", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/orders", orderRoutes);

// التعامل مع 404
app.use((req, res) => {
    res.status(404).render("404", { title: "404 - غير موجود", settings: {} });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error("Server Error:", err);
    res.status(500).json({ 
        success: false, 
        error: process.env.NODE_ENV === "production" ? "حدث خطأ في السيرفر" : err.message 
    });
});

// بدء السيرفر
app.listen(PORT, () => {
    console.log(`
🚀 سيرفر متجر إليفن يعمل بنجاح!
📍 الرابط: http://localhost:${PORT}
🔐 وضع التشغيل: ${process.env.NODE_ENV || "development"}
    `);
});