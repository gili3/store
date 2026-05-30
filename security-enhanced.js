/**
 * ============================================================
 * SECURITY-ENHANCED.JS - طبقات أمان متقدمة للمتجر
 * ============================================================
 * 
 * يحتوي على:
 * 1. حماية ضد هجمات XSS و SQL Injection
 * 2. تحديد معدل الطلبات (Rate Limiting)
 * 3. التحقق من صحة البيانات (Validation)
 * 4. حماية ضد CSRF و Clickjacking
 * 5. تشفير البيانات الحساسة
 * 
 * ============================================================
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const validator = require('validator');
const crypto = require('crypto');

// ============================================================
// 1. Helmet - حماية الرؤوس (Headers Security)
// ============================================================

const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://firebaseio.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000, // سنة واحدة
        includeSubDomains: true,
        preload: true
    },
    frameguard: {
        action: 'deny' // منع Clickjacking
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    noSniff: true,
    xssFilter: true
});

// ============================================================
// 2. Rate Limiting - تحديد معدل الطلبات
// ============================================================

/**
 * حد عام للطلبات (لكل IP)
 * 100 طلب كل 15 دقيقة
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100,
    message: 'تم تجاوز حد الطلبات المسموح. يرجى المحاولة لاحقاً',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // لا تطبق الحد على طلبات الملفات الثابتة
        return req.path.startsWith('/static') || req.path.startsWith('/public');
    }
});

/**
 * حد صارم لـ API (لكل IP)
 * 30 طلب كل دقيقة
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // دقيقة واحدة
    max: 30,
    message: 'تم تجاوز حد طلبات الـ API. يرجى المحاولة لاحقاً',
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * حد صارم جداً لعمليات تسجيل الدخول (لكل IP)
 * 5 محاولات كل 15 دقيقة
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'تم تجاوز محاولات تسجيل الدخول. يرجى المحاولة لاحقاً',
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * حد صارم لإنشاء الطلبات (لكل IP)
 * 10 طلبات كل ساعة
 */
const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // ساعة واحدة
    max: 10,
    message: 'تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً',
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================================
// 3. Data Sanitization - تنظيف البيانات
// ============================================================

/**
 * تنظيف شامل للبيانات من XSS و NoSQL Injection
 */
const sanitizeData = (req, res, next) => {
    // تنظيف body
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                // إزالة الفراغات الزائدة
                req.body[key] = req.body[key].trim();
                
                // تنظيف من XSS
                req.body[key] = validator.escape(req.body[key]);
                
                // منع NoSQL Injection
                req.body[key] = req.body[key].replace(/[\$\{\}]/g, '');
            }
        });
    }
    
    // تنظيف query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
                req.query[key] = validator.escape(req.query[key]);
            }
        });
    }
    
    next();
};

// ============================================================
// 4. Input Validation - التحقق من صحة المدخلات
// ============================================================

/**
 * التحقق من صحة البريد الإلكتروني
 */
const validateEmail = (email) => {
    return validator.isEmail(email);
};

/**
 * التحقق من صحة رقم الهاتف
 */
const validatePhone = (phone) => {
    // قبول أرقام بطول 10-15 رقم
    return /^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ''));
};

/**
 * التحقق من صحة العنوان
 */
const validateAddress = (address) => {
    return address && address.length >= 10 && address.length <= 500;
};

/**
 * التحقق من صحة السعر
 */
const validatePrice = (price) => {
    const num = parseFloat(price);
    return !isNaN(num) && num > 0 && num < 1000000;
};

/**
 * التحقق من صحة الكمية
 */
const validateQuantity = (quantity) => {
    const num = parseInt(quantity);
    return !isNaN(num) && num > 0 && num <= 10000;
};

/**
 * التحقق من صحة اسم المنتج
 */
const validateProductName = (name) => {
    return name && name.length >= 3 && name.length <= 200;
};

/**
 * دالة شاملة للتحقق من بيانات الطلب
 */
const validateOrderData = (orderData) => {
    const errors = [];
    
    if (!orderData.userName || orderData.userName.length < 2) {
        errors.push('اسم المستخدم غير صحيح');
    }
    
    if (!validateEmail(orderData.email)) {
        errors.push('البريد الإلكتروني غير صحيح');
    }
    
    if (!validatePhone(orderData.phone)) {
        errors.push('رقم الهاتف غير صحيح');
    }
    
    if (!validateAddress(orderData.address)) {
        errors.push('العنوان غير صحيح (يجب أن يكون بين 10 و 500 حرف)');
    }
    
    if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        errors.push('السلة فارغة');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// ============================================================
// 5. تشفير البيانات الحساسة
// ============================================================

/**
 * تشفير البيانات الحساسة (مثل أرقام الطلبات)
 */
const encryptData = (data, secretKey = process.env.ENCRYPTION_KEY || 'default-secret') => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            Buffer.from(secretKey.padEnd(32, '0').slice(0, 32)),
            iv
        );
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
};

/**
 * فك تشفير البيانات
 */
const decryptData = (encryptedData, secretKey = process.env.ENCRYPTION_KEY || 'default-secret') => {
    try {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(secretKey.padEnd(32, '0').slice(0, 32)),
            iv
        );
        
        let decrypted = decipher.update(parts[1], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
};

// ============================================================
// 6. CSRF Protection - حماية ضد CSRF
// ============================================================

/**
 * توليد CSRF Token
 */
const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * التحقق من CSRF Token
 */
const verifyCSRFToken = (req, res, next) => {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || token !== sessionToken) {
        return res.status(403).json({
            success: false,
            error: 'فشل التحقق من الأمان. يرجى إعادة المحاولة'
        });
    }
    
    next();
};

// ============================================================
// 7. SQL Injection Prevention
// ============================================================

/**
 * التحقق من وجود محاولات SQL Injection
 */
const detectSQLInjection = (input) => {
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'EXEC', 'SCRIPT'];
    const upperInput = input.toUpperCase();
    
    return sqlKeywords.some(keyword => upperInput.includes(keyword));
};

// ============================================================
// 8. Middleware لتسجيل محاولات الاختراق
// ============================================================

const logSecurityEvents = (req, res, next) => {
    // تسجيل محاولات الوصول لمسارات حساسة
    if (req.path.includes('admin') || req.path.includes('api')) {
        console.log(`[SECURITY] ${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    }
    
    next();
};

// ============================================================
// Export
// ============================================================

module.exports = {
    // Helmet
    helmetConfig,
    
    // Rate Limiting
    generalLimiter,
    apiLimiter,
    authLimiter,
    orderLimiter,
    
    // Sanitization & Validation
    sanitizeData,
    validateEmail,
    validatePhone,
    validateAddress,
    validatePrice,
    validateQuantity,
    validateProductName,
    validateOrderData,
    
    // Encryption
    encryptData,
    decryptData,
    
    // CSRF
    generateCSRFToken,
    verifyCSRFToken,
    
    // SQL Injection
    detectSQLInjection,
    
    // Logging
    logSecurityEvents
};
