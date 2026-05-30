const admin = require("firebase-admin");

// جلب الإعدادات العامة للمتجر
const getSettings = async () => {
    const db = admin.firestore();
    const doc = await db.collection("settings").doc("store").get();
    return doc.exists ? doc.data() : {};
};

// جلب التصنيفات
const getCategories = async () => {
    const db = admin.firestore();
    const snapshot = await db.collection("categories").where("isActive", "==", true).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getHomePage = async (req, res) => {
    try {
        const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
        res.render("index", { settings, categories, page: "home", title: "الرئيسية" });
    } catch (error) {
        res.status(500).send("خطأ في السيرفر");
    }
};

exports.getProductsPage = async (req, res) => {
    try {
        const db = admin.firestore();
        const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
        const productsSnapshot = await db.collection("products").where("isActive", "==", true).limit(20).get();
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.render("products", { settings, categories, products, page: "products", title: "المنتجات" });
    } catch (error) {
        res.status(500).send("خطأ في السيرفر");
    }
};

exports.getCartPage = async (req, res) => {
    const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
    res.render("cart", { settings, categories, page: "cart", title: "سلة التسوق" });
};

exports.getProfilePage = async (req, res) => {
    const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
    res.render("profile", { settings, categories, user: req.user, page: "profile", title: "الملف الشخصي" });
};

exports.getAdminDashboard = async (req, res) => {
    const settings = await getSettings();
    res.render("admin-dashboard", { settings, page: "admin", title: "لوحة التحكم" });
};
