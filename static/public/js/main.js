// main.js - نظام التطبيق الرئيسي (نسخة محسنة ومؤمنة - الإصدار النهائي المُصلح)
// ======================== نظام التوجيه والمشاركة ========================

window.navigateTo = function(sectionId, queryParams = {}) {
    let hash = sectionId;
    const params = new URLSearchParams(queryParams).toString();
    if (params) hash += '?' + params;
    window.location.hash = hash;
};

window.shareProduct = function(productId) {
    const url = `${window.location.origin}${window.location.pathname}#products?id=${productId}`;
    if (navigator.share) {
        navigator.share({ title: 'منتج من متجر إليفن', url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => {
            if (typeof showToast === 'function') showToast('تم نسخ رابط المنتج', 'success');
        }).catch(() => prompt('انسخ الرابط:', url));
    }
};

window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1) || 'home';
    const [base, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    const validSections = ['home', 'products', 'favorites', 'cart', 'checkout', 
                          'profile', 'about', 'contact', 'my-orders', 'orderTracking'];
    
    if (validSections.includes(base) && document.getElementById(base)) {
        showSection(base);
        
        switch(base) {
            case 'products':
                if (params.get('id')) {
                    requestAnimationFrame(() => {
                        if (typeof window.openProductDetails === 'function') {
                            window.openProductDetails(params.get('id'));
                        }
                    });
                } else if (params.get('q')) {
                    requestAnimationFrame(() => {
                        if (typeof window.executeSearch === 'function') {
                            window.executeSearch(params.get('q'));
                        }
                    });
                }
                break;
                
            case 'checkout':
                if (typeof window.updateCheckoutSummary === 'function') {
                    window.updateCheckoutSummary();
                }
                break;
                
            case 'profile':
                if (typeof window.updateUserProfile === 'function') {
                    window.updateUserProfile();
                }
                break;
                
            case 'my-orders':
                if (typeof window.checkAndLoadOrders === 'function') {
                    window.checkAndLoadOrders();
                }
                break;
                
            case 'cart':
                if (typeof window.forceUpdateCartDisplay === 'function') {
                    window.forceUpdateCartDisplay();
                }
                break;
                
            case 'favorites':
                if (typeof window.updateFavoritesDisplay === 'function') {
                    window.updateFavoritesDisplay();
                }
                break;
        }
    }
});

// ======================== دوال تحميل أولية محسنة ========================

function showInitialLoadingState() {
    if (typeof window.showLoadingState === 'function') {
        const homeGrid = document.getElementById('homeProductsGrid');
        const productsGrid = document.getElementById('productsGrid');
        
        if (homeGrid && homeGrid.children.length === 0) {
            window.showLoadingState('homeProductsGrid', 'جاري تحميل أحدث المنتجات...');
        }
        if (productsGrid && productsGrid.children.length === 0) {
            window.showLoadingState('productsGrid', 'جاري تحميل المنتجات...');
        }
    }
}

window.hideLoadingState = function() {
    console.log('🔄 إزالة شاشة التحميل الداخلية...');
    
    const grids = ['homeProductsGrid', 'productsGrid'];
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (grid) {
            const loadingElements = grid.querySelectorAll('.initial-loading-state, .products-loading-state');
            loadingElements.forEach(el => el.remove());
        }
    });
    
    console.log('✅ تم إخفاء شاشة التحميل الداخلية');
};

window.replaceLoadingWithProducts = function(productsHTML, gridId = 'homeProductsGrid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    const loadingEls = grid.querySelectorAll('.initial-loading-state, .products-loading-state');
    loadingEls.forEach(el => el.remove());
    
    if (grid.children.length === 0 && productsHTML) {
        grid.innerHTML = productsHTML;
        console.log(`✅ تم استبدال شاشة التحميل بالمنتجات في ${gridId}`);
    }
};

// ======================== تنظيف البحث ========================

window.clearSearchOnBack = function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.style.display = 'none';
    }
    
    console.log('🧹 تم تنظيف البحث');
};

// ======================== دالة تحديث أزرار المصادقة ========================

function updateAuthButtons() {
    console.log('🔄 تحديث أزرار المصادقة...');
    
    const mobileLoginItem = document.getElementById('mobileLoginItem');
    const mobileLogoutItem = document.getElementById('mobileLogoutItem');
    const mobileUserImage = document.getElementById('mobileUserImage');
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    
    const isLoggedIn = !!(AppState.user && !AppState.isGuest);
    const isGuest = !!(AppState.isGuest);
    
    console.log('👤 حالة المستخدم:', { 
        isLoggedIn, 
        isGuest, 
        user: AppState.user?.displayName,
        appStateGuest: AppState.isGuest 
    });
    
    if (mobileLoginItem) {
        const shouldShowLogin = !isLoggedIn && !isGuest;
        mobileLoginItem.style.display = shouldShowLogin ? 'block' : 'none';
        console.log('📱 زر تسجيل الدخول:', shouldShowLogin ? 'ظاهر' : 'مخفي');
    }
    
    if (mobileLogoutItem) {
        const shouldShowLogout = isLoggedIn;
        mobileLogoutItem.style.display = shouldShowLogout ? 'block' : 'none';
        console.log('📱 زر تسجيل الخروج:', shouldShowLogout ? 'ظاهر' : 'مخفي');
    }
    
    if (AppState.user) {
        if (mobileUserImage) {
            mobileUserImage.src = AppState.user.photoURL || '/public/images/user-placeholder.png';
        }
        if (mobileUserName) {
            if (AppState.isGuest) {
                mobileUserName.textContent = 'زائر';
            } else {
                mobileUserName.textContent = AppState.user.displayName || 'مستخدم';
            }
        }
        if (mobileUserEmail) {
            if (AppState.isGuest) {
                mobileUserEmail.textContent = 'وضع الضيف - سجل دخولك للحصول على كامل الميزات';
            } else {
                mobileUserEmail.textContent = AppState.user.email || '';
            }
        }
    } else {
        if (mobileUserImage) {
            mobileUserImage.src = '/public/images/user-placeholder.png';
        }
        if (mobileUserName) {
            mobileUserName.textContent = 'زائر';
        }
        if (mobileUserEmail) {
            mobileUserEmail.textContent = 'سجل دخولك للاستفادة من كامل الميزات';
        }
    }
}

