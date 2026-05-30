/**
 * Router Enhanced - نظام توجيه محسّن
 * يستخدم Browser History API بدلاً من Hash Routing
 * يوفر توجيه آمن وفعال مع دعم الحالة والمعاملات
 */

class RouterEnhanced {
    constructor(options = {}) {
        this.routes = new Map();
        this.currentRoute = null;
        this.previousRoute = null;
        this.state = {};
        this.middlewares = [];
        this.errorHandlers = [];
        this.baseURL = options.baseURL || '/';
        this.enableLogging = options.enableLogging !== false;
        
        this._setupListeners();
        this._initializeRoutes();
    }

    /**
     * تسجيل مسار جديد
     */
    register(path, handler, options = {}) {
        this.routes.set(path, {
            handler,
            pattern: this._createPattern(path),
            options
        });
        
        if (this.enableLogging) {
            console.log(`📍 تم تسجيل المسار: ${path}`);
        }
    }

    /**
     * إضافة middleware
     */
    use(middleware) {
        this.middlewares.push(middleware);
    }

    /**
     * إضافة معالج الأخطاء
     */
    onError(handler) {
        this.errorHandlers.push(handler);
    }

    /**
     * الانتقال إلى مسار جديد
     */
    navigate(path, state = {}, options = {}) {
        try {
            const { replace = false, silent = false } = options;

            // التحقق من صحة المسار
            if (!path.startsWith('/')) {
                path = '/' + path;
            }

            // حفظ الحالة السابقة
            this.previousRoute = this.currentRoute;

            // تنفيذ middlewares
            for (const middleware of this.middlewares) {
                if (!middleware({ path, state, router: this })) {
                    if (this.enableLogging) {
                        console.warn(`⚠️ تم رفض الملاح بواسطة middleware`);
                    }
                    return false;
                }
            }

            // تحديث حالة المتصفح
            if (replace) {
                window.history.replaceState(state, '', path);
            } else {
                window.history.pushState(state, '', path);
            }

            // تحديث الحالة الداخلية
            this.state = state;
            this.currentRoute = path;

            // تنفيذ المسار
            if (!silent) {
                this._executeRoute(path, state);
            }

            if (this.enableLogging) {
                console.log(`✅ تم الانتقال إلى: ${path}`);
            }

            return true;
        } catch (error) {
            this._handleError(error, { path, state });
            return false;
        }
    }

    /**
     * العودة إلى الصفحة السابقة
     */
    back() {
        window.history.back();
    }

    /**
     * الانتقال للأمام
     */
    forward() {
        window.history.forward();
    }

    /**
     * الحصول على المسار الحالي
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * الحصول على الحالة الحالية
     */
    getState() {
        return this.state;
    }

    /**
     * الحصول على معامل من المسار
     */
    getParam(name) {
        const route = this.routes.get(this.currentRoute);
        if (!route) return null;

        const match = route.pattern.exec(this.currentRoute);
        if (!match) return null;

        const paramIndex = route.pattern.paramNames?.indexOf(name);
        return paramIndex !== -1 ? match[paramIndex + 1] : null;
    }

    /**
     * الحصول على جميع معاملات المسار
     */
    getParams() {
        const route = this.routes.get(this.currentRoute);
        if (!route) return {};

        const match = route.pattern.exec(this.currentRoute);
        if (!match) return {};

        const params = {};
        route.pattern.paramNames?.forEach((name, index) => {
            params[name] = match[index + 1];
        });

        return params;
    }

    /**
     * إنشاء رابط آمن
     */
    createLink(path, state = {}) {
        return {
            href: path,
            onClick: (e) => {
                e.preventDefault();
                this.navigate(path, state);
            }
        };
    }

    /**
     * ========== دوال خاصة ==========
     */

    _setupListeners() {
        // الاستماع لتغييرات السجل (Back/Forward)
        window.addEventListener('popstate', (e) => {
            const path = window.location.pathname;
            const state = e.state || {};
            this._executeRoute(path, state);
        });

        // معالجة الروابط الداخلية
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-router-link]');
            if (link) {
                e.preventDefault();
                const href = link.getAttribute('href');
                const state = link.getAttribute('data-state');
                this.navigate(href, state ? JSON.parse(state) : {});
            }
        });
    }

    _initializeRoutes() {
        // تنفيذ المسار الحالي عند التحميل الأولي
        const currentPath = window.location.pathname;
        this.currentRoute = currentPath;
        this._executeRoute(currentPath, {});
    }

    _createPattern(path) {
        // تحويل مسار مثل /products/:id إلى regex
        const paramNames = [];
        const pattern = path
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, (match, name) => {
                paramNames.push(name);
                return '([^\\/]+)';
            });

        const regex = new RegExp(`^${pattern}$`);
        regex.paramNames = paramNames;
        return regex;
    }

    async _executeRoute(path, state) {
        try {
            // البحث عن المسار المطابق
            let matchedRoute = null;
            let params = {};

            for (const [routePath, route] of this.routes) {
                const match = route.pattern.exec(path);
                if (match) {
                    matchedRoute = route;
                    route.pattern.paramNames?.forEach((name, index) => {
                        params[name] = match[index + 1];
                    });
                    break;
                }
            }

            if (!matchedRoute) {
                throw new Error(`المسار غير موجود: ${path}`);
            }

            // تنفيذ معالج المسار
            await matchedRoute.handler({
                path,
                state,
                params,
                router: this
            });

        } catch (error) {
            this._handleError(error, { path, state });
        }
    }

    _handleError(error, context) {
        console.error('❌ خطأ في المسار:', error);

        for (const handler of this.errorHandlers) {
            try {
                handler(error, context);
            } catch (e) {
                console.error('❌ خطأ في معالج الأخطاء:', e);
            }
        }
    }
}

// إنشاء مثيل عام من الموجه
window.router = window.router || new RouterEnhanced({
    enableLogging: true
});

// تصدير الفئة للاستخدام
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouterEnhanced;
}
