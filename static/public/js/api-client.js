/**
 * api-client.js
 * عميل API موحد لجميع طلبات السيرفر
 * يوفر واجهة موحدة وآمنة للتواصل مع السيرفر
 */

class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.timeout = 30000;
        this.csrfToken = null;
    }

    /**
     * جلب توكن CSRF من السيرفر
     */
    async fetchCSRFToken() {
        try {
            const response = await fetch(`${this.baseURL}/csrf-token`);
            const data = await response.json();
            this.csrfToken = data.csrfToken;
            return this.csrfToken;
        } catch (error) {
            console.error('❌ خطأ في جلب CSRF Token:', error);
            return null;
        }
    }

    /**
     * دالة مساعدة لإرسال طلبات HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const method = (options.method || 'GET').toUpperCase();
        
        const defaultHeaders = {
            'Content-Type': 'application/json'
        };

        // إضافة التوكن إذا كان المستخدم مسجلاً
        if (window.auth?.currentUser) {
            try {
                const token = await window.auth.currentUser.getIdToken();
                defaultHeaders['Authorization'] = `Bearer ${token}`;
            } catch (error) {
                console.error('❌ خطأ في جلب التوكن:', error);
            }
        }

        // إضافة CSRF Token للطلبات الحساسة
        if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
            if (!this.csrfToken) {
                await this.fetchCSRFToken();
            }
            if (this.csrfToken) {
                defaultHeaders['X-CSRF-Token'] = this.csrfToken;
            }
        }

        const finalOptions = { 
            ...options,
            headers: { ...defaultHeaders, ...(options.headers || {}) }
        };

        try {
            let response = await fetch(url, finalOptions);

            // إذا انتهت صلاحية CSRF Token (403)، حاول مرة أخرى بعد تجديده
            if (response.status === 403 && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
                console.warn('⚠️ CSRF Token انتهى، جاري التجديد...');
                await this.fetchCSRFToken();
                if (this.csrfToken) {
                    finalOptions.headers['X-CSRF-Token'] = this.csrfToken;
                    response = await fetch(url, finalOptions);
                }
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ خطأ في الطلب: ${endpoint}`, error);
            throw error;
        }
    }

    // ============================================
    // APIs المنتجات
    // ============================================

    async getProducts(filters = {}) {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.search) params.append('search', filters.search);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.page) params.append('page', filters.page);

        return this.request(`/products?${params.toString()}`);
    }

    async getProduct(productId) {
        return this.request(`/products/${productId}`);
    }

    async searchProducts(query, limit = 10) {
        return this.request(`/products/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    // ============================================
    // APIs الطلبات
    // ============================================

    async getUserOrders() {
        // السيرفر يستخرج الـ userId من التوكن تلقائياً
        const userId = window.AppState?.user?.uid;
        return this.request(`/orders/user/${userId}`);
    }

    async getOrderDetails(orderId) {
        return this.request(`/orders/${orderId}`);
    }

    async calculateOrder(items) {
        return this.request('/orders/calculate', {
            method: 'POST',
            body: JSON.stringify({ items })
        });
    }

    async createOrder(orderData) {
        // نرسل فقط البيانات الأساسية، السيرفر سيحسب الأسعار ويجلب بيانات المنتجات بنفسه
        const minimalOrderData = {
            items: orderData.items.map(item => ({ id: item.id, quantity: item.quantity })),
            address: orderData.address,
            phone: orderData.phone,
            userName: orderData.userName,
            notes: orderData.notes
        };
        
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify(minimalOrderData)
        });
    }

    async uploadReceipt(orderId, receiptUrl) {
        return this.request(`/orders/${orderId}/receipt`, {
            method: 'POST',
            body: JSON.stringify({ receiptUrl })
        });
    }

    // ============================================
    // APIs الفئات
    // ============================================

    async getCategories() {
        return this.request('/categories');
    }

    // ============================================
    // APIs الإعدادات
    // ============================================

    async getSettings() {
        return this.request('/settings');
    }

    // ============================================
    // APIs المسؤول (Admin)
    // ============================================

    async updateOrderStatus(orderId, status) {
        return this.request(`/orders/${orderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }
}

// إنشاء مثيل عام من العميل
window.apiClient = new APIClient();

console.log('✅ API Client تم تحديثه ليتطابق مع السيرفر');
