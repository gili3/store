const express = require("express");

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const adminController = require("../controllers/adminController")(dataService);
    const { requireAuth, requireAdmin } = require("../middleware/auth-enhanced")(db, admin);

    // تطبيق middleware المصادقة والتحقق من الأدمن على جميع المسارات
    router.use(requireAuth);
    router.use(requireAdmin);

    // ==================== STATS ====================
    router.get("/stats", adminController.getStats);

    // ==================== PRODUCTS ====================
    router.get("/products", adminController.getAllProducts);
    router.get("/products/:id", adminController.getProductById);
    router.post("/products", adminController.createProduct);
    router.put("/products/:id", adminController.updateProduct);
    router.delete("/products/:id", adminController.deleteProduct);

    // ==================== CATEGORIES ====================
    router.get("/categories", adminController.getAllCategories);
    router.post("/categories", adminController.createCategory);
    router.put("/categories/:id", adminController.updateCategory);
    router.delete("/categories/:id", adminController.deleteCategory);

    // ==================== ORDERS ====================
    router.get("/orders", adminController.getAllOrders);
    router.get("/orders/:id", adminController.getOrderById);
    router.put("/orders/:id/status", adminController.updateOrderStatus);
    router.delete("/orders/:id", adminController.deleteOrder);

    // ==================== USERS ====================
    router.get("/users", adminController.getAllUsers);
    router.get("/users/:id", adminController.getUserById);
    router.put("/users/:id/role", adminController.updateUserRole);
    router.delete("/users/:id", adminController.deleteUser);

    // ==================== MESSAGES ====================
    router.get("/messages", adminController.getAllMessages);
    router.delete("/messages/:id", adminController.deleteMessage);

    // ==================== COUPONS ====================
    router.get("/coupons", adminController.getAllCoupons);
    router.post("/coupons", adminController.createCoupon);
    router.put("/coupons/:id", adminController.updateCoupon);
    router.delete("/coupons/:id", adminController.deleteCoupon);

    // ==================== SETTINGS ====================
    router.get("/settings", adminController.getSettings);
    router.put("/settings", adminController.updateSettings);

    return router;
};