window.updateAuthButtons = updateAuthButtons;

// ======================== ✅ دالة goToCheckout المحسنة ========================

window.goToCheckout = function() {
    console.log('🛒 محاولة التوجه إلى صفحة الدفع...');
    
    // ✅ التحقق من السلة قبل التوجه
    const cartItems = window.AppState?.cart || [];
    if (cartItems.length === 0) {
        if (typeof showToast === 'function') {
            showToast('سلة التسوق فارغة، أضف منتجات أولاً', 'warning');
        } else {
            alert('سلة التسوق فارغة');
        }
        return;
    }
    
    const isLoggedIn = !!(AppState.user && !AppState.isGuest);
    
    if (!isLoggedIn) {
        console.log('🚫 مستخدم غير مسجل - منع الوصول إلى صفحة الدفع');
        if (typeof showToast === 'function') {
            showToast('يرجى تسجيل الدخول أولاً لإتمام عملية الشراء.', 'warning');
        } else {
            alert('يرجى تسجيل الدخول أولاً لإتمام عملية الشراء.');
        }
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return;
    }
    
    console.log('✅ مستخدم مسجل - الانتقال إلى صفحة الدفع');
    if (typeof showSection === 'function') {
        showSection('checkout');
    } else {
        window.location.hash = 'checkout';
    }
};

// ======================== تهيئة التطبيق ========================

async function initializeAppSafely() {
    if (window.appInitialized) {
        console.log('⚠️ التطبيق مهيأ بالفعل');
        return;
    }
    
    if (!window.firebaseModules) {
        console.log('⏳ بانتظار تحميل وحدات Firebase...');
        window.addEventListener('firebase-ready', () => initializeAppSafely(), { once: true });
        return;
    }

    console.log('🚀 بدء تهيئة التطبيق (الإصدار النهائي المُصلح)...');
    window.appInitialized = true;

    const trackOrderBtn = document.getElementById('trackOrderBtn');
    if (trackOrderBtn) {
        trackOrderBtn.addEventListener('click', () => {
            if (typeof window.trackOrder === 'function') {
                window.trackOrder();
            }
        });
    }

    if (window.SecurityCore && typeof window.SecurityCore.init === 'function') {
        try {
            window.SecurityCore.init();
            console.log('✅ تم تفعيل نظام الأمان الشامل');
        } catch (e) {
            console.error('❌ خطأ في تفعيل SecurityCore:', e);
        }
    }
    
    const firebaseReady = await window.initializeFirebaseUnified();
    if (!firebaseReady) {
        hideLoader();
        if (typeof CoreUtils !== 'undefined' && CoreUtils.showToast) {
            CoreUtils.showToast('حدث خطأ في الاتصال.', 'warning');
        }
        return;
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered with scope:', registration.scope);
                    if (registration.active) {
                        registration.active.postMessage({
                            type: 'FIREBASE_CONFIG',
                            config: window.FIREBASE_CONFIG
                        });
                    }
                })
                .catch(error => {
                    console.error('❌ Service Worker registration failed:', error);
                });
        });
    }
    
    try {
        const initialTasks = [
            loadSiteConfig(),
            loadThemeColors()
        ];
        
        if (typeof window.loadCategoriesFromFirebase === 'function') {
            initialTasks.push(window.loadCategoriesFromFirebase());
        }

        await Promise.all(initialTasks);
        console.log('✅ تم تحميل الإعدادات الأساسية');
        
        setupAllEventListeners();
        setupSmartHeader();
        
        if (typeof window.initSearchSystem === 'function') {
            window.initSearchSystem();
        }
        
        updateAuthButtons();
        
        window.firebaseModules.onAuthStateChanged(window.auth, async (user) => {
            try {
                console.log('🔄 تغيرت حالة المصادقة:', user ? 'مستخدم مسجل' : 'لا يوجد مستخدم');
                
                if (user) {
                    await checkAdminPermissions(user.uid);
                    
                    const userDoc = await window.firebaseModules.getDoc(
                        window.firebaseModules.doc(window.db, 'users', user.uid)
                    );
                    
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    
                    AppState.setUser({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || userData.name,
                        photoURL: user.photoURL || userData.photoURL,
                        phone: userData.phone || '',
                        address: userData.address || '',
                        ...userData
                    }, false);
                    
                    await syncUserDataFromFirestore();
                    
                } else {
                    const guestUser = sessionStorage.getItem('guest_user');
                    if (guestUser) {
                        try {
                            const guest = JSON.parse(guestUser);
                            AppState.setUser(guest, true);
                        } catch(e) { 
                            AppState.reset(); 
                        }
                    } else {
                        AppState.reset();
                    }
                }
                
                if (typeof updateUserProfile === 'function') updateUserProfile();
                if (typeof updateCartCount === 'function') updateCartCount();
                if (typeof updateAdminButton === 'function') updateAdminButton();
                updateAuthButtons();
                
                hideLoader();
                
                if (window.location.hash) {
                    window.dispatchEvent(new Event('hashchange'));
                }
                
            } catch (error) {
                console.error('❌ خطأ في معالجة تغير حالة المصادقة:', error);
                if (typeof ErrorHandler !== 'undefined' && ErrorHandler.handle) {
                    ErrorHandler.handle(error, 'onAuthStateChanged');
                }
                hideLoader();
            }
        });
        
        setTimeout(() => {
            const loader = document.getElementById('initialLoader');
            if (loader && loader.style.display !== 'none') {
                console.warn('⚠️ إخفاء شاشة التحميل (خطة طوارئ)');
                forceHideLoader();
            }
        }, 8000);
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة التطبيق:', error);
        forceHideLoader();
        if (typeof CoreUtils !== 'undefined' && CoreUtils.showToast) {
            CoreUtils.showToast('حدث خطأ في تحميل التطبيق.', 'error');
        }
    }
}

