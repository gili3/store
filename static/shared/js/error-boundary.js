/**
 * Error Boundary - حد الأمان للأخطاء
 * يمنع انهيار التطبيق بالكامل عند حدوث أخطاء جزئية
 * يوفر آليات للتعافي والإبلاغ عن الأخطاء
 */

class ErrorBoundary {
    constructor(options = {}) {
        this.errorLog = [];
        this.maxLogSize = options.maxLogSize || 100;
        this.enableLogging = options.enableLogging !== false;
        this.enableReporting = options.enableReporting !== false;
        this.errorHandlers = [];
        this.recoveryStrategies = new Map();
        
        this._setupGlobalHandlers();
        this._setupRecoveryStrategies();
    }

    /**
     * تسجيل معالج خطأ مخصص
     */
    onError(handler) {
        this.errorHandlers.push(handler);
    }

    /**
     * تسجيل استراتيجية تعافي لنوع خطأ معين
     */
    registerRecoveryStrategy(errorType, strategy) {
        this.recoveryStrategies.set(errorType, strategy);
    }

    /**
     * التقاط خطأ ومعالجته
     */
    catch(error, context = {}) {
        const errorInfo = this._normalizeError(error, context);
        
        // تسجيل الخطأ
        this._logError(errorInfo);

        // تنفيذ معالجات الأخطاء المسجلة
        for (const handler of this.errorHandlers) {
            try {
                handler(errorInfo);
            } catch (e) {
                console.error('❌ خطأ في معالج الأخطاء:', e);
            }
        }

        // محاولة التعافي من الخطأ
        this._attemptRecovery(errorInfo);

        // الإبلاغ عن الخطأ
        if (this.enableReporting) {
            this._reportError(errorInfo);
        }

        return errorInfo;
    }

    /**
     * تنفيذ دالة مع حماية من الأخطاء
     */
    async wrap(fn, context = {}) {
        try {
            return await fn();
        } catch (error) {
            return this.catch(error, context);
        }
    }

    /**
     * تنفيذ دالة متزامنة مع حماية من الأخطاء
     */
    wrapSync(fn, context = {}) {
        try {
            return fn();
        } catch (error) {
            return this.catch(error, context);
        }
    }

    /**
     * الحصول على سجل الأخطاء
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * مسح سجل الأخطاء
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * الحصول على آخر خطأ
     */
    getLastError() {
        return this.errorLog[this.errorLog.length - 1] || null;
    }

