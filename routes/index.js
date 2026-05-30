const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");

// مسارات الصفحات العامة
router.get("/", pageController.getHomePage);
router.get("/products", pageController.getProductsPage);
router.get("/cart", pageController.getCartPage);

// مسارات محمية
router.get("/profile", (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
}, pageController.getProfilePage);

router.get("/admin", (req, res, next) => {
    // هنا يمكن إضافة فحص صلاحيات الأدمن
    next();
}, pageController.getAdminDashboard);

router.get("/login", async (req, res) => {
    const db = require("firebase-admin").firestore();
    const settingsDoc = await db.collection("settings").doc("store").get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    res.render("login", { settings, title: "تسجيل الدخول", page: "login" });
});

module.exports = router;