// ======================== دوال مساعدة ========================

function hideLoader() {
    console.log('🔄 إخفاء شاشة التحميل الرئيسية...');
    const loader = document.getElementById('initialLoader');
    if (loader && loader.style.display !== 'none') {
        loader.style.transition = 'opacity 0.5s ease';
        loader.style.opacity = '0';
        setTimeout(() => {
            if (loader.style.opacity === '0') {
                loader.style.display = 'none';
                console.log('✅ تم إخفاء شاشة التحميل الرئيسية');
            }
        }, 500);
    }
    window.isLoading = false;
}

function forceHideLoader() {
    console.log('⏱️ إخفاء شاشة التحميل إجبارياً...');
    const loader = document.getElementById('initialLoader');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s ease';
        setTimeout(() => { 
            loader.style.display = 'none'; 
        }, 300);
    }
    window.isLoading = false;
}

// ======================== تحميل إعدادات الموقع ========================

async function loadSiteConfig() {
    try {
        return await loadWithCache('siteConfig', async () => {
            const db = window.db;
            if (!db) return null;
            
            const configRef = window.firebaseModules.doc(db, "settings", "store");
            const configSnap = await window.firebaseModules.getDoc(configRef);
            
            if (configSnap.exists()) {
                const settings = configSnap.data();
                AppState.setSettings(settings);
                updateUIWithSettings();
                return settings;
            }
            return null;
        });
    } catch (error) {
        console.error('خطأ في تحميل إعدادات الموقع:', error);
        return null;
    }
}

function updateUIWithSettings() {
    const settings = AppState.settings;
    if (!settings) return;
    
    if (settings.storeName) {
        const titleEl = document.getElementById('dynamicTitle');
        const storeNameEl = document.getElementById('siteStoreName');
        if (titleEl) titleEl.textContent = settings.storeName + ' | ' + (settings.strings?.app_name || 'متجر إليفن');
        if (storeNameEl) storeNameEl.textContent = settings.storeName;
    }
    
    if (settings.logo) {
        const logoElements = [
            document.getElementById('siteLogo'),
            document.getElementById('authLogo'),
            document.getElementById('footerLogo')
        ];
        
        logoElements.forEach(el => {
            if (el) {
                const optimizedUrl = typeof CoreUtils !== 'undefined' && CoreUtils.optimizeImageUrl ? 
                    CoreUtils.optimizeImageUrl(settings.logo, 100) : settings.logo;
                el.src = optimizedUrl;
            }
        });
    }
    
    const aboutStoreDesc = document.getElementById('aboutStoreDescription');
    if (aboutStoreDesc && settings.aboutUs) {
        const safeHTML = window.getSafeHTML || function(s) { return s; };
        aboutStoreDesc.innerHTML = safeHTML(settings.aboutUs);
    }
    
    const whatsappLink = document.getElementById('contactWhatsapp');
    if (whatsappLink) {
        const whatsappPhone = settings.whatsapp ? settings.whatsapp.replace(/\D/g, '') : (settings.phone ? settings.phone.replace(/\D/g, '') : (settings.strings?.default_whatsapp_phone || ''));
        whatsappLink.href = `https://wa.me/${whatsappPhone}`;
    }

    const instagramLink = document.getElementById('contactInstagram');
    if (instagramLink && settings.instagram) instagramLink.href = settings.instagram;

    const emailText = document.getElementById('contactEmailText');
    const emailLink = document.getElementById('contactEmail');
    if (emailText && settings.email) {
        emailText.textContent = settings.email;
        if (emailLink) emailLink.href = `mailto:${settings.email}`;
    }

    const phoneText = document.getElementById('contactPhoneText');
    const phoneLink = document.getElementById('contactPhone');
    if (phoneText && settings.phone) {
        phoneText.textContent = settings.phone;
        if (phoneLink) phoneLink.href = `tel:${settings.phone}`;
    }

    const addressText = document.getElementById('contactAddressText');
    if (addressText && settings.address) addressText.textContent = settings.address;
}