    /**
     * الحصول على إحصائيات الأخطاء
     */
    getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            byType: {},
            byContext: {}
        };

        for (const error of this.errorLog) {
            // إحصائيات حسب النوع
            const type = error.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // إحصائيات حسب السياق
            const context = error.context?.component || 'unknown';
            stats.byContext[context] = (stats.byContext[context] || 0) + 1;
        }

        return stats;
    }

    /**
     * إظهار رسالة خطأ للمستخدم
     */
    showErrorMessage(error, options = {}) {
        const {
            duration = 5000,
            position = 'top',
            type = 'error'
        } = options;

        const message = error.userMessage || error.message || 'حدث خطأ غير متوقع';

        // استخدام نظام الإشعارات إذا كان متاحاً
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // بديل بسيط
            alert(message);
        }
    }

    /**
     * ========== دوال خاصة ==========
     */

    _setupGlobalHandlers() {
        // التقاط الأخطاء غير المعالجة
        window.addEventListener('error', (event) => {
            this.catch(event.error || new Error(event.message), {
                component: 'global',
                type: 'uncaught'
            });
        });

        // التقاط الأخطاء غير المعالجة في الـ Promises
        window.addEventListener('unhandledrejection', (event) => {
            this.catch(event.reason || new Error('Unhandled Promise Rejection'), {
                component: 'promise',
                type: 'unhandled-rejection'
            });
        });
    }

    _setupRecoveryStrategies() {
        // استراتيجية التعافي من أخطاء الشبكة
        this.registerRecoveryStrategy('NetworkError', (error) => {
            console.log('🔄 محاولة التعافي من خطأ الشبكة...');
            if (typeof window.showToast === 'function') {
                window.showToast('يبدو أن هناك مشكلة في الاتصال. جاري إعادة المحاولة...', 'warning');
            }
        });

        // استراتيجية التعافي من أخطاء المصادقة
        this.registerRecoveryStrategy('AuthenticationError', (error) => {
            console.log('🔄 محاولة التعافي من خطأ المصادقة...');
            // إعادة التوجيه لصفحة تسجيل الدخول
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        });

        // استراتيجية التعافي من أخطاء الأداء
        this.registerRecoveryStrategy('PerformanceError', (error) => {
            console.log('🔄 محاولة التعافي من خطأ الأداء...');
            // تنظيف الذاكرة
            if (window.gc) {
                window.gc();
            }
        });
    }

    _normalizeError(error, context = {}) {
        let errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            userMessage: 'حدث خطأ غير متوقع'
        };

        if (error instanceof Error) {
            errorInfo.message = error.message;
            errorInfo.stack = error.stack;
            errorInfo.type = error.name;
        } else if (typeof error === 'string') {
            errorInfo.message = error;
            errorInfo.type = 'StringError';
        } else if (typeof error === 'object') {
            errorInfo.message = error.message || JSON.stringify(error);
            errorInfo.type = error.type || 'ObjectError';
            errorInfo.data = error;
        } else {
            errorInfo.message = String(error);
            errorInfo.type = 'UnknownError';
        }

        // تحديد رسالة صديقة للمستخدم
        if (error.code === 'NETWORK_ERROR') {
            errorInfo.userMessage = 'فشل الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
            errorInfo.type = 'NetworkError';
        } else if (error.code === 'AUTH_ERROR' || error.status === 401) {
            errorInfo.userMessage = 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.';
            errorInfo.type = 'AuthenticationError';
        } else if (error.status === 404) {
            errorInfo.userMessage = 'الصفحة أو المورد المطلوب غير موجود.';
            errorInfo.type = 'NotFoundError';
        } else if (error.status === 500) {
            errorInfo.userMessage = 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.';
            errorInfo.type = 'ServerError';
        }

        return errorInfo;
    }

    _logError(errorInfo) {
        // إضافة الخطأ إلى السجل
        this.errorLog.push(errorInfo);

        // الحفاظ على حد أقصى لحجم السجل
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // حفظ السجل في localStorage
        try {
            localStorage.setItem('errorLog', JSON.stringify(this.errorLog));
        } catch (e) {
            console.warn('⚠️ فشل حفظ سجل الأخطاء في localStorage');
        }

        // طباعة الخطأ في الكونسول
        if (this.enableLogging) {
            console.error('❌ خطأ:', {
                message: errorInfo.message,
                type: errorInfo.type,
                context: errorInfo.context,
                timestamp: errorInfo.timestamp
            });
        }
    }

    _attemptRecovery(errorInfo) {
        const strategy = this.recoveryStrategies.get(errorInfo.type);
        if (strategy) {
            try {
                strategy(errorInfo);
            } catch (e) {
                console.error('❌ خطأ في استراتيجية التعافي:', e);
            }
        }
    }

    _reportError(errorInfo) {
        // إرسال الخطأ إلى خادم التقارير (اختياري)
        try {
            if (window.apiClient) {
                window.apiClient.reportError(errorInfo).catch(e => {
                    console.warn('⚠️ فشل إرسال تقرير الخطأ:', e);
                });
            }
        } catch (e) {
            console.warn('⚠️ فشل الإبلاغ عن الخطأ:', e);
        }
    }
}

// إنشاء مثيل عام من Error Boundary
window.errorBoundary = window.errorBoundary || new ErrorBoundary({
    enableLogging: true,
    enableReporting: true
});

// تصدير الفئة للاستخدام
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorBoundary;
}
