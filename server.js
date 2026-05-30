const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const admin = require("firebase-admin");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

// تهيئة Firebase Admin
try {
    const serviceAccountPath = path.join(__dirname, "queen-beauty-b811b-firebase-adminsdk-fbsvc-91e9e1bf26.json");
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: "queen-beauty-b811b.appspot.com"
        });
    } else {
        // لبيئات النشر مثل Render/Heroku
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    }
} catch (e) {
    console.error("Firebase Admin Error:", e.message);
}

const app = express();

// إعدادات المحرك
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "eleven-store-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, "static")));

// Middleware للتحقق من المستخدم
app.use(async (req, res, next) => {
    const sessionCookie = req.cookies.session || "";
    // منطق التحقق من الجلسة يمكن توسيعه هنا
    next();
});

// المسارات
app.use("/", require("./routes/index"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/categories", require("./routes/categories"));

// معالجة 404
app.use((req, res) => {
    res.status(404).render("404", { settings: {}, title: "404 - غير موجود" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
