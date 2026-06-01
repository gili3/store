// products-system-improved.js - نظام إدارة المنتجات والتحميل اللانهائي (نسخة محسنة مع رسائل محسنة)
// ======================== 1. دوال الأمان والتعقيم (XSS Protection) ========================

const secureHTML = (function() {
    if (typeof DOMParser !== 'undefined') {
        return function(str) {
            if (!str) return '';
            try {
                const doc = new DOMParser().parseFromString(String(str), 'text/html');
                return doc.body.textContent || '';
            } catch (e) {
                console.warn('DOMParser failed, falling back to manual sanitization:', e);
                return String(str).replace(/[<>\"']/g, '');
            }
        };
    }
    return function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
})();

function getSafeHTML(str) {
    if (window.SecurityCore && typeof window.SecurityCore.sanitizeHTML === 'function') {
        return window.SecurityCore.sanitizeHTML(str);
    }
    if (window.safeHTML && typeof window.safeHTML === 'function') {
        return window.safeHTML(str);
    }
    return secureHTML(str);
}

window.safeHTML = window.safeHTML || getSafeHTML;
window.getSafeHTML = getSafeHTML;

// ======================== 2. الثوابت والمتغيرات العامة ========================

const Constants = {
    FILTERS_KEY: 'products_filters',
    DEFAULT_FILTERS: { q: '', cat: '', sort: 'newest', filter: '' },
    PRODUCTS_PER_PAGE: 8,
    LOADING_SKELETON_COUNT: 8,
    DEFAULT_IMAGE_PLACEHOLDER: '/public/images/logo.png',
    FIREBASE_PRODUCT_LIMIT: 500,
    INFINITE_SCROLL_ROOT_MARGIN: '200px',
    INFINITE_SCROLL_THRESHOLD: 0.1,
    SEARCH_MIN_LENGTH: 2,
    SEARCH_DEBOUNCE_TIME: 300,
    MAX_RETRY_COUNT: 3,
    RETRY_DELAY: 2000
};

// ======================== 3. فئة ProductSystem ========================

class ProductSystem {
    constructor() {
        this._injectStyles();
        this.allProducts = [];
        this.lastProductDoc = null;
        this.hasMoreProducts = true;
        this.isLoadingProducts = false;
        this.productsObserver = null;

        this.homeLastProductDoc = null;
        this.homeHasMoreProducts = true;
        this.homeIsLoadingProducts = false;
        this.homeObserver = null;

        this.currentFilters = this._getFilters();
        this.searchTimeout = null;
        this.retryCount = 0;
        this.isOffline = !navigator.onLine;

        this._bindGlobalFunctions();
        this._setupEventListeners();
        this._setupNetworkListeners();
    }

    _bindGlobalFunctions() {
        window.executeSearch = this.executeSearch.bind(this);
        window.filterByCategory = this.filterByCategory.bind(this);
        window.toggleFilter = this.toggleFilter.bind(this);
        window.changeSort = this.changeSort.bind(this);
        window.clearAllFilters = this.clearAllFilters.bind(this);
        window.resetProductsState = this.resetAndLoad.bind(this);
        window.loadProducts = this.loadProducts.bind(this);
        window.loadHomeProducts = this.loadHomeProducts.bind(this);
        window.resetAllFilters = this.clearAllFilters.bind(this);
        window.clearSearchAndReload = this.clearSearchAndReload.bind(this);
        window.initializeHomePage = this.initializeHomePage.bind(this);
        window.initializeProductsPage = this.initializeProductsPage.bind(this);
        window.openProductDetails = this.openProductDetails.bind(this);
        window.closeProductDetailsModal = this.closeProductDetailsModal.bind(this);
        window.openQuantityModal = this.openQuantityModal.bind(this);
        window.closeQuantityModal = this.closeQuantityModal.bind(this);
        window.changeModalQuantity = this.changeModalQuantity.bind(this);
        window.confirmAddToCart = this.confirmAddToCart.bind(this);
        window.confirmBuyNow = this.confirmBuyNow.bind(this);
        window.resetObservers = this.resetObservers.bind(this);
        window.setupProductsInfiniteScroll = this.setupProductsInfiniteScroll.bind(this);
        window.setupHomeInfiniteScroll = this.setupHomeInfiniteScroll.bind(this);
        window.toggleFavorite = this.toggleFavorite.bind(this);
        window.updateFavoriteButtons = this.updateFavoriteButtons.bind(this);
        window.updateFavoritesDisplay = this.updateFavoritesDisplay.bind(this);
        window.fetchAllActiveProducts = this.fetchAllActiveProducts.bind(this);
        window.getFilters = this._getFilters.bind(this);
        window.syncUI = this.syncUI.bind(this);
        window.dispatchProductsLoaded = this._dispatchProductsLoaded.bind(this);
        window.performSearchWithProducts = this._performSearchWithProducts.bind(this);
        window.showLoadingState = this._showLoadingState.bind(this);
        window.getCategoryName = this._getCategoryName.bind(this);
    }

    _setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                const homeSection = document.getElementById('home');
                if (homeSection?.classList.contains('active')) this.initializeHomePage();
                const productsSection = document.getElementById('products');
                if (productsSection?.classList.contains('active')) this.initializeProductsPage();
            }, 300);
        });

        window.addEventListener('allProductsUpdated', (e) => {
            if (e.detail && e.detail.products) {
                console.log('✅ تم تحديث allProducts من حدث allProductsUpdated');
            }
        });

        if (window.AppState) {
            window.AppState.subscribe('favorites', () => {
                this.updateFavoriteButtons();
                this.updateFavoritesDisplay();
            });
        }
    }

    _setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOffline = false;
            this.retryCount = 0;
            console.log('🌐 تم استعادة الاتصال بالإنترنت');
            this._showToast('تم استعادة الاتصال بالإنترنت ✅', 'success');
            this.resetAndLoad();
        });
        
        window.addEventListener('offline', () => {
            this.isOffline = true;
            console.log('⚠️ تم فقدان الاتصال بالإنترنت');
            this._showToast('تم فقدان الاتصال بالإنترنت ⚠️', 'warning');
        });
    }

    _setupLazyLoadingObserver() {
        if (!('IntersectionObserver' in window)) return;
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '50px' });
        
        this.lazyImageObserver = imageObserver;
    }

    // ======================== 3.1 إدارة الفلاتر ========================

    _getFilters() {
        try {
            const saved = sessionStorage.getItem(Constants.FILTERS_KEY);
            return saved ? { ...Constants.DEFAULT_FILTERS, ...JSON.parse(saved) } : { ...Constants.DEFAULT_FILTERS };
        } catch (e) {
            console.error('❌ خطأ في جلب الفلاتر من Session Storage:', e);
            return { ...Constants.DEFAULT_FILTERS };
        }
    }

    _saveFilters(filters) {
        try {
            sessionStorage.setItem(Constants.FILTERS_KEY, JSON.stringify(filters));
            this.currentFilters = filters;
        } catch (e) {
            console.error('❌ خطأ في حفظ الفلاتر إلى Session Storage:', e);
        }
    }

    syncUI() {
        const f = this.currentFilters;
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = f.q || '';
        const catSelect = document.getElementById('categoryFilter');
        if (catSelect) catSelect.value = f.cat || '';
        const sortSelect = document.getElementById('sortFilter');
        if (sortSelect) sortSelect.value = f.sort || 'newest';
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === f.filter);
        });
    }

    // ======================== 3.2 دوال الفلاتر العامة ========================

    executeSearch(query, immediate = false) {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);

        if (!query || query.trim().length < Constants.SEARCH_MIN_LENGTH) {
            if (immediate) this._showToast(`اكتب ${Constants.SEARCH_MIN_LENGTH} أحرف على الأقل للبحث 🔍`, 'info');
            return;
        }

        const cleanQuery = query.trim();

        const perform = () => {
            console.log('🔍 تنفيذ البحث:', cleanQuery);
            if (!this.allProducts || this.allProducts.length === 0) {
                this._showToast('جاري تحميل المنتجات للبحث...', 'info');
                this.fetchAllActiveProducts().then(products => {
                    this.allProducts = products;
                    this._dispatchProductsLoaded(products);
                    this._performSearchWithProducts(cleanQuery);
                }).catch(error => {
                    console.error('❌ خطأ في تحميل المنتجات للبحث:', error);
                    this._showToast('فشل تحميل المنتجات للبحث 😔', 'error');
                });
                return;
            }
            this._performSearchWithProducts(cleanQuery);
        };

        if (immediate) {
            perform();
        } else {
            this.searchTimeout = setTimeout(perform, Constants.SEARCH_DEBOUNCE_TIME);
        }
    }

    _performSearchWithProducts(query) {
        const f = { ...this.currentFilters };
        f.q = query;
        f.cat = '';
        this._saveFilters(f);
        this.syncUI();

        if (typeof showSection === 'function') {
            showSection('products');
        }

        setTimeout(() => {
            this.resetAndLoad();
        }, 200);
    }

    filterByCategory(catId) {
        const f = { ...this.currentFilters };
        f.cat = catId || '';
        f.q = '';
        this._saveFilters(f);
        this.syncUI();
        this.resetAndLoad();
    }

    toggleFilter(filterType) {
        const f = { ...this.currentFilters };
        f.filter = f.filter === filterType ? '' : filterType;
        this._saveFilters(f);
        this.syncUI();
        this.resetAndLoad();
    }

    changeSort(sortVal) {
        const f = { ...this.currentFilters };
        f.sort = sortVal || 'newest';
        this._saveFilters(f);
        this.syncUI();
        this.resetAndLoad();
    }

    clearAllFilters() {
        this._saveFilters({ ...Constants.DEFAULT_FILTERS });
        this.syncUI();
        this.resetAndLoad();
        this._showToast('تم إعادة تعيين جميع الفلاتر 🔄', 'info');
    }

    clearSearchAndReload() {
        const f = { ...this.currentFilters };
        f.q = '';
        this._saveFilters(f);
        this.syncUI();
        this.resetAndLoad();
    }

    // ======================== 3.3 دوال مساعدة ========================

    _localFormatNumber(num) {
        if (num === null || num === undefined) return '0';
        if (typeof window.formatNumber === 'function') return window.formatNumber(num);
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    _getFirebaseReference() {
        return window.firebaseDb || window.db || null;
    }

    _normalizeArabicText(text) {
        if (!text) return '';
        return String(text)
            .replace(/[إأٱآا]/g, 'ا')
            .replace(/[ىي]/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/[ؤئ]/g, 'ء')
            .toLowerCase()
            .trim();
    }

    _dispatchProductsLoaded(products) {
        window.dispatchEvent(new CustomEvent('allProductsUpdated', {
            detail: { products: products }
        }));
    }

    _showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }

    _getCategoryName(categoryId) {
        if (!categoryId) return 'منتجات';
        if (window.CATEGORIES && Array.isArray(window.CATEGORIES)) {
            const category = window.CATEGORIES.find(c => c.id === categoryId);
            if (category) return category.name;
        }
        return 'منتجات';
    }

    // ======================== 3.4 دوال البحث المحلي ========================

    filterProductsBySearch(products, query) {
        if (!query || query.length < Constants.SEARCH_MIN_LENGTH) return products;

        const cleanedQuery = query.toLowerCase().trim();
        const normalizedQuery = this._normalizeArabicText(query);
        const queryWords = cleanedQuery.split(' ').filter(word => word.length > 0);

        return products.filter(product => {
            if (!product || !product.name) return false;

            const name = (product.name || '').toLowerCase();
            const desc = (product.description || '').toLowerCase();
            const categoryName = (product.categoryName || product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();

            const nameNormalized = this._normalizeArabicText(name);
            const descNormalized = this._normalizeArabicText(desc);

            const matches = (
                name.includes(cleanedQuery) ||
                desc.includes(cleanedQuery) ||
                categoryName.includes(cleanedQuery) ||
                brand.includes(cleanedQuery) ||
                nameNormalized.includes(normalizedQuery) ||
                descNormalized.includes(normalizedQuery) ||
                queryWords.every(word => name.includes(word)) ||
                queryWords.some(word => name.startsWith(word)) ||
                name.replace(/\s+/g, '').includes(cleanedQuery.replace(/\s+/g, ''))
            );

            if (product.keywords && Array.isArray(product.keywords)) {
                const normalizedKeywords = product.keywords.map(kw => this._normalizeArabicText(kw));
                if (normalizedKeywords.some(kw => kw.includes(normalizedQuery))) {
                    return true;
                }
            }

            return matches;
        });
    }

    // ======================== 3.5 إعداد مراقبي التحميل اللانهائي ========================

    setupHomeInfiniteScroll() {
        const sentinel = document.getElementById('homeScrollSentinel');
        if (!sentinel) return;
        if (this.homeObserver) this.homeObserver.disconnect();
        this.homeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.homeHasMoreProducts && !this.homeIsLoadingProducts) {
                    this.loadHomeProducts(true);
                }
            });
        }, { root: null, rootMargin: Constants.INFINITE_SCROLL_ROOT_MARGIN, threshold: Constants.INFINITE_SCROLL_THRESHOLD });
        this.homeObserver.observe(sentinel);
    }

    setupProductsInfiniteScroll() {
        const sentinel = document.getElementById('productsScrollSentinel');
        if (!sentinel) return;
        if (this.productsObserver) this.productsObserver.disconnect();
        this.productsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.hasMoreProducts && !this.isLoadingProducts) {
                    this.loadProducts(true);
                }
            });
        }, { root: null, rootMargin: Constants.INFINITE_SCROLL_ROOT_MARGIN, threshold: Constants.INFINITE_SCROLL_THRESHOLD });
        this.productsObserver.observe(sentinel);
    }

    resetObservers() {
        if (this.productsObserver) { this.productsObserver.disconnect(); this.productsObserver = null; }
        if (this.homeObserver) { this.homeObserver.disconnect(); this.homeObserver = null; }
        setTimeout(() => {
            const activeSection = document.querySelector('.section.active');
            if (activeSection?.id === 'home') this.setupHomeInfiniteScroll();
            else if (activeSection?.id === 'products') this.setupProductsInfiniteScroll();
        }, 300);
    }

    // ======================== 3.6 جلب المنتجات من Firestore ========================

    async fetchAllActiveProducts() {
        try {
            const db = this._getFirebaseReference();
            if (!db || !window.firebaseModules) {
                console.warn('⚠️ Firebase غير جاهز أو firebaseModules غير معرف.');
                return this._loadFromLocalCache() || [];
            }

            const productsRef = window.firebaseModules.collection(db, 'products');
            const q = window.firebaseModules.query(
                productsRef,
                window.firebaseModules.where('isActive', '==', true),
                window.firebaseModules.limit(Constants.FIREBASE_PRODUCT_LIMIT)
            );

            const querySnapshot = await window.firebaseModules.getDocs(q);

            const products = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                products.push({
                    id: doc.id,
                    ...data,
                    price: parseFloat(data.price) || 0,
                    originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
                    image: data.image || Constants.DEFAULT_IMAGE_PLACEHOLDER,
                    name: data.name || 'منتج بدون اسم',
                    name_lowercase: (data.name || '').toLowerCase(),
                    categoryId: data.categoryId || data.category || 'عام',
                    stock: data.stock || 0,
                    description: data.description || ''
                });
            });
            
            this._saveToLocalCache(products);
            this.retryCount = 0;
            
            return products;
        } catch (error) {
            console.error('❌ خطأ في جلب جميع المنتجات النشطة:', error);
            this.retryCount++;
            
            const cached = this._loadFromLocalCache();
            if (cached && cached.length > 0) {
                this._showToast('تم تحميل المنتجات من الذاكرة المؤقتة 📦', 'warning');
                return cached;
            }
            
            if (this.retryCount <= Constants.MAX_RETRY_COUNT) {
                this._showToast('جاري إعادة المحاولة... 🔄', 'info');
                await new Promise(resolve => setTimeout(resolve, Constants.RETRY_DELAY));
                return this.fetchAllActiveProducts();
            }
            
            this._showToast('فشل في جلب المنتجات. يرجى التحقق من الاتصال 😔', 'error');
            return [];
        }
    }

    _saveToLocalCache(products) {
        try {
            const cacheData = {
                products: products.slice(0, 100),
                timestamp: Date.now()
            };
            sessionStorage.setItem('cached_products', JSON.stringify(cacheData));
        } catch (e) {
            console.warn('⚠️ فشل حفظ المنتجات في التخزين المؤقت:', e);
        }
    }

    _loadFromLocalCache() {
        try {
            const cached = sessionStorage.getItem('cached_products');
            if (!cached) return null;
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp > 30 * 60 * 1000) {
                sessionStorage.removeItem('cached_products');
                return null;
            }
            return parsed.products;
        } catch (e) {
            return null;
        }
    }

    async loadProducts(append = false) {
        if (this.isLoadingProducts || this.isOffline) {
            if (this.isOffline) {
                this._showToast('أنت غير متصل بالإنترنت 📡', 'warning');
                this._showOfflineProducts();
            }
            return;
        }
        
        let productsToDisplay = [];
        
        if (!append) {
            this._showLoadingIndicator(true, 'productsGrid', Constants.LOADING_SKELETON_COUNT);
        } else {
            this._showLoadingMoreMessage(true, 'productsGrid');
        }
        this.isLoadingProducts = true;

        try {
            const db = this._getFirebaseReference();
            if (!db || !window.firebaseModules) {
                console.warn('⚠️ Firebase غير جاهز أو firebaseModules غير معرف.');
                this._showToast('نظام قاعدة البيانات غير جاهز ⚠️', 'error');
                this.isLoadingProducts = false;
                this._showLoadingIndicator(false, 'productsGrid');
                this._showLoadingMoreMessage(false, 'productsGrid');
                return;
            }

            const productsRef = window.firebaseModules.collection(db, 'products');
            let q = window.firebaseModules.query(
                productsRef,
                window.firebaseModules.where('isActive', '==', true)
            );

            const filters = this.currentFilters;

            if (filters.cat) {
                q = window.firebaseModules.query(q, window.firebaseModules.where('categoryId', '==', filters.cat));
            }
            if (filters.filter === 'sale') {
                q = window.firebaseModules.query(q, window.firebaseModules.where('originalPrice', '>', 0));
            }
            if (filters.filter === 'new') {
                q = window.firebaseModules.query(q, window.firebaseModules.orderBy('createdAt', 'desc'));
            }

            switch (filters.sort) {
                case 'newest':
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('createdAt', 'desc'));
                    break;
                case 'price_asc':
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('price', 'asc'));
                    break;
                case 'price_desc':
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('price', 'desc'));
                    break;
                case 'name_asc':
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('name_lowercase', 'asc'));
                    break;
                case 'name_desc':
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('name_lowercase', 'desc'));
                    break;
                default:
                    q = window.firebaseModules.query(q, window.firebaseModules.orderBy('createdAt', 'desc'));
                    break;
            }

            if (this.lastProductDoc && append) {
                q = window.firebaseModules.query(q, window.firebaseModules.startAfter(this.lastProductDoc));
            }
            q = window.firebaseModules.query(q, window.firebaseModules.limit(Constants.PRODUCTS_PER_PAGE));

            const querySnapshot = await window.firebaseModules.getDocs(q);
            const fetchedProducts = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                fetchedProducts.push({
                    id: doc.id,
                    ...data,
                    price: parseFloat(data.price) || 0,
                    originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
                    image: data.image || Constants.DEFAULT_IMAGE_PLACEHOLDER,
                    name: data.name || 'منتج بدون اسم',
                    name_lowercase: (data.name || '').toLowerCase(),
                    categoryId: data.categoryId || data.category || 'عام',
                    stock: data.stock || 0,
                    description: data.description || ''
                });
            });

            this.hasMoreProducts = fetchedProducts.length === Constants.PRODUCTS_PER_PAGE;
            if (this.hasMoreProducts) {
                this.lastProductDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            } else {
                this.lastProductDoc = null;
            }

            productsToDisplay = fetchedProducts;

            if (filters.q && filters.q.length >= Constants.SEARCH_MIN_LENGTH) {
                if (this.allProducts.length === 0) {
                    this.allProducts = await this.fetchAllActiveProducts();
                    this._dispatchProductsLoaded(this.allProducts);
                }
                productsToDisplay = this.filterProductsBySearch(this.allProducts, filters.q);
                this.hasMoreProducts = false;
            }

            if (filters.q && filters.q.length >= Constants.SEARCH_MIN_LENGTH) {
                this.displayProducts(productsToDisplay, false);
            } else if (append) {
                this._showLoadingMoreMessage(false, 'productsGrid');
                this.displayProducts(productsToDisplay, true);
            } else {
                this.displayProducts(productsToDisplay, false);
            }

            this.retryCount = 0;

        } catch (error) {
            console.error('❌ خطأ في تحميل المنتجات:', error);
            this.retryCount++;
            
            if (this.retryCount <= Constants.MAX_RETRY_COUNT) {
                this._showToast(`جاري إعادة المحاولة (${this.retryCount}/${Constants.MAX_RETRY_COUNT})... 🔄`, 'info');
                await new Promise(resolve => setTimeout(resolve, Constants.RETRY_DELAY));
                this.isLoadingProducts = false;
                return this.loadProducts(append);
            }
            
            this._showToast('فشل في تحميل المنتجات. يرجى المحاولة لاحقاً 😔', 'error');
            this.hasMoreProducts = false;
        } finally {
            this.isLoadingProducts = false;
            this._showLoadingIndicator(false, 'productsGrid');
            this._showLoadingMoreMessage(false, 'productsGrid');
            
            if (productsToDisplay.length === 0 && !append) {
                const currentFilters = this.currentFilters;
                this._showEmptyState(currentFilters);
            }
        }
    }

    async loadHomeProducts(append = false) {
        if (this.homeIsLoadingProducts || this.isOffline) {
            if (this.isOffline && !append) {
                this._showOfflineProducts('homeProductsGrid');
            }
            return;
        }
        if (!append) {
            this._showLoadingIndicator(true, 'homeProductsGrid', Constants.LOADING_SKELETON_COUNT);
        } else {
            this._showLoadingMoreMessage(true, 'homeProductsGrid');
        }
        this.homeIsLoadingProducts = true;

        try {
            const db = this._getFirebaseReference();
            if (!db || !window.firebaseModules) {
                console.warn('⚠️ Firebase غير جاهز أو firebaseModules غير معرف.');
                this._showToast('نظام قاعدة البيانات غير جاهز ⚠️', 'error');
                this.homeIsLoadingProducts = false;
                this._showLoadingIndicator(false, 'homeProductsGrid');
                this._showLoadingMoreMessage(false, 'homeProductsGrid');
                return;
            }

            const productsRef = window.firebaseModules.collection(db, 'products');
            let q = window.firebaseModules.query(
                productsRef,
                window.firebaseModules.where('isActive', '==', true),
                window.firebaseModules.orderBy('createdAt', 'desc')
            );

            if (this.homeLastProductDoc && append) {
                q = window.firebaseModules.query(q, window.firebaseModules.startAfter(this.homeLastProductDoc));
            }
            q = window.firebaseModules.query(q, window.firebaseModules.limit(Constants.PRODUCTS_PER_PAGE));

            const querySnapshot = await window.firebaseModules.getDocs(q);
            const fetchedProducts = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                fetchedProducts.push({
                    id: doc.id,
                    ...data,
                    price: parseFloat(data.price) || 0,
                    originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
                    image: data.image || Constants.DEFAULT_IMAGE_PLACEHOLDER,
                    name: data.name || 'منتج بدون اسم',
                    name_lowercase: (data.name || '').toLowerCase(),
                    categoryId: data.categoryId || data.category || 'عام',
                    stock: data.stock || 0,
                    description: data.description || ''
                });
            });

            this.homeHasMoreProducts = fetchedProducts.length === Constants.PRODUCTS_PER_PAGE;
            if (this.homeHasMoreProducts) {
                this.homeLastProductDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            } else {
                this.homeLastProductDoc = null;
            }

            if (append) {
                this._showLoadingMoreMessage(false, 'homeProductsGrid');
                this.displayHomeProducts(fetchedProducts, true);
            } else {
                this.displayHomeProducts(fetchedProducts, false);
            }

            if (fetchedProducts.length === 0 && !append) {
                this._showEmptyState({ q: '', cat: '' }, 'homeProductsGrid', true);
            }

            this.retryCount = 0;

        } catch (error) {
            console.error('❌ خطأ في تحميل منتجات الصفحة الرئيسية:', error);
            this.retryCount++;
            if (this.retryCount <= Constants.MAX_RETRY_COUNT) {
                await new Promise(resolve => setTimeout(resolve, Constants.RETRY_DELAY));
                this.homeIsLoadingProducts = false;
                return this.loadHomeProducts(append);
            }
            this._showToast('فشل في تحميل منتجات الصفحة الرئيسية 😔', 'error');
            this.homeHasMoreProducts = false;
        } finally {
            this.homeIsLoadingProducts = false;
            this._showLoadingIndicator(false, 'homeProductsGrid');
            this._showLoadingMoreMessage(false, 'homeProductsGrid');
        }
    }

    _showOfflineProducts(gridId = 'productsGrid') {
        const cached = this._loadFromLocalCache();
        if (cached && cached.length > 0) {
            if (gridId === 'productsGrid') {
                this.displayProducts(cached, false);
            } else {
                this.displayHomeProducts(cached, false);
            }
            this.hasMoreProducts = false;
            this.homeHasMoreProducts = false;
        } else {
            const grid = document.getElementById(gridId);
            if (grid) {
                grid.innerHTML = this._generateOfflineMessage();
            }
        }
    }

    _generateOfflineMessage() {
        return `
            <div class="no-products-container-enhanced">
                <div class="no-products-icon">
                    <i class="fas fa-wifi-slash"></i>
                </div>
                <h3>لا يوجد اتصال بالإنترنت 📡</h3>
                <p>يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى</p>
                <button onclick="location.reload()" class="btn-filter-action primary">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }

    resetAndLoad() {
        this.lastProductDoc = null;
        this.hasMoreProducts = true;
        this.isLoadingProducts = false;
        this.retryCount = 0;
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '';
            this._showLoadingIndicator(true, 'productsGrid', Constants.LOADING_SKELETON_COUNT);
        }
        this.resetObservers();
        this.loadProducts();
    }

    // ✅ دالة جديدة للتحكم في رسالة "تحميل المزيد"
    _showLoadingMoreMessage(show, gridId) {
        const sentinelId = gridId === 'productsGrid' ? 'productsScrollSentinel' : 'homeScrollSentinel';
        const sentinel = document.getElementById(sentinelId);
        if (!sentinel) return;

        let loaderDiv = document.getElementById('dynamicLoaderMsg');
        if (show) {
            if (!loaderDiv) {
                loaderDiv = document.createElement('div');
                loaderDiv.id = 'dynamicLoaderMsg';
                loaderDiv.className = 'loading-more';
                loaderDiv.innerHTML = `
                    <div class="loading-spinner-small"></div>
                    <p>جاري تحميل المزيد من المنتجات...</p>
                `;
                sentinel.parentNode.insertBefore(loaderDiv, sentinel);
            }
        } else {
            if (loaderDiv) loaderDiv.remove();
        }
    }

    // ======================== 3.7 عرض المنتجات (بطاقات محسنة) ========================

    _generateSkeletonLoaderHTML(count) {
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="product-card-enhanced skeleton-loader">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-heart"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-category"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                        <div class="skeleton-actions">
                            <div class="skeleton-button"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        return `<div class="skeleton-loader-container">${skeletonHTML}</div>`;
    }

    displayProducts(productsToDisplay, append = false) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
        const html = productsToDisplay.map(p => this._generateProductCardHTML(p, currency)).join('');
        if (append) {
            productsGrid.insertAdjacentHTML('beforeend', html);
        } else {
            productsGrid.innerHTML = html;
        }

        const f = this.currentFilters;
        if (f.q && f.q.length >= Constants.SEARCH_MIN_LENGTH && !append && productsToDisplay.length > 0) {
            const searchInfo = document.createElement('div');
            searchInfo.className = 'search-results-info';
            searchInfo.innerHTML = `
                <i class="fas fa-search"></i>
                <span>نتائج البحث عن "${getSafeHTML(f.q)}" (${productsToDisplay.length} منتج)</span>
            `;
            productsGrid.prepend(searchInfo);
        }

        if (!this.hasMoreProducts && productsToDisplay.length > 0 && append) {
            this._addEndOfProductsMessage(productsGrid);
        }

        setTimeout(() => this.updateFavoriteButtons(), 100);
        this._animateCardsOnScroll();
    }

    displayHomeProducts(products, append = false) {
        const homeGrid = document.getElementById('homeProductsGrid');
        if (!homeGrid) return;
        const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
        const html = products.map(p => this._generateProductCardHTML(p, currency)).join('');
        if (append) {
            homeGrid.insertAdjacentHTML('beforeend', html);
        } else {
            homeGrid.innerHTML = html;
        }

        if (!this.homeHasMoreProducts && products.length > 0 && append) {
            this._addEndOfProductsMessage(homeGrid, true);
        }

        setTimeout(() => this.updateFavoriteButtons(), 100);
        this._animateCardsOnScroll();
    }

    // ✅ تعديل دالة عرض نهاية المنتجات (تم إلغاء إضافة أي رسالة)
    _addEndOfProductsMessage(grid, isHome = false) {
        // تم إلغاء هذه الدالة بالكامل - لا نضيف أي رسالة عند نهاية المنتجات
        return;
    }

    _animateCardsOnScroll() {
        const cards = document.querySelectorAll('.product-card-enhanced:not(.animated)');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        cards.forEach(card => {
            card.classList.add('animated');
            observer.observe(card);
        });
    }

    _generateProductCardHTML(product, currency) {
        const favorites = window.AppState?.favorites || [];
        const isInFavorites = favorites.some(f => f?.id === product.id);
        const hasSale = product.originalPrice && product.originalPrice > product.price;
        const discount = hasSale ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
        const imageUrl = product.image || Constants.DEFAULT_IMAGE_PLACEHOLDER;
        const isOutOfStock = product.stock <= 0 && product.price > 0;

        const categoryName = this._getCategoryName(product.categoryId);
        const safeName = getSafeHTML(product.name || 'منتج بدون اسم');
        const safeCategory = getSafeHTML(categoryName);
        const safeId = String(product.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const shortDescription = product.description ? 
            getSafeHTML(product.description.substring(0, 80) + (product.description.length > 80 ? '...' : '')) : 
            '';

        let badgeHTML = '';
        if (hasSale) {
            badgeHTML = `<div class="product-badge badge-sale">-${discount}%</div>`;
        } else if (product.isNew) {
            badgeHTML = '<div class="product-badge badge-new">جديد ✨</div>';
        } else if (product.isBest) {
            badgeHTML = '<div class="product-badge badge-best">🔥 الأكثر مبيعاً</div>';
        }

        let stockStatusHTML = '';
        if (isOutOfStock) {
            stockStatusHTML = '<div class="out-of-stock-overlay">نفذت الكمية</div>';
        }

        return `
            <div class="product-card-enhanced" data-id="${safeId}" data-aos="fade-up">
                <div class="product-card-inner">
                    <div class="product-image-wrapper" onclick="openProductDetails('${safeId}')">
                        ${badgeHTML}
                        ${stockStatusHTML}
                        <img src="${imageUrl}" 
                             alt="${safeName}" 
                             loading="lazy" 
                             class="product-image"
                             onload="this.classList.add('loaded')"
                             onerror="this.src='${Constants.DEFAULT_IMAGE_PLACEHOLDER}'; this.classList.add('loaded')">
                    </div>
                    
                    <div class="product-heart-center">
                        <button class="heart-btn-center ${isInFavorites ? 'active' : ''}" 
                                onclick="event.stopPropagation(); toggleFavorite('${safeId}')" 
                                title="${isInFavorites ? 'إزالة من المفضلة' : 'أضف للمفضلة 💝'}">
                            <i class="${isInFavorites ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                    </div>
                    
                    <div class="product-details">
                        <span class="product-category">${safeCategory}</span>
                        <h3 class="product-name" onclick="openProductDetails('${safeId}')">${safeName}</h3>
                        
                        ${shortDescription ? `<p class="product-short-desc">${shortDescription}</p>` : ''}
                        
                        <div class="product-price-wrapper">
                            ${product.price === 0 ? 
                                '<span class="product-price-special">اتصل للسعر 📞</span>' : 
                                `<span class="product-current-price">${this._localFormatNumber(product.price)} ${currency}</span>`
                            }
                            ${hasSale ? `<span class="product-original-price">${this._localFormatNumber(product.originalPrice)} ${currency}</span>` : ''}
                        </div>
                        
                        ${product.price > 0 ? `
                        <div class="product-stock-info ${product.stock <= 0 ? 'out-of-stock' : product.stock <= 5 ? 'low-stock' : ''}">
                            <i class="fas ${product.stock > 0 ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            <span>${product.stock > 0 ? 
                                (product.stock <= 5 ? `كمية محدودة ⚡ (${product.stock} قطعة)` : 'متوفر ✅') : 
                                'غير متوفر ❌'}
                            </span>
                        </div>
                        ` : ''}
                        
                        <div class="product-actions-footer">
                            ${product.price > 0 ? `
                            <button class="btn-add-to-cart ${isOutOfStock ? 'disabled' : ''}" 
                                    onclick="event.stopPropagation(); openQuantityModal('${safeId}')"
                                    ${isOutOfStock ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i>
                                <span>${isOutOfStock ? 'نفذت الكمية' : 'أضف للسلة 🛒'}</span>
                            </button>
                            ` : `
                            <button class="btn-contact-price" onclick="event.stopPropagation(); openProductDetails('${safeId}')">
                                <i class="fas fa-phone"></i>
                                <span>استعلام 📞</span>
                            </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _showEmptyState(filters, gridId = 'productsGrid', isHome = false) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        let icon, title, description, actions;

        if (isHome) {
            icon = 'fa-store-alt-slash';
            title = 'لا توجد منتجات حالياً 🏪';
            description = 'لم تتم إضافة أي منتجات بعد. تابعنا قريباً للحصول على أحدث المنتجات!';
            actions = `
                <button onclick="window.location.reload()" class="btn-filter-action primary">
                    <i class="fas fa-redo"></i> تحديث الصفحة
                </button>
            `;
        } else if (filters.q && filters.q.length >= Constants.SEARCH_MIN_LENGTH) {
            icon = 'fa-search';
            title = `لا توجد نتائج لـ "${getSafeHTML(filters.q)}" 🔍`;
            description = 'لم نتمكن من العثور على منتجات تطابق بحثك. جرب كلمات بحث مختلفة أو تصفح الفئات.';
            actions = `
                <button onclick="window.clearSearchAndReload()" class="btn-filter-action">
                    <i class="fas fa-times"></i> مسح البحث
                </button>
                <button onclick="window.clearAllFilters()" class="btn-filter-action primary">
                    <i class="fas fa-redo"></i> عرض جميع المنتجات
                </button>
            `;
        } else if (filters.cat) {
            const catName = this._getCategoryName(filters.cat);
            icon = 'fa-box-open';
            title = `لا توجد منتجات في "${getSafeHTML(catName)}" 📦`;
            description = 'لم تتم إضافة منتجات في هذه الفئة بعد. تصفح الفئات الأخرى.';
            actions = `
                <button onclick="window.filterByCategory('')" class="btn-filter-action primary">
                    <i class="fas fa-th-large"></i> عرض جميع الفئات
                </button>
            `;
        } else if (filters.filter === 'sale') {
            icon = 'fa-tags';
            title = 'لا توجد عروض حالياً 🏷️';
            description = 'لا توجد منتجات مخفضة في الوقت الحالي. تابعنا للحصول على أفضل العروض!';
            actions = `
                <button onclick="window.clearAllFilters()" class="btn-filter-action primary">
                    <i class="fas fa-redo"></i> عرض جميع المنتجات
                </button>
            `;
        } else {
            icon = 'fa-box-open';
            title = 'لا توجد منتجات لعرضها 📭';
            description = 'لم تتم إضافة أي منتجات بعد. يرجى التحقق لاحقاً.';
            actions = `
                <button onclick="window.location.reload()" class="btn-filter-action primary">
                    <i class="fas fa-redo"></i> تحديث الصفحة
                </button>
            `;
        }

        grid.innerHTML = `
            <div class="no-products-container-enhanced">
                <div class="no-products-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <h3>${title}</h3>
                <p>${description}</p>
                <div class="no-products-actions">
                    ${actions}
                </div>
            </div>
        `;
    }
    

    _showLoadingIndicator(show, gridId, count = Constants.LOADING_SKELETON_COUNT) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        if (show) {
            grid.innerHTML = this._generateSkeletonLoaderHTML(count);
        } else {
            const loadingIndicator = grid.querySelector('.skeleton-loader-container');
            if (loadingIndicator) loadingIndicator.remove();
        }
    }

    // ======================== 3.8 دوال تفاصيل المنتج والكمية ========================

    async fetchProductFromFirebase(productId) {
        if (!productId) return null;
        try {
            const db = this._getFirebaseReference();
            if (!db || !window.firebaseModules) return null;

            const docSnap = await window.firebaseModules.getDoc(
                window.firebaseModules.doc(db, 'products', productId)
            );

            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    price: parseFloat(data.price) || 0,
                    originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
                    image: data.image || Constants.DEFAULT_IMAGE_PLACEHOLDER,
                    name: data.name || 'منتج بدون اسم',
                    categoryId: data.categoryId || data.category || 'عام',
                    stock: data.stock || 0,
                    description: data.description || 'لا يوجد وصف'
                };
            }
            return null;
        } catch (error) {
            console.error('❌ خطأ في جلب المنتج:', error);
            this._showToast('فشل في جلب تفاصيل المنتج 😔', 'error');
            return null;
        }
    }

    async openProductDetails(productId) {
        console.log(`🔍 فتح تفاصيل المنتج: ${productId}`);
        if (!productId) return;

        let product = await this.fetchProductFromFirebase(productId);
        if (!product) {
            product = this.allProducts.find(p => p.id === productId);
            if (!product) {
                this._showToast('المنتج غير موجود 😔', 'error');
                return;
            }
        }

        const modal = document.getElementById('productDetailsModal');
        if (!modal) return;

        const titleEl = document.getElementById('modalProductTitle');
        const imageEl = document.getElementById('modalProductImage');
        const priceEl = document.getElementById('modalProductPrice');
        const descEl = document.getElementById('modalProductDescription');
        const stockEl = document.getElementById('modalProductStock');
        const categoryEl = document.getElementById('modalProductCategory');

        const categoryName = this._getCategoryName(product.categoryId);
        const safeName = getSafeHTML(product.name);
        const safeDesc = getSafeHTML(product.description || 'لا يوجد وصف');
        const safeCategory = getSafeHTML(categoryName);

        if (titleEl) titleEl.textContent = safeName;
        if (imageEl) {
            imageEl.src = product.image || Constants.DEFAULT_IMAGE_PLACEHOLDER;
            imageEl.onerror = () => { imageEl.src = Constants.DEFAULT_IMAGE_PLACEHOLDER; };
        }
        const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
        const formatNum = window.formatNumber || this._localFormatNumber;
        if (priceEl) {
            if (product.price === 0) {
                priceEl.innerHTML = '<span class="current-price">اتصل للسعر 📞</span>';
            } else if (product.originalPrice && product.originalPrice > product.price) {
                priceEl.innerHTML = `<span class="current-price">${formatNum(product.price)} ${currency}</span>
                                     <span class="original-price">${formatNum(product.originalPrice)} ${currency}</span>`;
            } else {
                priceEl.innerHTML = `<span class="current-price">${formatNum(product.price)} ${currency}</span>`;
            }
        }
        if (descEl) descEl.innerHTML = safeDesc;
        if (stockEl) {
            stockEl.textContent = product.stock > 0 ? product.stock : 'غير متوفر';
            stockEl.style.color = product.stock > 0 ? '#27ae60' : '#e74c3c';
        }
        if (categoryEl) categoryEl.textContent = safeCategory;

        const buyBtn = document.getElementById('modalBuyBtn');
        if (buyBtn) {
            const newBtn = buyBtn.cloneNode(true);
            buyBtn.parentNode.replaceChild(newBtn, buyBtn);
            newBtn.onclick = () => {
                modal.classList.remove('active');
                setTimeout(() => this.openQuantityModal(productId), 100);
            };
        }
        modal.classList.add('active');
    }

    closeProductDetailsModal() {
        const modal = document.getElementById('productDetailsModal');
        if (modal) modal.classList.remove('active');
    }

    async openQuantityModal(productId) {
        if (!productId) return;

        let product = await this.fetchProductFromFirebase(productId);
        if (!product) {
            product = this.allProducts.find(p => p.id === productId);
            if (!product) {
                this._showToast('المنتج غير متوفر حالياً 😔', 'warning');
                return;
            }
        }

        if (product.stock <= 0) {
            this._showToast('المنتج غير متوفر حالياً 😔', 'warning');
            return;
        }

        window.selectedProductForQuantity = product;
        const nameEl = document.getElementById('quantityModalProductName');
        if (nameEl) nameEl.textContent = getSafeHTML(product.name);
        const displayEl = document.getElementById('modalQuantityDisplay');
        if (displayEl) displayEl.textContent = '1';
        const modal = document.getElementById('quantityModal');
        if (modal) modal.classList.add('active');
    }

    closeQuantityModal() {
        const modal = document.getElementById('quantityModal');
        if (modal) {
            modal.classList.remove('active');
            window.selectedProductForQuantity = null;
        }
    }

    changeModalQuantity(change) {
        const displayEl = document.getElementById('modalQuantityDisplay');
        if (!displayEl) return;
        let current = parseInt(displayEl.textContent) || 1;
        let newQty = current + change;
        if (newQty < 1) return;
        if (window.selectedProductForQuantity) {
            const maxStock = window.selectedProductForQuantity.stock || 99;
            if (newQty > maxStock) {
                this._showToast(`الكمية المتوفرة: ${maxStock} فقط ⚠️`, 'warning');
                return;
            }
        }
        displayEl.textContent = newQty;
    }

    confirmAddToCart(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!window.selectedProductForQuantity) { this.closeQuantityModal(); return; }
        const qtyEl = document.getElementById('modalQuantityDisplay');
        const quantity = qtyEl ? parseInt(qtyEl.textContent) || 1 : 1;
        console.log(`🛒 إضافة من ProductSystem: ${window.selectedProductForQuantity.id}`);
        if (typeof window.addToCart === 'function') {
            window.addToCart(window.selectedProductForQuantity.id, quantity);
        }
        this.closeQuantityModal();
    }

    confirmBuyNow(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!window.selectedProductForQuantity) { this.closeQuantityModal(); return; }
        const qtyEl = document.getElementById('modalQuantityDisplay');
        const quantity = qtyEl ? parseInt(qtyEl.textContent) || 1 : 1;
        console.log(`⚡ شراء مباشر من ProductSystem: ${window.selectedProductForQuantity.id}`);
        if (typeof window.buyNowDirect === 'function') {
            window.buyNowDirect(window.selectedProductForQuantity.id, quantity);
        }
        this.closeQuantityModal();
    }

    // ======================== 3.9 إدارة المفضلة ========================

    toggleFavorite(productId) {
        if (!window.AppState) return;
        const product = this.allProducts.find(p => p.id === productId);
        if (!product) return;
        
        const isCurrentlyFav = window.AppState.favorites.some(f => f.id === productId);
        
        window.AppState.toggleFavorite({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image
        });
        
        this.updateFavoriteButtons();
        this.updateFavoritesDisplay();
        
        this._showToast(
            isCurrentlyFav ? 'تم الإزالة من المفضلة 💔' : 'تمت الإضافة للمفضلة ❤️', 
            'info'
        );
    }

    updateFavoriteButtons() {
        const favorites = window.AppState?.favorites || [];
        const favIds = favorites.map(f => f.id);
        // ✅ تحديد القسم النشط فقط لتحسين الأداء
        const activeSection = document.querySelector('.section.active');
        if (!activeSection) return;
        
        const buttons = activeSection.querySelectorAll('.heart-btn-center');
        buttons.forEach(btn => {
            const card = btn.closest('.product-card-enhanced');
            const pid = card ? card.getAttribute('data-id') : btn.getAttribute('data-id');
            if (favIds.includes(pid)) {
                btn.classList.add('active');
                const icon = btn.querySelector('i');
                if (icon) icon.className = 'fas fa-heart';
                btn.title = 'إزالة من المفضلة 💔';
            } else {
                btn.classList.remove('active');
                const icon = btn.querySelector('i');
                if (icon) icon.className = 'far fa-heart';
                btn.title = 'أضف للمفضلة 💝';
            }
        });
    }

    updateFavoritesDisplay() {
        const favoritesList = document.getElementById('favoritesList');
        const emptyMessage = document.getElementById('emptyFavoritesMessage');
        if (!favoritesList) return;
        const favorites = window.AppState?.favorites || [];
        if (favorites.length === 0) {
            favoritesList.innerHTML = '';
            if (emptyMessage) emptyMessage.style.display = 'block';
            return;
        }
        if (emptyMessage) emptyMessage.style.display = 'none';
        const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
        const formatNum = window.formatNumber || this._localFormatNumber;
        favoritesList.innerHTML = favorites.map(product => {
            const safeName = getSafeHTML(product.name || '');
            const safeId = String(product.id).replace(/[^a-zA-Z0-9_-]/g, '');
            return `
            <div class="product-card-enhanced" data-id="${safeId}">
                <div class="product-card-inner">
                    <div class="product-image-wrapper" onclick="openProductDetails('${safeId}')">
                        <img src="${product.image || Constants.DEFAULT_IMAGE_PLACEHOLDER}" alt="${safeName}" loading="lazy" class="product-image loaded">
                    </div>
                    <div class="product-heart-center">
                        <button class="heart-btn-center active" onclick="event.stopPropagation(); toggleFavorite('${safeId}')" title="إزالة من المفضلة 💔">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-details">
                        <h3 class="product-name" onclick="openProductDetails('${safeId}')">${safeName}</h3>
                        <span class="product-current-price">${formatNum(product.price)} ${currency}</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    // ======================== 3.10 التهيئة ========================

    initializeHomePage() {
        const homeGrid = document.getElementById('homeProductsGrid');
        if (homeGrid && homeGrid.children.length === 0) this.loadHomeProducts(false);
        this.setupHomeInfiniteScroll();
    }

    initializeProductsPage() {
        this.syncUI();
        this.resetAndLoad();
        this.setupProductsInfiniteScroll();
    }

    _injectStyles() {
        if (document.getElementById('product-system-styles-enhanced')) return;
        const style = document.createElement('style');
        style.id = 'product-system-styles-enhanced';
        style.textContent = `
            :root {
                --card-bg: #ffffff;
                --card-border: #e8ecf1;
                --card-shadow: 0 2px 8px rgba(0,0,0,0.06);
                --card-hover-shadow: 0 8px 25px rgba(0,0,0,0.12);
                --primary-color: #2c3e50;
                --accent-color: #e74c3c;
                --success-color: #27ae60;
                --warning-color: #f39c12;
                --text-dark: #2c3e50;
                --text-gray: #7f8c8d;
                --text-light: #95a5a6;
                --border-radius: 12px;
                --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .products-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 24px;
                padding: 20px 20px 5px 20px;
            }

            @media (max-width: 640px) {
                .products-grid {
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 16px;
                    padding: 12px 12px 5px 12px;
                }
            }

            .product-card-enhanced {
                opacity: 0;
                transform: translateY(30px);
                transition: opacity 0.6s ease, transform 0.6s ease;
            }

            .product-card-enhanced.animated {
                opacity: 1;
                transform: translateY(0);
            }

            .product-card-inner {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--border-radius);
                overflow: hidden;
                box-shadow: var(--card-shadow);
                transition: var(--transition);
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            .product-card-inner:hover {
                box-shadow: var(--card-hover-shadow);
                transform: translateY(-4px);
            }

            .product-image-wrapper {
                position: relative;
                width: 100%;
                padding-top: 100%;
                background: #f8f9fa;
                overflow: hidden;
                cursor: pointer;
            }

            .product-image-wrapper img {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.5s ease;
            }

            .product-card-inner:hover .product-image-wrapper img {
                transform: scale(1.08);
            }

            .product-badge {
                position: absolute;
                top: 12px;
                right: 12px;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                z-index: 2;
                color: white;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }

            .badge-sale { background: linear-gradient(135deg, #e74c3c, #c0392b); }
            .badge-new { background: linear-gradient(135deg, #27ae60, #229954); }
            .badge-best { background: linear-gradient(135deg, #f39c12, #e67e22); }

            .out-of-stock-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(231, 76, 60, 0.9);
                color: white;
                padding: 8px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                z-index: 3;
                pointer-events: none;
            }

            .product-heart-center {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 0;
                margin: -20px 0 0 0;
                position: relative;
                z-index: 5;
            }

            .heart-btn-center {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: var(--transition);
                font-size: 20px;
                background: rgba(255, 255, 255, 0.9);
                color: #999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                backdrop-filter: blur(5px);
            }

            .heart-btn-center:hover {
                transform: scale(1.15);
                color: #e74c3c;
            }

            .heart-btn-center.active {
                color: #e74c3c;
                background: rgba(255, 255, 255, 0.95);
            }

            .heart-btn-center.active i {
                animation: heartBeat 0.3s ease-in-out;
            }

            @keyframes heartBeat {
                0% { transform: scale(1); }
                50% { transform: scale(1.3); }
                100% { transform: scale(1); }
            }

            .product-details {
                padding: 12px 16px 16px 16px;
                display: flex;
                flex-direction: column;
                flex-grow: 1;
            }

            .product-category {
                font-size: 11px;
                color: var(--text-light);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 6px;
                font-weight: 600;
            }

            .product-name {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-dark);
                margin: 0 0 8px 0;
                line-height: 1.4;
                cursor: pointer;
                transition: color 0.2s ease;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .product-name:hover { color: var(--accent-color); }

            .product-short-desc {
                font-size: 12px;
                color: var(--text-gray);
                margin: 0 0 12px 0;
                line-height: 1.5;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .product-price-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }

            .product-current-price { font-size: 18px; font-weight: 700; color: var(--text-dark); }
            .product-price-special { font-size: 15px; font-weight: 600; color: var(--warning-color); }
            .product-original-price { font-size: 13px; color: var(--text-light); text-decoration: line-through; }

            .product-stock-info {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                margin-bottom: 14px;
            }

            .product-stock-info i { font-size: 14px; }
            .product-stock-info:not(.out-of-stock):not(.low-stock) { color: var(--success-color); }
            .product-stock-info.low-stock { color: var(--warning-color); }
            .product-stock-info.out-of-stock { color: var(--accent-color); }

            .product-actions-footer {
                margin-top: auto;
                display: flex;
                gap: 8px;
            }

            .btn-add-to-cart,
            .btn-contact-price {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: var(--transition);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-family: inherit;
            }

            .btn-add-to-cart {
                background: linear-gradient(135deg, var(--success-color), #229954);
                color: white;
            }

            .btn-add-to-cart:hover:not(.disabled) {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
            }

            .btn-add-to-cart.disabled {
                background: #bdc3c7;
                cursor: not-allowed;
                opacity: 0.7;
            }

            .btn-contact-price {
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
            }

            .btn-contact-price:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
            }

            /* Skeleton Loading */
            .skeleton-loader-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 24px;
                width: 100%;
                padding: 20px 20px 5px 20px;
            }

            .skeleton-loader {
                background: var(--card-bg);
                border-radius: var(--border-radius);
                overflow: hidden;
                box-shadow: var(--card-shadow);
                border: 1px solid var(--card-border);
            }

            .skeleton-image {
                width: 100%;
                padding-top: 100%;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
            }

            .skeleton-heart {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                margin: -22px auto 0 auto;
                position: relative;
                z-index: 5;
            }

            .skeleton-info { padding: 16px; }

            .skeleton-category {
                width: 35%;
                height: 12px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                margin-bottom: 10px;
                border-radius: 4px;
            }

            .skeleton-title {
                width: 85%;
                height: 18px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                margin-bottom: 15px;
                border-radius: 4px;
            }

            .skeleton-price {
                width: 50%;
                height: 20px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                margin-bottom: 20px;
                border-radius: 4px;
            }

            .skeleton-actions { display: flex; gap: 8px; }

            .skeleton-button {
                flex: 1;
                height: 40px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                border-radius: 8px;
            }

            @keyframes skeleton-loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            /* حالات فارغة */
            .search-results-info {
                grid-column: 1 / -1;
                text-align: center;
                padding: 12px 20px;
                background: #f0f8ff;
                border: 1px solid #d1e7ff;
                border-radius: 8px;
                color: #2980b9;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .no-products-container-enhanced {
                grid-column: 1 / -1;
                text-align: center;
                padding: 20px 20px;
                animation: fadeInUp 0.5s ease;
            }

            .no-products-icon {
                font-size: 64px;
                color: #bdc3c7;
                margin-bottom: 20px;
            }

            .no-products-container-enhanced h3 {
                color: var(--text-dark);
                margin-bottom: 10px;
                font-size: 20px;
            }

            .no-products-container-enhanced p {
                color: var(--text-gray);
                margin-bottom: 25px;
            }

            .no-products-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .btn-filter-action {
                padding: 10px 20px;
                border: 2px solid #ddd;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                transition: var(--transition);
                display: flex;
                align-items: center;
                gap: 6px;
                font-family: inherit;
            }

            .btn-filter-action:hover {
                border-color: var(--accent-color);
                color: var(--accent-color);
            }

            .btn-filter-action.primary {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }

            .btn-filter-action.primary:hover {
                background: #34495e;
                border-color: #34495e;
            }

            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            @media (max-width: 480px) {
                .product-details { padding: 10px 12px 12px 12px; }
                .product-name { font-size: 13px; }
                .product-current-price { font-size: 16px; }
                .btn-add-to-cart,
                .btn-contact-price { padding: 10px; font-size: 12px; }
                .heart-btn-center { width: 38px; height: 38px; font-size: 18px; }
                .product-heart-center { margin-top: -19px; }
            }
        `;
        document.head.appendChild(style);
    }
}

// إنشاء مثيل واحد للنظام
window.productSystem = window.productSystem || new ProductSystem();

console.log('✅ products-system-improved.js جاهز (نسخة محسنة مع رسائل محسنة)');