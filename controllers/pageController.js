const admin = require("firebase-admin");

module.exports = (dataService) => {
    // تأكد من أن Firebase مهيأة قبل استخدام firestore
    let db;
    try {
        if (admin.apps.length) {
            db = admin.firestore();
        } else {
            console.warn('⚠️ Firebase not initialized in pageController');
            db = null;
        }
    } catch (error) {
        console.error('❌ Firestore error in pageController:', error.message);
        db = null;
    }

    // دالة لتنظيف النص العربي للبحث
    const normalizeArabic = (text) => {
        if (!text) return "";
        return text
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .trim();
    };

    // ==================== HOME PAGE ====================
    const getHomePage = async (req, res) => {
        try {
            const [settings, categories] = await Promise.all([
                dataService.getStoreSettings(),
                dataService.getCategories()
            ]);
            
            // جلب المنتجات المميزة في السيرفر
            const featuredProducts = await dataService.getProducts(8);
            
            res.render("index", { 
                settings, 
                categories, 
                featuredProducts,
                page: "home", 
                title: "الرئيسية",
                user: req.user || null
            });
        } catch (error) {
            console.error("Home Page Error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== PRODUCTS PAGE ====================
    const getProductsPage = async (req, res) => {
        try {
            const { category, search, sort, minPrice, maxPrice, page = 1 } = req.query;
            
            const [settings, categories] = await Promise.all([
                dataService.getStoreSettings(),
                dataService.getCategories()
            ]);
            
            // جلب البيانات من dataService
            const productsData = await dataService.getProducts(12, (page - 1) * 12); 

            res.render("products", { 
                settings, 
                categories, 
                products: productsData || [], 
                page: "products", 
                title: "المنتجات",
                pagination: {},
                filters: {
                    category: category || "",
                    search: search || "",
                    sort: sort || "newest",
                    minPrice: minPrice || "",
                    maxPrice: maxPrice || "",
                    currentPage: page || 1
                },
                user: req.user || null
            });
        } catch (error) {
            console.error("Error in getProductsPage:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== PRODUCT DETAIL PAGE ====================
    const getProductDetail = async (req, res) => {
        try {
            const { id } = req.params;
            const [settings, categories] = await Promise.all([
                dataService.getStoreSettings(),
                dataService.getCategories()
            ]);
            
            const product = await dataService.getProductById(id);
            
            if (!product || !product.isActive) {
                return res.status(404).render("404", { settings, title: "المنتج غير موجود" });
            }

            // جلب منتجات مشابهة
            const relatedProducts = await dataService.getProductsByCategory(product.category, 4);
            const filteredRelatedProducts = relatedProducts.filter(d => d.id !== id);

            res.render("product-detail", { 
                settings, 
                categories, 
                product,
                relatedProducts: filteredRelatedProducts,
                page: "product-detail", 
                title: product.name,
                user: req.user || null
            });
        } catch (error) {
            console.error("Product Detail Error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== CART PAGE ====================
    const getCartPage = async (req, res) => {
        try {
            const [settings, categories] = await Promise.all([
                dataService.getStoreSettings(),
                dataService.getCategories()
            ]);
            
            let cartData = await dataService.getCart(req.user?.uid || req.session.id);

            res.render("cart", { 
                settings, 
                categories, 
                cart: cartData,
                page: "cart", 
                title: "سلة التسوق",
                user: req.user || null
            });
        } catch (error) {
            console.error("Cart Page Error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== PROFILE PAGE ====================
    const getProfilePage = async (req, res) => {
        try {
            const [settings, categories] = await Promise.all([
                dataService.getStoreSettings(),
                dataService.getCategories()
            ]);
            
            let userData = req.user ? await dataService.getUserData(req.user.uid) : {};
            let orders = req.user ? await dataService.getUserOrders(req.user.uid) : [];

            res.render("profile", { 
                settings, 
                categories, 
                user: req.user || null,
                userData,
                orders,
                page: "profile", 
                title: "الملف الشخصي" 
            });
        } catch (error) {
            console.error("Profile Page Error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== ADMIN DASHBOARD PAGE ====================
    const getAdminDashboard = async (req, res) => {
        try {
            const settings = await dataService.getStoreSettings();
            
            res.render("admin", { 
                settings, 
                page: "admin", 
                title: "لوحة التحكم",
                user: req.user || null
            });
        } catch (error) {
            console.error("Admin Dashboard Error:", error);
            res.status(500).send("خطأ في تحميل لوحة التحكم");
        }
    };

    // ==================== LOGIN PAGE ====================
    const getLoginPage = async (req, res) => {
        try {
            const settings = await dataService.getStoreSettings();
            
            res.render("login", { 
                settings, 
                title: "تسجيل الدخول", 
                page: "login",
                user: null
            });
        } catch (error) {
            console.error("Login Page Error:", error);
            res.status(500).json({ error: error.message });
        }
    };

    // ==================== 404 PAGE ====================
    const get404Page = async (req, res) => {
        try {
            const settings = await dataService.getStoreSettings();
            
            res.status(404).render("404", { 
                settings, 
                title: "404 - غير موجود",
                user: req.user || null
            });
        } catch (error) {
            console.error("404 Page Error:", error);
            res.status(404).send("الصفحة غير موجودة");
        }
    };

    return {
        getHomePage,
        getProductsPage,
        getProductDetail,
        getCartPage,
        getProfilePage,
        getAdminDashboard,
        getLoginPage,
        get404Page
    };
};