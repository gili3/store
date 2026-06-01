// state-manager.js - إدارة الحالة المركزية للتطبيق (نسخة محسنة تعتمد على Firebase)
// ======================== المتغيرات العامة الموحدة ========================

(function() {
    'use strict';

    if (window.AppState) return;

    // دالة debounce لمنع الإفراط في استدعاء Firebase
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const AppState = {
        // الحالة
        user: null,
        isGuest: false,
        isAdmin: false,
        cart: [],
        favorites: [],
        products: [],
        categories: [],
        orders: [],
        settings: {},
        currency: 'SDG',
        navigationHistory: ['home'],

        // دوال التحديث
        setUser: function(user, isGuest = false) {
            this.user = user;
            this.isGuest = isGuest;
            this.isAdmin = user?.isAdmin || false;
            
            // عند تغيير المستخدم، نقوم بتحميل بياناته من Firebase أو sessionStorage
            if (user && !isGuest) {
                this.loadFromFirebase();
            } else if (isGuest) {
                this.loadFromStorage(); // للضيوف فقط نستخدم sessionStorage
            } else {
                this.reset();
            }
            
            this._notify('user');
        },

        setCart: function(cart) {
            this.cart = cart || [];
            this._notify('cart');
            this.persistData();
        },

        addToCart: function(item) {
            const existing = this.cart.find(i => i.id === item.id);
            const stock = parseInt(item.stock) || 0;
            
            if (existing) {
                const newQty = existing.quantity + (item.quantity || 1);
                if (newQty > stock) {
                    if (window.adminUtils && window.adminUtils.showToast) {
                        window.adminUtils.showToast(`عذراً، لا يمكن تجاوز الكمية المتاحة (${stock})`, 'warning');
                    }
                    existing.quantity = stock;
                } else {
                    existing.quantity = newQty;
                }
            } else {
                if ((item.quantity || 1) > stock) {
                    item.quantity = stock;
                    if (window.adminUtils && window.adminUtils.showToast) {
                        window.adminUtils.showToast(`تم إضافة الحد الأقصى المتاح (${stock})`, 'warning');
                    }
                }
                this.cart.push({...item});
            }
            this._notify('cart');
            this.persistData();
        },

        updateCartItemQuantity: function(productId, change) {
            const item = this.cart.find(i => i.id === productId);
            if (!item) return;
            
            const stock = parseInt(item.stock) || 999;
            const newQty = (item.quantity || 1) + change;
            
            if (newQty < 1) {
                this.cart = this.cart.filter(i => i.id !== productId);
            } else if (newQty > stock) {
                if (window.adminUtils && window.adminUtils.showToast) {
                    window.adminUtils.showToast(`عذراً، لا يمكن تجاوز الكمية المتاحة (${stock})`, 'warning');
                }
                item.quantity = stock;
            } else {
                item.quantity = newQty;
            }
            this._notify('cart');
            this.persistData();
        },

        removeFromCart: function(productId) {
            this.cart = this.cart.filter(i => i.id !== productId);
            this._notify('cart');
            this.persistData();
        },

        clearCart: function() {
            this.cart = [];
            this._notify('cart');
            this.persistData();
        },

        setFavorites: function(favorites) {
            this.favorites = favorites || [];
            this._notify('favorites');
            this.persistData();
        },

        toggleFavorite: function(product) {
            const index = this.favorites.findIndex(f => f.id === product.id);
            if (index === -1) {
                this.favorites.push({...product});
            } else {
                this.favorites.splice(index, 1);
            }
            this._notify('favorites');
            this.persistData();
        },

        setProducts: function(products) {
            this.products = products || [];
        },

        setCategories: function(categories) {
            this.categories = categories || [];
        },

        setSettings: function(settings) {
            this.settings = settings || {};
            this.currency = settings.currency || 'SDG';
        },

        // مستمعي التغيير
        _listeners: {
            user: [],
            cart: [],
            favorites: []
        },

        subscribe: function(event, callback) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(callback);
        },

        unsubscribe: function(event, callback) {
            if (!this._listeners[event]) return;
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        },

        _notify: function(event) {
            if (!this._listeners[event]) return;
            this._listeners[event].forEach(cb => cb(this[event]));
        },

        // حفظ البيانات بناءً على نوع المستخدم
        persistData: function() {
            // دائماً احفظ في localStorage/sessionStorage أولاً لتجنب فقدان البيانات عند الإغلاق المفاجئ
            this.saveToLocal();
            
            // ثم قم بالمزامنة مع Firebase بشكل debounced
            if (this.user && !this.isGuest) {
                this.syncWithFirebase();
            }
        },

        saveToLocal: function() {
            try {
                const storageKey = this.isGuest ? 'guest_data' : `user_data_${this.user?.uid}`;
                const data = {
                    cart: this.cart,
                    favorites: this.favorites,
                    timestamp: Date.now()
                };
                localStorage.setItem(storageKey, JSON.stringify(data));
                
                if (this.isGuest) {
                    sessionStorage.setItem('guest_cart', JSON.stringify(this.cart));
                }
            } catch (e) {
                console.warn('⚠️ فشل الحفظ المحلي', e);
            }
        },

        loadFromStorage: function() {
            try {
                const storageKey = this.isGuest ? 'guest_data' : `user_data_${this.user?.uid}`;
                const localData = localStorage.getItem(storageKey);
                
                if (localData) {
                    const parsed = JSON.parse(localData);
                    this.cart = parsed.cart || [];
                    this.favorites = parsed.favorites || [];
                } else {
                    // محاولة التحميل من sessionStorage كبديل قديم
                    const cart = sessionStorage.getItem('guest_cart');
                    if (cart) this.cart = JSON.parse(cart);
                }
                
                this._notify('cart');
                this._notify('favorites');
            } catch (e) {
                console.warn('⚠️ فشل تحميل البيانات المحلية', e);
            }
        },

        // مزامنة مع Firebase للمستخدمين المسجلين (مع debounce)
        syncWithFirebase: debounce(async function() {
            if (!this.user || this.isGuest) return;
            try {
                const db = window.db;
                if (!db) return;
                
                // نأخذ نسخة من البيانات الحالية لضمان عدم حدوث تضارب أثناء العملية غير المتزامنة
                const cartToSync = [...this.cart];
                const favoritesToSync = [...this.favorites];
                
                const userRef = window.firebaseModules.doc(db, 'users', this.user.uid);
                await window.firebaseModules.updateDoc(userRef, {
                    cart: cartToSync,
                    favorites: favoritesToSync,
                    lastUpdated: window.firebaseModules.serverTimestamp()
                });
                console.log('✅ تمت مزامنة الحالة مع Firebase');
            } catch (error) {
                console.error('❌ فشل المزامنة مع Firebase:', error);
            }
        }, 1000),

        loadFromFirebase: async function() {
            if (!this.user || this.isGuest) return;
            try {
                // أولاً نحمل من التخزين المحلي لسرعة الاستجابة (Optimistic UI)
                this.loadFromStorage();
                
                const db = window.db;
                if (!db) return;
                const userRef = window.firebaseModules.doc(db, 'users', this.user.uid);
                const userDoc = await window.firebaseModules.getDoc(userRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    
                    // قارن الطوابع الزمنية إذا لزم الأمر، هنا سنعتمد بيانات Firebase كمرجع أساسي
                    this.cart = data.cart || [];
                    this.favorites = data.favorites || [];
                    
                    this._notify('cart');
                    this._notify('favorites');
                    this.saveToLocal(); // تحديث التخزين المحلي بالبيانات الجديدة
                    console.log('✅ تم تحميل البيانات من Firebase');
                }
            } catch (error) {
                console.error('❌ فشل تحميل البيانات من Firebase:', error);
            }
        },

        // إعادة تعيين الحالة (تسجيل الخروج)
        reset: function() {
            const storageKey = this.isGuest ? 'guest_data' : `user_data_${this.user?.uid}`;
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem('guest_cart');
            
            this.user = null;
            this.isGuest = false;
            this.isAdmin = false;
            this.cart = [];
            this.favorites = [];
            
            this._notify('user');
            this._notify('cart');
            this._notify('favorites');
        }
    };

    window.AppState = AppState;

    // ربط الدوال القديمة للتوافق
    Object.defineProperty(window, 'currentUser', { get: () => AppState.user });
    Object.defineProperty(window, 'cartItems', { get: () => AppState.cart });
    Object.defineProperty(window, 'favorites', { get: () => AppState.favorites });

    console.log('✅ state-manager.js fixed (Safe persistence + Debounced Sync)');
})();
