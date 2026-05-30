/**
 * ============================================================
 * MIDDLEWARE-UNIFIED.JS - توحيد جميع الـ Middleware
 * ============================================================
 */

const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

// ============================================================
// 1. Middleware للمصادقة (Authentication)
// ============================================================

/**
 * التحقق من توكن المستخدم من Authorization Header
 * يضيف req.user إذا كان التوكن صحيحاً
 */
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }
    
    const idToken = authHeader.split("Bearer ")[1];
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        
        // جلب بيانات المستخدم الإضافية من Firestore
        if (db) {
            const userDoc = await db.collection("users").doc(decodedToken.uid).get();
            if (userDoc.exists) {
                req.user.isAdmin = userDoc.data().isAdmin || false;
                req.user.userData = userDoc.data();
            }
        }
        
        next();
    } catch (error) {
        logger.error("Token verification error:", error);
        next();
    }
};

// ============================================================
// 2. Middleware للتحقق من المصادقة (يتطلب تسجيل دخول)
// ============================================================

const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'يجب تسجيل الدخول أولاً'
        });
    }
    next();
};

// ============================================================
// 3. Middleware للتحقق من صلاحيات الأدمن
// ============================================================

const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'يجب تسجيل الدخول أولاً'
        });
    }
    
    try {
        const userDoc = await db.collection("users").doc(req.user.uid).get();
        
        if (!userDoc.exists || !userDoc.data().isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'لا توجد صلاحيات كافية. هذا الإجراء مقتصر على المسؤولين فقط'
            });
        }
        
        next();
    } catch (error) {
        logger.error("Admin check error:", error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في التحقق من الصلاحيات'
        });
    }
};

// ============================================================
// 4. Middleware لمعالجة الأخطاء العامة
// ============================================================

const errorHandler = (err, req, res, next) => {
    logger.error("Error:", err);
    
    // Firebase errors
    if (err.code && err.code.startsWith('auth/')) {
        return res.status(401).json({
            success: false,
            error: 'خطأ في المصادقة'
        });
    }
    
    // Validation errors
    if (err.message && err.message.includes('validation')) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
    
    // Default error
    res.status(500).json({
        success: false,
        error: 'حدث خطأ في السيرفر. يرجى المحاولة لاحقاً'
    });
};

// ============================================================
// 5. Middleware لتسجيل الطلبات (Logging)
// ============================================================

const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

// ============================================================
// 6. Middleware لتحديد معدل الطلبات (Rate Limiting)
// ============================================================

const rateLimitStore = new Map();

const simpleRateLimit = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, []);
        }
        
        const requests = rateLimitStore.get(key);
        const recentRequests = requests.filter(time => now - time < windowMs);
        
        if (recentRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً'
            });
        }
        
        recentRequests.push(now);
        rateLimitStore.set(key, recentRequests);
        
        next();
    };
};

// ============================================================
// 7. Middleware للتحقق من صحة البيانات
// ============================================================

const validateRequestBody = (requiredFields = []) => {
    return (req, res, next) => {
        if (!req.body) {
            return res.status(400).json({
                success: false,
                error: 'يجب إرسال بيانات في جسم الطلب'
            });
        }
        
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `الحقول المطلوبة ناقصة: ${missingFields.join(', ')}`
            });
        }
        
        next();
    };
};

// ============================================================
// 8. Middleware لإضافة CORS Headers
// ============================================================

const corsHeaders = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
};

// ============================================================
// 9. Middleware لتحديد نوع المحتوى
// ============================================================

const setContentType = (req, res, next) => {
    res.type('application/json');
    next();
};

// ============================================================
// 10. Middleware لتنظيف البيانات (Sanitization)
// ============================================================

const sanitizeInputs = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                // إزالة الفراغات الزائدة
                req.body[key] = req.body[key].trim();
                
                // منع XSS بسيط
                req.body[key] = req.body[key]
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            }
        });
    }
    
    next();
};

// ============================================================
// 11. Middleware لتسجيل الأخطاء
// ============================================================

const logErrors = (err, req, res, next) => {
    logger.error({
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    next(err);
};

// ============================================================
// Export جميع الـ Middleware
// ============================================================

module.exports = {
    authenticateUser,
    requireAuth,
    requireAdmin,
    errorHandler,
    requestLogger,
    simpleRateLimit,
    validateRequestBody,
    corsHeaders,
    setContentType,
    sanitizeInputs,
    logErrors
};