// ======================== تحميل الألوان ========================

async function loadThemeColors() {
    try {
        return await loadWithCache('theme', async () => {
            const db = window.db;
            if (!db) return null;
            
            const settingsRef = window.firebaseModules.doc(db, "settings", "store");
            const settingsSnap = await window.firebaseModules.getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data();
                const colors = settings.theme;
                if (colors) {
                    applyThemeColors(colors);
                    return colors;
                }
            }
            return null;
        });
    } catch (error) {
        console.error('خطأ في تحميل إعدادات الألوان:', error);
        return null;
    }
}

function applyThemeColors(colors) {
    const root = document.documentElement;
    
    if (colors.primaryColor) root.style.setProperty('--primary-color', colors.primaryColor);
    if (colors.secondaryColor) root.style.setProperty('--secondary-color', colors.secondaryColor);
    if (colors.successColor) root.style.setProperty('--success-color', colors.successColor);
    if (colors.dangerColor) root.style.setProperty('--danger-color', colors.dangerColor);
    if (colors.warningColor) root.style.setProperty('--warning-color', colors.warningColor);
    if (colors.lightColor) root.style.setProperty('--light-color', colors.lightColor);
    if (colors.buttonPressColor) root.style.setProperty('--button-press-color', colors.buttonPressColor);
}

// ======================== نظام التخزين المؤقت ========================

let cachedData = {
    products: { data: null, timestamp: 0 },
    settings: { data: null, timestamp: 0 },
    theme: { data: null, timestamp: 0 }
};

async function loadWithCache(key, loaderFn, maxAge = 300000) {
    const now = Date.now();
    
    if (cachedData[key]?.data && (now - cachedData[key].timestamp < maxAge)) {
        console.log(`📦 [Cache] تحميل ${key} من الذاكرة`);
        return cachedData[key].data;
    }
    
    const localCache = getLocalCache(key, maxAge);
    if (localCache) {
        cachedData[key] = { data: localCache, timestamp: now };
        console.log(`📦 [Cache] تحميل ${key} من localStorage`);
        return localCache;
    }
    
    try {
        console.log(`🔄 [Cache] جلب ${key} من المصدر...`);
        const data = await loaderFn();
        
        cachedData[key] = { data: data, timestamp: now };
        cacheLocally(key, data, now);
        
        console.log(`✅ [Cache] تم تخزين ${key} في الذاكرة`);
        return data;
    } catch (error) {
        console.error(`❌ [Cache] خطأ في جلب ${key}:`, error);
        return null;
    }
}

function cacheLocally(key, data, timestamp = Date.now()) {
    try {
        localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp }));
    } catch (e) {
        console.warn(`⚠️ [Cache] فشل حفظ ${key} في localStorage:`, e);
    }
}

function getLocalCache(key, maxAge = 600000) {
    try {
        const cached = localStorage.getItem(`cache_${key}`);
        if (!cached) return null;
        
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        if (now - parsed.timestamp > maxAge) {
            localStorage.removeItem(`cache_${key}`);
            return null;
        }
        
        return parsed.data;
    } catch (e) {
        return null;
    }
}

function invalidateCache(key) {
    if (key) {
        if (cachedData[key]) cachedData[key] = { data: null, timestamp: 0 };
        localStorage.removeItem(`cache_${key}`);
    } else {
        Object.keys(cachedData).forEach(k => cachedData[k] = { data: null, timestamp: 0 });
        Object.keys(localStorage).forEach(k => { if (k.startsWith('cache_')) localStorage.removeItem(k); });
    }
}

// ======================== مزامنة بيانات المستخدم ========================

async function syncUserDataFromFirestore() {
    if (!AppState.user || AppState.isGuest) return;
    
    try {
        const db = window.db;
        if (!db) return;
        
        const userRef = window.firebaseModules.doc(db, "users", AppState.user.uid);
        const userSnap = await window.firebaseModules.getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.cart && Array.isArray(data.cart)) AppState.setCart(data.cart);
            if (data.favorites && Array.isArray(data.favorites)) AppState.setFavorites(data.favorites);
            
            console.log('✅ تم مزامنة البيانات من السحابة');
            
            if (typeof updateCartCount === 'function') updateCartCount();
            if (typeof updateFavoritesDisplay === 'function') updateFavoritesDisplay();
        }
    } catch (error) {
        console.error('❌ خطأ في مزامنة البيانات:', error);
    }
}

// ======================== دوال المنتج ========================

