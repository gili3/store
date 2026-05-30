/**
 * admin-new-core.js
 * المحرك الأساسي لوحة التحكم - النسخة المصلحة (مع Hash Routing متكامل)
 * تم الإصلاح: 2026-05-03 | تم التحديث: إصلاح التنقل بين التبويبات
 */

// المتغيرات العامة
window.allCategories = [];
window.allProducts = [];
window.allOrders = [];
window.allUsers = [];
window.allMessages = [];
window.allReviews = [];
window.allCoupons = [];

// دالة لقطع اتصال جميع المراقبين (محسنة لمنع تسرب الذاكرة)
function disconnectAllObservers() {
    const observers = [
        'productsObserver', 'categoriesObserver', 'ordersObserver',
        'usersObserver', 'messagesObserver', 'reviewsObserver', 'couponsObserver'
    ];
    observers.forEach(obsName => {
        if (window[obsName]) {
            if (typeof window[obsName].disconnect === 'function') {
                window[obsName].disconnect();
            }
            window[obsName] = null;
        }
    });
    console.log('✅ تم قطع اتصال جميع المراقبين وتحرير الذاكرة');
}

// ==================== نظام التوجيه (Hash Routing) مُصلح ====================

/**
 * التنقل إلى قسم معين مع تحديث الرابط
 * ✅ إصلاح: استدعاء switchTab مباشرة لتجنب الحلقة
 */
window.navigateToAdmin = function(sectionId) {
    console.log(`🔗 التنقل إلى: ${sectionId}`);
    // ✅ استدعاء switchTab مع updateHash = true (سيتم تحديث الرابط مرة واحدة فقط)
    switchTab(sectionId, true);
};

/**
 * التبديل بين التبويبات (دون تغيير الرابط - للاستخدام الداخلي)
 * ✅ إصلاح: تجنب تغيير الرابط إذا كان مطابقاً بالفعل
 */
window.switchTab = async function(tabId, updateHash = true) {
    console.log(`🔄 التبديل إلى تبويب: ${tabId} (updateHash: ${updateHash})`);
    
    // التحقق من الصلاحية
    if (typeof window.checkAdmin === 'function' && !window.checkAdmin()) {
        console.warn('⚠️ فشل التحقق من الصلاحية');
        return;
    }

    // ✅ إصلاح: تحديث الرابط فقط إذا كان مختلفاً
    if (updateHash) {
        const currentHash = window.location.hash.substring(1) || 'dashboard';
        if (currentHash !== tabId) {
            // استخدم replaceState لتجنب إضافة إدخال جديد في التاريخ
            history.replaceState(null, '', `#${tabId}`);
        }
    }

    // قطع اتصال جميع المراقبين قبل تغيير التبويب
    disconnectAllObservers();

    // تحديث الأزرار النشطة
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        }
    });

    // إخفاء جميع الأقسام وإظهار المستهدف
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
    } else {
        console.warn(`⚠️ القسم ${tabId} غير موجود في DOM`);
    }

    // التمرير للأعلى
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // تحميل بيانات القسم المختار
    await loadCurrentSection(tabId);
};

/**
 * نسخ رابط القسم الحالي
 */
window.copyCurrentAdminLink = function() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        if (window.adminUtils && window.adminUtils.showToast) {
            window.adminUtils.showToast('✅ تم نسخ الرابط: ' + url, 'success');
        }
    }).catch(() => {
        prompt('انسخ الرابط:', url);
    });
};

// الدالة المفقودة: تحميل البيانات الأولية
async function loadInitialData() {
    console.log('📦 جاري تحميل البيانات الأساسية...');
    try {
        const promises = [];

        if (typeof window.loadCategories === 'function') {
            promises.push(
                window.loadCategories().catch(e => {
                    console.warn('⚠️ فشل تحميل الفئات:', e);
                })
            );
        } else {
            console.warn('⚠️ دالة loadCategories غير معرفة');
        }

        if (typeof window.loadProducts === 'function') {
            promises.push(
                window.loadProducts().catch(e => {
                    console.warn('⚠️ فشل تحميل المنتجات:', e);
                })
            );
        } else {
            console.warn('⚠️ دالة loadProducts غير معرفة');
        }

        if (typeof window.loadCoupons === 'function') {
            promises.push(
                window.loadCoupons().catch(e => {
                    console.warn('⚠️ فشل تحميل الكوبونات:', e);
                })
            );
        }

        const results = await Promise.allSettled(promises);
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`✅ تم تحميل البيانات الأساسية (نجح: ${succeeded}, فشل: ${failed})`);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات الأولية:', error);
        if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.handle(error, 'loadInitialData');
        }
    }
}

// ==================== معالج تغيير الرابط (مُصلح) ====================

