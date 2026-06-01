/**
 * API Client Enhanced - عميل API محسّن
 * يوفر واجهة موحدة للتواصل مع الخادم مع معالجة الأخطاء والتحقق من الصحة
 */

class APIClientEnhanced {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.csrfToken = null;
        this.authToken = null;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    /**
     * الحصول على رمز CSRF من الخادم
     */
    async getCSRFToken() {
        if (this.csrfToken) return this.csrfToken;

        try {
            const response = await fetch(`${this.baseURL}/csrf-token`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.csrfToken = data.token;
                return this.csrfToken;
            }
        } catch (error) {
            console.error('❌ خطأ في الحصول على رمز CSRF:', error);
        }
        return null;
    }

    /**
     * إضافة رأس المصادقة إلى الطلب
     */
    async getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const csrfToken = await this.getCSRFToken();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        return headers;
    }

    /**
     * إعادة محاولة الطلب في حالة الفشل
     */
    async fetchWithRetry(url, options = {}, attempt = 0) {
        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                if (response.status === 401) {
                    // إعادة التوجيه لصفحة تسجيل الدخول
                    window.location.href = '/login';
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            if (attempt < this.retryAttempts) {
                console.warn(`⚠️ محاولة إعادة الطلب ${attempt + 1}/${this.retryAttempts}...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * البحث المتقدم عن المنتجات
     * @param {Object} filters - معاملات البحث
     *   - q: كلمة البحث
     *   - category: معرف الفئة
     *   - sort: ترتيب النتائج (newest, price-asc, price-desc, popular)
     *   - limit: عدد النتائج
     *   - page: رقم الصفحة
     */
    async searchProducts(filters = {}) {
        try {
            const {
                q = '',
                category = '',
                sort = 'newest',
                limit = 20,
                page = 1
            } = filters;

            const params = new URLSearchParams();
            if (q) params.append('q', q);
            if (category) params.append('category', category);
            params.append('sort', sort);
            params.append('limit', limit);
            params.append('page', page);

            const url = `${this.baseURL}/products/search-advanced?${params.toString()}`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response) return null;

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ خطأ في البحث عن المنتجات:', error);
            throw error;
        }
    }

    /**
     * جلب جميع المنتجات
     */
    async getProducts(filters = {}) {
        try {
            const {
                category = '',
                search = '',
                limit = 20,
                page = 1
            } = filters;

            const params = new URLSearchParams();
            if (category) params.append('category', category);
            if (search) params.append('search', search);
            params.append('limit', limit);
            params.append('page', page);

            const url = `${this.baseURL}/products?${params.toString()}`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في جلب المنتجات:', error);
            throw error;
        }
    }

    /**
     * جلب منتج واحد
     */
    async getProduct(productId) {
        try {
            const url = `${this.baseURL}/products/${productId}`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في جلب المنتج:', error);
            throw error;
        }
    }

    /**
     * جلب المنتجات المميزة
     */
    async getFeaturedProducts() {
        try {
            const url = `${this.baseURL}/products/featured`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في جلب المنتجات المميزة:', error);
            throw error;
        }
    }

    /**
     * رفع صورة منتج
     */
    async uploadProductImage(file, productId = null) {
        try {
            if (!file) {
                throw new Error('لم يتم اختيار ملف');
            }

            const formData = new FormData();
            formData.append('file', file);
            if (productId) {
                formData.append('productId', productId);
            }

            const url = `${this.baseURL}/images/upload-product`;
            const headers = {
                'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
            };

            const csrfToken = await this.getCSRFToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في رفع الصورة:', error);
            throw error;
        }
    }

    /**
     * رفع صورة الإعدادات
     */
    async uploadSettingsImage(file, type = 'logo') {
        try {
            if (!file) {
                throw new Error('لم يتم اختيار ملف');
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const url = `${this.baseURL}/images/upload-settings`;
            const headers = {
                'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
            };

            const csrfToken = await this.getCSRFToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في رفع صورة الإعدادات:', error);
            throw error;
        }
    }

    /**
     * معالجة صورة موجودة
     */
    async processImage(imagePath, options = {}) {
        try {
            const {
                width = 800,
                height = 800,
                quality = 85
            } = options;

            const url = `${this.baseURL}/images/process`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    imagePath,
                    width,
                    height,
                    quality
                }),
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في معالجة الصورة:', error);
            throw error;
        }
    }

    /**
     * حذف صورة
     */
    async deleteImage(imagePath) {
        try {
            const url = `${this.baseURL}/images/${encodeURIComponent(imagePath)}`;
            const headers = await this.getAuthHeaders();

            const response = await this.fetchWithRetry(url, {
                method: 'DELETE',
                headers,
                credentials: 'include'
            });

            if (!response) return null;

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في حذف الصورة:', error);
            throw error;
        }
    }

    /**
     * تعيين رمز المصادقة
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * مسح رمز المصادقة
     */
    clearAuthToken() {
        this.authToken = null;
    }
}

// إنشاء مثيل عام من العميل
window.apiClientEnhanced = window.apiClientEnhanced || new APIClientEnhanced();