async function fetchProductFromFirebase(productId) {
    if (!productId) return null;
    try {
        const db = window.db;
        if (!db || !window.firebaseModules) return null;
        
        const docSnap = await window.firebaseModules.getDoc(
            window.firebaseModules.doc(db, "products", productId)
        );
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                price: parseFloat(data.price) || 0,
                originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
                image: data.image || '/public/images/logo.png',
                name: data.name || 'منتج بدون اسم',
                categoryId: data.categoryId || data.category || 'عام',
                stock: data.stock || 0,
                description: data.description || 'لا يوجد وصف'
            };
        }
        return null;
    } catch (error) {
        console.error('❌ خطأ في جلب المنتج من Firebase:', error);
        return null;
    }
}

window.addToCart = async function(productId, quantity = 1) {
    console.log(`🛒 إضافة إلى السلة: ${productId} - الكمية: ${quantity}`);
    
    const product = await fetchProductFromFirebase(productId);
    
    if (!product) {
        if (typeof showToast === 'function') showToast('المنتج غير موجود', 'error');
        return;
    }
    
    const stock = product.stock || 0;
    if (stock <= 0) {
        if (typeof showToast === 'function') showToast('المنتج غير متوفر في المخزون', 'warning');
        return;
    }
    
    if (quantity > stock) {
        if (typeof showToast === 'function') showToast(`الكمية المطلوبة غير متوفرة. المخزون الحالي: ${stock}`, 'warning');
        return;
    }
    
    if (window.AppState) {
        window.AppState.addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            image: product.image,
            quantity: quantity,
            stock: stock
        });
    }
    
    if (typeof updateCartCount === 'function') updateCartCount();
    
    const cartSection = document.getElementById('cart');
    if (cartSection?.classList.contains('active') && typeof updateCartDisplay === 'function') {
        updateCartDisplay();
    }
    
    if (typeof showToast === 'function') {
        showToast(`تمت إضافة ${quantity} من "${product.name}" إلى السلة`, 'success');
    }
};

window.buyNowDirect = async function(productId, quantity = 1) {
    console.log(`⚡ شراء مباشر: ${productId} - الكمية: ${quantity}`);
    
    const product = await fetchProductFromFirebase(productId);
    
    if (!product) {
        if (typeof showToast === 'function') showToast('المنتج غير موجود', 'error');
        return;
    }
    
    const stock = product.stock || 0;
    if (stock <= 0) {
        if (typeof showToast === 'function') showToast('المنتج غير متوفر في المخزون', 'warning');
        return;
    }
    
    if (quantity > stock) {
        if (typeof showToast === 'function') showToast(`الكمية المطلوبة غير متوفرة. المخزون الحالي: ${stock}`, 'warning');
        return;
    }
    
    window.directPurchaseItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: quantity
    };
    
    if (typeof updateCartCount === 'function') updateCartCount();
    goToCheckout();
};

// ======================== دوال التحقق من الصلاحيات ========================

async function checkAdminPermissions(userId) {
    console.log('🔍 التحقق من صلاحيات المدير للمستخدم:', userId);
    
    try {
        const db = window.db;
        if (!db) {
            AppState.isAdmin = false;
            return false;
        }
        
        const userRef = window.firebaseModules.doc(db, "users", userId);
        const userSnap = await window.firebaseModules.getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const isAdmin = userData.isAdmin === true || userData.role === 'admin';
            AppState.isAdmin = isAdmin;
            
            if (isAdmin) {
                sessionStorage.setItem('isAdmin', 'true');
                sessionStorage.setItem('currentUid', userId);
            } else {
                sessionStorage.removeItem('isAdmin');
                sessionStorage.removeItem('currentUid');
            }
            
            console.log(isAdmin ? '✅ المستخدم أدمن' : '❌ المستخدم ليس أدمن');
        } else {
            AppState.isAdmin = false;
            sessionStorage.removeItem('isAdmin');
            sessionStorage.removeItem('currentUid');
        }
        
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        return AppState.isAdmin;
        
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحيات المستخدم:', error);
        AppState.isAdmin = false;
        if (typeof updateAdminButton === 'function') updateAdminButton();
        return false;
    }
}

function updateAdminButton() {
    const adminMobileLink = document.getElementById('adminMobileLink');
    
    if (adminMobileLink) {
        adminMobileLink.style.display = AppState.isAdmin && !AppState.isGuest ? 'block' : 'none';
    }
}

// ======================== دوال التنقل ========================