window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1) || 'dashboard';
    
    const validSections = ['dashboard', 'products', 'categories', 'orders', 
                          'users', 'messages', 'coupons', 'settings'];
    
    if (validSections.includes(hash)) {
        console.log(`🔗 التنقل عبر الرابط إلى: ${hash}`);
        // ✅ إصلاح: استخدام updateHash = false لأن الرابط تغير بالفعل
        switchTab(hash, false);
    }
});

// ==================== التهيئة عند تحميل الصفحة ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 بدء تشغيل لوحة التحكم (مع Hash Routing مُصلح)...');
    
    try {
        if (typeof window.initializeFirebaseUnified === 'function') {
            const instance = await window.initializeFirebaseUnified();
            if (instance) {
                window.db = instance.db;
                window.storage = instance.storage;
                window.auth = instance.auth;
                console.log('✅ Firebase مهيأ (موحد مع جلسة دائمة)');
            }
        } else {
            console.warn('⚠️ دالة initializeFirebaseUnified غير معرفة، قد تكون Firebase غير مهيأة');
        }

        const loader = document.getElementById('initialLoaderAdmin');
        if (loader) {
            loader.style.display = 'none';
        }
        
        const container = document.querySelector('.admin-container');
        if (container) {
            container.style.display = 'block';
        }

        if (!window.firebaseModules || !window.firebaseModules.onAuthStateChanged) {
            console.error('❌ Firebase Modules غير محملة');
            window.location.href = 'login.html';
            return;
        }

        window.firebaseModules.onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                console.log('👤 مستخدم مسجل دخول:', user.uid);
                try {
                    const userDoc = await window.firebaseModules.getDoc(
                        window.firebaseModules.doc(window.db, 'users', user.uid)
                    );
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        if (typeof AppState !== 'undefined' && AppState.setUser) {
                            AppState.setUser({ uid: user.uid, ...userData }, false);
                        }
                        
                        const isAdmin = userData.isAdmin || userData.role === 'admin';
                        
                        // ✅ مزامنة مع sessionStorage لضمان عمل admin-utils.js بشكل صحيح
                        if (isAdmin) {
                            sessionStorage.setItem('isAdmin', 'true');
                            sessionStorage.setItem('currentUid', user.uid);
                        } else {
                            sessionStorage.removeItem('isAdmin');
                            sessionStorage.removeItem('currentUid');
                        }
                        
                        if (!isAdmin) {
                            console.warn('⚠️ مستخدم غير مسؤول يحاول الوصول للوحة التحكم');
                            if (typeof window.adminUtils !== 'undefined' && window.adminUtils.showToast) {
                                window.adminUtils.showToast('ليس لديك صلاحية الوصول للوحة التحكم', 'error');
                            }
                            setTimeout(() => { 
                                window.location.href = 'index.html'; 
                            }, 2000);
                            return;
                        }
                        
                        console.log('✅ مستخدم مسؤول، جاري تحميل لوحة التحكم...');
                        
                        await loadInitialData();
                        
                        const hash = window.location.hash.substring(1) || 'dashboard';
                        const validSections = ['dashboard', 'products', 'categories', 'orders', 
                                              'users', 'messages', 'coupons', 'settings'];
                        
                        const targetSection = validSections.includes(hash) ? hash : 'dashboard';
                        console.log(`🎯 القسم المستهدف من الرابط: ${targetSection}`);
                        
                        await loadCurrentSection(targetSection);
                        
                        document.querySelectorAll('.admin-tab').forEach(tab => {
                            tab.classList.remove('active');
                            if (tab.getAttribute('data-tab') === targetSection) {
                                tab.classList.add('active');
                            }
                        });
                        
                        document.querySelectorAll('.admin-tab-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        
                        const targetContent = document.getElementById(targetSection);
                        if (targetContent) {
                            targetContent.classList.add('active');
                        }
                        
                        console.log(`✅ تم تحميل لوحة التحكم بالكامل - القسم: ${targetSection}`);
                        
                    } else {
                        console.warn('⚠️ مستند المستخدم غير موجود في Firestore');
                        window.location.href = 'index.html';
                    }
                } catch (error) {
                    console.error('❌ خطأ في جلب بيانات المستخدم:', error);
                    if (typeof ErrorHandler !== 'undefined') {
                        ErrorHandler.handle(error, 'checkAdmin');
                    }
                    window.location.href = 'login.html';
                }
            } else {
                console.warn('⚠️ لا يوجد مستخدم مسجل');
                window.location.href = 'login.html';
            }
        });

    } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
        const loader = document.getElementById('initialLoaderAdmin');
        if (loader) loader.style.display = 'none';
        const container = document.querySelector('.admin-container');
        if (container) container.style.display = 'block';
        window.location.href = 'login.html';
    }
});

