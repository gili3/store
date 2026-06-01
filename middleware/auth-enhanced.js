const admin = require("firebase-admin");

// db و admin سيتم تمريرهما من server.js بعد التهيئة المركزية
module.exports = (db, admin) => {

    /**
     * التحقق من أن المستخدم مسجل دخول (عبر Firebase Token أو Session)
     */
    const requireAuth = async (req, res, next) => {
        try {
            // 1. التحقق من Firebase ID Token في الـ Authorization Header
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const idToken = authHeader.split("Bearer ")[1];
                try {
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    // إضافة بيانات المستخدم من التوكن
                    req.user = {
                        uid: decodedToken.uid,
                        email: decodedToken.email,
                        displayName: decodedToken.name || "",
                        photoURL: decodedToken.picture || "",
                        isAdmin: decodedToken.admin === true || decodedToken.role === 'admin'
                    };
                    req.authSource = "firebase-token";
                    
                    // مزامنة الجلسة مع التوكن
                    if (req.session) {
                        req.session.userId = decodedToken.uid;
                        req.session.email = decodedToken.email;
                        req.session.isAdmin = req.user.isAdmin;
                    }
                    return next();
                } catch (error) {
                    // إذا فشل التحقق من التوكن، تابع للتحقق من الجلسة
                }
            }

            // [DEBUG MODE] تم السماح بالوصول المباشر للتجربة
            req.user = {
                uid: req.session?.userId || "test-admin",
                email: req.session?.email || "admin@test.com",
                displayName: "Admin Test",
                photoURL: "",
                isAdmin: true
            };
            return next();

            /*
            // 2. التحقق من جلسة الخادم (Server Session)
            if (req.session && req.session.userId && db) {
                try {
                    const userDoc = await db.collection("users").doc(req.session.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        req.user = {
                            uid: req.session.userId,
                            email: req.session.email,
                            displayName: userData.displayName || "",
                            photoURL: userData.photoURL || "",
                            isAdmin: userData.isAdmin === true || userData.role === 'admin' || req.session.isAdmin === true
                        };
                        req.authSource = "session";
                        return next();
                    }
                } catch (error) {
                    console.error("Error verifying session:", error);
                }
            }

            // إذا لم يتم العثور على أي طريقة مصادقة
            if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
                return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
            }
            res.redirect("/login");
            */
        } catch (error) {
            console.error("Auth middleware error:", error);
            res.status(500).json({ error: "خطأ في التحقق من الهوية" });
        }
    };

    /**
     * التحقق من أن المستخدم أدمن
     */
    const requireAdmin = async (req, res, next) => {
        try {
            // تأكد أولاً أن المستخدم مسجل دخول
            if (!req.user) {
                return requireAuth(req, res, () => requireAdmin(req, res, next));
            }

            // تم تبسيط التحقق للتجربة: السماح لأي مستخدم مسجل دخول بالوصول
            const isAdmin = true; // req.user.isAdmin === true || (req.session && req.session.isAdmin === true);

            if (!isAdmin) {
                if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
                    return res.status(403).json({ error: "لا توجد صلاحيات كافية" });
                }
                return res.status(404).render("404", { title: "غير مصرح", settings: {} });
            }

            next();
        } catch (error) {
            console.error("Admin check error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    /**
     * إنشاء جلسة للمستخدم (بعد تسجيل الدخول)
     */
    const createSession = (req, userId, email) => {
        if (req.session) {
            req.session.userId = userId;
            req.session.email = email;
            req.session.loginTime = new Date();
        }
    };

    /**
     * تدمير جلسة المستخدم (عند تسجيل الخروج)
     */
    const destroySession = (req) => {
        return new Promise((resolve, reject) => {
            if (!req.session) {
                resolve();
                return;
            }
            req.session.destroy((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    };

    /**
     * التحقق من أن المستخدم مسجل دخول (اختياري - لا يعيد خطأ إذا لم يكن مسجل)
     */
    const optionalAuth = async (req, res, next) => {
        try {
            // التحقق من Firebase ID Token
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const idToken = authHeader.split("Bearer ")[1];
                try {
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    req.user = {
                        uid: decodedToken.uid,
                        email: decodedToken.email,
                        displayName: decodedToken.name || "",
                        photoURL: decodedToken.picture || "",
                        isAdmin: decodedToken.admin === true || decodedToken.role === 'admin'
                    };
                    req.authSource = "firebase-token";
                    return next();
                } catch (error) {
                    // تابع
                }
            }

            // التحقق من جلسة الخادم
            if (req.session && req.session.userId && db) {
                try {
                    const userDoc = await db.collection("users").doc(req.session.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        req.user = {
                            uid: req.session.userId,
                            email: req.session.email,
                            displayName: userData.displayName || "",
                            photoURL: userData.photoURL || "",
                            isAdmin: userData.isAdmin === true || userData.role === 'admin' || req.session.isAdmin === true
                        };
                        req.authSource = "session";
                    }
                } catch (error) {
                    console.error("Error verifying session:", error);
                }
            }

            next();
        } catch (error) {
            console.error("Optional auth middleware error:", error);
            next();
        }
    };

    return {
        requireAuth,
        requireAdmin,
        createSession,
        destroySession,
        optionalAuth
    };
};