function showSection(sectionId) {
    console.log(`📱 التبديل إلى: ${sectionId}`);
    
    if (sectionId !== 'products') {
        clearSearchOnBack();
    }
    
    if (window.location.hash.substring(1) !== sectionId) {
        history.pushState(null, '', `#${sectionId}`);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.scrollTop = 0;
    }

    document.querySelectorAll('.nav-item, .mobile-nav-links a').forEach(item => {
        const itemSection = item.getAttribute('data-section');
        if (itemSection === sectionId || 
            (sectionId === 'my-orders' && itemSection === 'orders')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const sectionHandlers = {
        'cart': () => {
            if (typeof window.forceUpdateCartDisplay === 'function') {
                window.forceUpdateCartDisplay();
            }
        },
        'favorites': () => {
            if (typeof window.updateFavoritesDisplay === 'function') {
                window.updateFavoritesDisplay();
            }
        },
        'checkout': () => {
            setTimeout(() => {
                if (typeof window.updateCheckoutSummary === 'function') {
                    window.updateCheckoutSummary();
                }
            }, 200);
        },
        'profile': () => {
            setTimeout(() => {
                if (typeof window.updateUserProfile === 'function') {
                    window.updateUserProfile();
                }
            }, 200);
        },
        'home': () => {
            if (typeof window.initializeHomePage === 'function') {
                setTimeout(() => {
                    const homeGrid = document.getElementById('homeProductsGrid');
                    if (homeGrid && homeGrid.children.length === 0) {
                        if (typeof window.showLoadingState === 'function') {
                            window.showLoadingState('homeProductsGrid', 'جاري تحميل أحدث المنتجات...');
                        } else {
                            showInitialLoadingState();
                        }
                    }
                    window.initializeHomePage();
                }, 100);
            }
        },
        'products': () => {
            setTimeout(() => {
                if (typeof window.initializeProductsPage === 'function') {
                    const productsGrid = document.getElementById('productsGrid');
                    if (productsGrid && productsGrid.children.length === 0) {
                        if (typeof window.showLoadingState === 'function') {
                            window.showLoadingState('productsGrid', 'جاري تحميل المنتجات...');
                        } else {
                            showInitialLoadingState();
                        }
                    }
                    window.initializeProductsPage();
                }
            }, 100);
        },
        'my-orders': () => {
            setTimeout(() => {
                if (typeof window.checkAndLoadOrders === 'function') {
                    window.checkAndLoadOrders();
                }
            }, 100);
        }
    };
    
    const handler = sectionHandlers[sectionId];
    if (handler) handler();
    
    if (!AppState.navigationHistory.includes(sectionId)) {
        AppState.navigationHistory.push(sectionId);
    }
    
    updateHeaderState(sectionId);
    
    document.querySelectorAll('.section').forEach(sec => {
        if (sec) sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    document.dispatchEvent(new CustomEvent('sectionChanged', { 
        detail: { section: sectionId } 
    }));
}

function goBack() {
    clearSearchOnBack();
    showSection('home');
}

function updateHeaderState(sectionId) {
    const header = document.getElementById('mainHeader');
    const backBtn = document.getElementById('backBtn');
    const menuToggle = document.getElementById('menuToggle');
    const homeSearchContainer = document.getElementById('homeSearchContainer');
    const homeHeaderIcons = document.getElementById('homeHeaderIcons');
    
    if (!header) return;

    if (sectionId === 'home') {
        if (backBtn) backBtn.style.display = 'none';
        if (homeSearchContainer) homeSearchContainer.style.display = 'flex';
        if (menuToggle) menuToggle.style.display = 'flex';
        if (homeHeaderIcons) homeHeaderIcons.style.display = 'flex';
    } else {
        if (backBtn) backBtn.style.display = 'flex';
        if (homeSearchContainer) homeSearchContainer.style.display = 'none';
        if (menuToggle) menuToggle.style.display = 'flex';
        if (homeHeaderIcons) homeHeaderIcons.style.display = 'none';
    }
}

// ======================== تسجيل الخروج ========================

async function signOutUser() {
    console.log('🚪 تسجيل الخروج من main.js');
    
    if (AppState.isGuest) {
        console.log('👤 تسجيل خروج الضيف - تنظيف البيانات المحلية');
        sessionStorage.removeItem('guest_user');
        sessionStorage.removeItem('guest_cart');
        sessionStorage.removeItem('guest_favorites');
        AppState.reset();
        
        if (typeof updateAdminButton === 'function') updateAdminButton();
        if (typeof updateCartCount === 'function') updateCartCount();
        updateAuthButtons();
        hideLoader();
        
        window.location.href = '/login';
        return;
    }
    
    const loader = document.getElementById('initialLoader');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
    
    try {
        if (window.AuthModule && typeof window.AuthModule.logout === 'function') {
            console.log('✅ استخدام AuthModule.logout لتسجيل الخروج');
            await window.AuthModule.logout();
            return;
        }
        
        if (typeof window.signOutAndRedirect === 'function') {
            console.log('✅ استخدام window.signOutAndRedirect');
            await window.signOutAndRedirect();
            return;
        }
        
        console.log('⚠️ استخدام الحل الاحتياطي لتسجيل الخروج');
        sessionStorage.removeItem('guest_user');
        sessionStorage.removeItem('guest_cart');
        sessionStorage.removeItem('guest_favorites');
        
        if (window.auth && window.firebaseModules && window.firebaseModules.signOut) {
            try {
                await window.firebaseModules.signOut(window.auth);
                console.log('✅ تم تسجيل الخروج من Firebase');
            } catch (e) {
                console.warn('⚠️ Firebase signOut error:', e);
            }
        }
        
        AppState.reset();
        
        if (typeof updateAdminButton === 'function') updateAdminButton();
        if (typeof updateCartCount === 'function') updateCartCount();
        updateAuthButtons();
        hideLoader();
        
        setTimeout(() => {
            window.location.href = '/login';
        }, 300);
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج:', error);
        AppState.reset();
        window.location.href = '/login';
    }
}

// ======================== نظام البحث ========================

function initSearchSystem() {
    console.log('🔍 تهيئة نظام البحث...');
    
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = this.value.trim();
                if (query.length >= 2) {
                    executeSearch(query);
                }
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            const query = searchInput ? searchInput.value.trim() : '';
            if (query.length >= 2) {
                executeSearch(query);
            }
        });
    }
    
    console.log('✅ نظام البحث جاهز');
}

function executeSearch(query) {
    console.log('🔍 تنفيذ البحث:', query);
    
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
        if (typeof showToast === 'function') showToast('اكتب كلمتين على الأقل للبحث', 'info');
        return;
    }
    
    if (!window.allProducts || window.allProducts.length === 0) {
        if (typeof showToast === 'function') showToast('جاري تحميل المنتجات...', 'info');
        if (typeof window.fetchAllActiveProducts === 'function') {
            window.fetchAllActiveProducts().then(products => {
                window.allProducts = products;
                if (typeof window.dispatchProductsLoaded === 'function') {
                    window.dispatchProductsLoaded(products);
                }
                if (typeof window.performSearchWithProducts === 'function') {
                    window.performSearchWithProducts(cleanQuery);
                }
            });
        }
        return;
    }
    
    if (typeof window.performSearchWithProducts === 'function') {
        window.performSearchWithProducts(cleanQuery);
    }
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    
    if (searchTerm.length >= 2) {
        executeSearch(searchTerm);
    }
}

// ======================== إعداد الأحداث ========================

function setupAllEventListeners() {
    console.log('⚙️ إعداد جميع الأحداث...');
    
    setupNavigationEventListeners();
    setupAppEventListeners();
    setupModalEventListeners();
    setupFilterEventListeners();
    
    console.log('✅ جميع الأحداث جاهزة');
}

function setupNavigationEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const closeMenu = document.getElementById('closeMenu');
    const mobileNav = document.getElementById('mobileNav');
    const navOverlay = document.getElementById('navOverlay');
    
    const openMenu = () => {
        if (mobileNav) mobileNav.classList.add('active');
        if (navOverlay) navOverlay.classList.add('active');
        document.body.classList.add('menu-open');
        updateAuthButtons();
    };
    
    const closeMenuFunc = () => {
        if (mobileNav) mobileNav.classList.remove('active');
        if (navOverlay) navOverlay.classList.remove('active');
        document.body.classList.remove('menu-open');
    };
    
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (closeMenu) closeMenu.addEventListener('click', closeMenuFunc);
    if (navOverlay) navOverlay.addEventListener('click', closeMenuFunc);
    
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            navigateTo(sectionId);
            closeMenuFunc();
        });
    });
    
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeMenuFunc();
            setTimeout(() => {
                signOutUser();
            }, 200);
        });
    }
}

