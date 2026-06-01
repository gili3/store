const express = require("express");
module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const pageController = require("../controllers/pageController")(dataService);
    const { requireAuth, requireAdmin } = require("../middleware/auth-enhanced")(db, admin);

// ==================== PUBLIC PAGES ====================

// الصفحة الرئيسية
router.get("/", pageController.getHomePage);

// صفحة المنتجات
router.get("/products", pageController.getProductsPage);

// صفحة تفاصيل المنتج
router.get("/product/:id", pageController.getProductDetail);

// صفحة السلة
router.get("/cart", pageController.getCartPage);

// صفحة تسجيل الدخول
router.get("/login", pageController.getLoginPage);

// ==================== PROTECTED PAGES ====================

// صفحة الملف الشخصي
router.get("/profile", requireAuth, pageController.getProfilePage);

// لوحة التحكم
router.get("/admin", requireAuth, requireAdmin, pageController.getAdminDashboard);

// ==================== 404 PAGE ====================
router.use(pageController.get404Page);

    return router;
};