// تحميل بيانات القسم الحالي
async function loadCurrentSection(sectionId) {
    console.log(`📂 تحميل بيانات القسم: ${sectionId}`);
    
    if (typeof window.checkAdmin === 'function' && !window.checkAdmin()) {
        console.warn('⚠️ فشل التحقق من الصلاحية');
        return;
    }

    try {
        switch(sectionId) {
            case 'dashboard':
                if (typeof window.loadStats === 'function') {
                    await window.loadStats();
                } else {
                    console.warn('⚠️ دالة loadStats غير معرفة');
                }
                break;
                
            case 'products':
                if (typeof window.loadProducts === 'function') {
                    await window.loadProducts();
                } else {
                    console.warn('⚠️ دالة loadProducts غير معرفة');
                }
                break;
                
            case 'categories':
                if (typeof window.loadCategories === 'function') {
                    console.log('🔄 جاري تحميل الفئات...');
                    await window.loadCategories(false);
                    console.log('✅ تم تحميل الفئات بنجاح');
                } else {
                    console.error('❌ دالة loadCategories غير معرفة');
                    const grid = document.getElementById('categoriesGrid');
                    if (grid) {
                        grid.innerHTML = '<div style="text-align:center;padding:40px;color:red;">⚠️ خطأ: دالة تحميل الفئات غير متوفرة. تأكد من تحميل ملف categories.js</div>';
                    }
                }
                break;
                
            case 'orders':
                if (typeof window.loadOrders === 'function') {
                    await window.loadOrders();
                } else {
                    console.warn('⚠️ دالة loadOrders غير معرفة');
                }
                break;
                
            case 'users':
                if (typeof window.loadUsers === 'function') {
                    await window.loadUsers();
                } else {
                    console.warn('⚠️ دالة loadUsers غير معرفة');
                }
                break;
                
            case 'messages':
                if (typeof window.loadMessages === 'function') {
                    await window.loadMessages();
                } else {
                    console.warn('⚠️ دالة loadMessages غير معرفة');
                }
                break;
                
            case 'settings':
                if (typeof window.loadSettings === 'function') {
                    await window.loadSettings();
                } else {
                    console.warn('⚠️ دالة loadSettings غير معرفة');
                }
                break;
                
            case 'coupons':
                if (typeof window.loadCoupons === 'function') {
                    await window.loadCoupons();
                } else {
                    console.warn('⚠️ دالة loadCoupons غير معرفة');
                }
                break;
                
            default:
                console.warn(`⚠️ قسم غير معروف: ${sectionId}`);
        }
    } catch (error) {
        console.error(`❌ خطأ في تحميل القسم ${sectionId}:`, error);
        if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.handle(error, `loadCurrentSection-${sectionId}`);
        }
    }
}

/**
 * تسجيل الخروج
 */
window.logoutAdmin = function() {
    if (typeof ModalManager !== 'undefined' && ModalManager.confirm) {
        ModalManager.confirm('هل أنت متأكد من تسجيل الخروج؟', 'تأكيد', () => {
            performLogout();
        });
    } else {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            performLogout();
        }
    }
};

function performLogout() {
    if (!window.firebaseModules || !window.firebaseModules.signOut) {
        console.error('❌ Firebase Modules غير متاحة لتسجيل الخروج');
        cleanupAndRedirect();
        return;
    }
    
    window.firebaseModules.signOut(window.auth)
        .then(() => {
            console.log('✅ تم تسجيل الخروج بنجاح');
            cleanupAndRedirect();
        })
        .catch(error => {
            console.error('❌ خطأ في تسجيل الخروج:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handle(error, 'logoutAdmin');
            }
            cleanupAndRedirect();
        });
}

function cleanupAndRedirect() {
    if (typeof AppState !== 'undefined' && AppState.reset) {
        AppState.reset();
    }
    
    sessionStorage.clear();
    localStorage.removeItem("_usr");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("_uid");
    
    window.location.href = 'index.html';
}

// دوال مساعدة
window.getCategoryName = function(categoryId) {
    if (!categoryId || !window.allCategories || !Array.isArray(window.allCategories)) {
        return 'عام';
    }
    const cat = window.allCategories.find(c => c.id === categoryId);
    return cat ? (cat.name || 'غير معروف') : 'عام';
};

window.checkRequiredFunctions = function() {
    const required = [
        'loadStats',
        'loadProducts', 
        'loadCategories',
        'loadOrders',
        'loadUsers',
        'loadMessages',
        'loadSettings',
        'loadCoupons'
    ];
    
    const missing = required.filter(fn => typeof window[fn] !== 'function');
    
    if (missing.length > 0) {
        console.warn('⚠️ الدوال المفقودة:', missing.join(', '));
        return false;
    }
    
    console.log('✅ جميع الدوال المطلوبة متوفرة');
    return true;
};

console.log('✅ تم تحميل admin-new-core.js بنجاح (نسخة مصلحة مع Hash Routing مُصلح)');