function setupAppEventListeners() {
    const buttons = {
        'continueShoppingBtn': () => navigateTo('products'),
        'browseProductsBtn': () => navigateTo('products'),
        'homeBtn': () => navigateTo('home'),
        'cartBtn': () => navigateTo('cart'),
        'favoritesBtn': () => navigateTo('favorites'),
        'profileBtn': () => navigateTo('profile'),
        'logoutBtn': signOutUser,
        'editProfileBtn': (typeof editProfile === 'function') ? editProfile : null,
        'saveProfileBtn': (typeof saveProfileChanges === 'function') ? saveProfileChanges : null,
        'clearCartBtn': (typeof clearCart === 'function') ? clearCart : null
    };
    
    for (const [btnId, action] of Object.entries(buttons)) {
        const btn = document.getElementById(btnId);
        if (btn && action && typeof action === 'function') {
            btn.addEventListener('click', action);
        }
    }
}

function setupModalEventListeners() {
    document.querySelectorAll('.close-modal, .btn-secondary.close-modal').forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        }
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        }
    });
    
    const confirmAddBtn = document.getElementById('confirmAddToCartBtn');
    if (confirmAddBtn) {
        confirmAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            confirmAddToCart(e);
        });
    }
    
    const confirmBuyBtn = document.getElementById('confirmBuyNowBtn');
    if (confirmBuyBtn) {
        confirmBuyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            confirmBuyNow(e);
        });
    }
}

function setupFilterEventListeners() {
    console.log('🔧 إعداد مستمعات أحداث الفلاتر...');
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            e.preventDefault();
            const categoryId = this.value;
            console.log('📁 تغيير فلتر الفئة:', categoryId);
            
            if (typeof window.filterByCategory === 'function') {
                window.filterByCategory(categoryId);
            }
        });
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const filterType = this.getAttribute('data-filter');
            if (typeof window.toggleFilter === 'function') {
                window.toggleFilter(filterType);
            }
        });
    });
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', function(e) {
            if (typeof window.changeSort === 'function') {
                window.changeSort(this.value);
            }
        });
    }
    
    console.log('✅ تم إعداد جميع مستمعات أحداث الفلاتر');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setupSmartHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll <= 0) {
            header.style.transform = 'translateY(0)';
            return;
        }
        
        if (currentScroll > lastScroll && currentScroll > 80) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        lastScroll = currentScroll;
    }, { passive: true });
    
    header.style.transition = 'transform 0.3s ease-in-out';
}

function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
    }
}

// ======================== دوال مساعدة للـ modal ========================
function confirmAddToCart(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log('✅ تأكيد إضافة للسلة');
    
    if (window.selectedProductForQuantity && window.selectedProductForQuantity.id) {
        const qtyEl = document.getElementById('modalQuantityDisplay');
        const quantity = qtyEl ? parseInt(qtyEl.textContent) || 1 : 1;
        console.log(`🛒 إضافة المنتج: ${window.selectedProductForQuantity.id}, الكمية: ${quantity}`);
        if (typeof window.addToCart === 'function') {
            window.addToCart(window.selectedProductForQuantity.id, quantity);
        }
    } else {
        console.warn('⚠️ لم يتم تحديد المنتج');
    }
    
    const modal = document.getElementById('quantityModal');
    if (modal) modal.classList.remove('active');
    window.selectedProductForQuantity = null;
}

function confirmBuyNow(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log('✅ تأكيد الشراء المباشر');
    
    if (window.selectedProductForQuantity && window.selectedProductForQuantity.id) {
        const qtyEl = document.getElementById('modalQuantityDisplay');
        const quantity = qtyEl ? parseInt(qtyEl.textContent) || 1 : 1;
        console.log(`⚡ شراء مباشر: ${window.selectedProductForQuantity.id}, الكمية: ${quantity}`);
        if (typeof window.buyNowDirect === 'function') {
            window.buyNowDirect(window.selectedProductForQuantity.id, quantity);
        }
    } else {
        console.warn('⚠️ لم يتم تحديد المنتج');
    }
    
    const modal = document.getElementById('quantityModal');
    if (modal) modal.classList.remove('active');
    window.selectedProductForQuantity = null;
}

function closeQuantityModal() {
    const modal = document.getElementById('quantityModal');
    if (modal) modal.classList.remove('active');
}

function closeProductDetailsModal() {
    const modal = document.getElementById('productDetailsModal');
    if (modal) modal.classList.remove('active');
}

function editProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.classList.add('active');
}

async function saveProfileChanges() {
    console.log('saveProfileChanges');
    if (typeof CoreUtils !== 'undefined' && CoreUtils.showToast) {
        CoreUtils.showToast('جاري حفظ التغييرات...', 'info');
    }
}

function clearCart() {
    if (confirm('هل أنت متأكد من تفريغ سلة التسوق؟')) {
        if (window.AppState) {
            window.AppState.setCart([]);
        } else {
            window.cartItems = [];
        }
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateCartDisplay === 'function') updateCartDisplay();
        if (typeof showToast === 'function') showToast('تم تفريغ السلة', 'success');
    }
}

// ======================== تهيئة التطبيق ========================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 بدء تحميل التطبيق (main.js)...');
    
    initLazyLoading();
    
    setTimeout(() => {
        updateAuthButtons();
    }, 500);
    
    setTimeout(() => {
        if (typeof initializeAppSafely === 'function') {
            initializeAppSafely();
        }
    }, 100);
});

window.addEventListener('load', function() {
    console.log('📄 الصفحة تم تحميلها بالكامل');
    
    updateAuthButtons();
    
    setTimeout(() => {
        const loader = document.getElementById('initialLoader');
        if (loader && loader.style.display !== 'none') {
            console.log('⚠️ شاشة التحميل لا تزال ظاهرة، إخفاء قسري...');
            forceHideLoader();
        }
    }, 2000);
    
    setTimeout(() => {
        if (typeof window.updateCategoriesOnLoad === 'function') {
            window.updateCategoriesOnLoad();
        }
    }, 500);
    
    if (window.location.hash) {
        window.dispatchEvent(new Event('hashchange'));
    }
});

window.addEventListener('error', function(e) {
    console.error('خطأ عام:', e);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('وعد مرفوض:', e.reason);
});

// تصدير الدوال العامة
window.initializeAppSafely = initializeAppSafely;
window.showSection = showSection;
window.navigateTo = navigateTo;
window.shareProduct = shareProduct;
window.performSearch = performSearch;
window.executeSearch = executeSearch;
window.initSearchSystem = initSearchSystem;
window.goBack = goBack;
window.signOutUser = signOutUser;
window.checkAdminPermissions = checkAdminPermissions;
window.updateAdminButton = updateAdminButton;
window.updateAuthButtons = updateAuthButtons;
window.updateHeaderState = updateHeaderState;
window.debounce = debounce;
window.loadWithCache = loadWithCache;
window.getLocalCache = getLocalCache;
window.invalidateCache = invalidateCache;
window.fetchProductFromFirebase = fetchProductFromFirebase;
window.addToCart = addToCart;
window.buyNowDirect = buyNowDirect;
window.clearSearchOnBack = clearSearchOnBack;
window.showInitialLoadingState = showInitialLoadingState;
window.hideLoadingState = hideLoadingState;
window.replaceLoadingWithProducts = replaceLoadingWithProducts;
window.confirmAddToCart = confirmAddToCart;
window.confirmBuyNow = confirmBuyNow;
window.closeQuantityModal = closeQuantityModal;
window.closeProductDetailsModal = closeProductDetailsModal;
window.editProfile = editProfile;
window.saveProfileChanges = saveProfileChanges;
window.clearCart = clearCart;
window.goToCheckout = goToCheckout;

console.log('🚀 main.js النهائي المُصلح جاهز للعمل!');