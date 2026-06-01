/**
 * Data Service - جلب البيانات من جانب السيرفر
 */

module.exports = (db, admin) => {
    // دالة لتنظيف النص العربي للبحث (للاستخدام الداخلي إذا لزم الأمر)
    const normalizeArabic = (text) => {
        if (!text) return "";
        return text
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .toLowerCase()
            .trim();
    };

    async function getStoreSettings() {
        try {
            const doc = await db.collection("settings").doc("store").get();
            return doc.exists ? doc.data() : {};
        } catch (error) {
            console.error("Error fetching store settings:", error);
            return {};
        }
    }

    async function getCategories() {
        try {
            const snapshot = await db.collection("categories").get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching categories:", error);
            return [];
        }
    }

    async function getProducts({
        category = null,
        search = null,
        minPrice = null,
        maxPrice = null,
        sortField = 'createdAt',
        sortOrder = 'desc',
        limit = 12,
        offset = 0 // إضافة offset لدعم الترقيم
    } = {}) {
        try {
            let query = db.collection("products").where("isActive", "==", true);

            if (category) {
                query = query.where("category", "==", category);
            }

            if (minPrice !== null) {
                query = query.where("price", ">=", parseFloat(minPrice));
            }
            if (maxPrice !== null) {
                query = query.where("price", "<=", parseFloat(maxPrice));
            }

            // Firestore لا يدعم البحث النصي الكامل أو البحث بـ 'contains'
            // للتوافق مع البنية الحالية، سنقوم بالبحث بـ 'startsWith' على حقل واحد (الاسم).
            if (search) {
                const normalizedSearch = normalizeArabic(search);
                query = query.where("name", ">=", normalizedSearch)
                             .where("name", "<=", normalizedSearch + '\uf8ff');
            }

            // جلب العدد الكلي للمنتجات المطابقة قبل تطبيق الترقيم
            const countSnapshot = await query.count().get();
            const totalProducts = countSnapshot.data().count;

            query = query.orderBy(sortField, sortOrder);

            // تطبيق الترقيم
            query = query.limit(limit).offset(offset);

            const snapshot = await query.get();
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            return { products, totalProducts };
        } catch (error) {
            console.error("Error fetching products with filters:", error);
            return { products: [], totalProducts: 0 };
        }
    }

    async function getProductById(productId) {
        try {
            const doc = await db.collection("products").doc(productId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error("Error fetching product:", error);
            return null;
        }
    }

    async function getProductsByCategory(categoryId, limit = 50) {
        return (await getProducts({ category: categoryId, limit: limit })).products;
    }

    async function searchProducts(queryText) {
        // هذه الدالة يمكن أن تستخدم getProducts مع معلمة البحث
        return (await getProducts({ search: queryText, limit: 50 })).products;
    }

    async function getUserData(userId) {
        try {
            const doc = await db.collection("users").doc(userId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error("Error fetching user data:", error);
            return null;
        }
    }

    async function getCart(userId) {
        try {
            const doc = await db.collection("carts").doc(userId).get();
            if (doc.exists) {
                const data = doc.data();
                return { items: data.items || [], subtotal: data.subtotal || 0, shipping: data.shipping || 0, total: data.total || 0 };
            }
            return { items: [], subtotal: 0, shipping: 0, total: 0 };
        } catch (error) {
            console.error("Error fetching cart:", error);
            return { items: [], subtotal: 0, shipping: 0, total: 0 };
        }
    }

    async function getUserOrders(userId, limit = 20) {
        try {
            const snapshot = await db.collection("orders")
                .where("userId", "==", userId)
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching user orders:", error);
            return [];
        }
    }

    async function getAllOrders({
        status = null,
        search = null,
        sortField = 'createdAt',
        sortOrder = 'desc',
        limit = 20,
        offset = 0
    } = {}) {
        try {
            let query = db.collection("orders");

            if (status) {
                query = query.where("status", "==", status);
            }

            // البحث النصي في الطلبات (يمكن تحسينه لاحقاً)
            if (search) {
                const normalizedSearch = normalizeArabic(search);
                // Firestore لا تدعم البحث النصي الكامل أو البحث بـ 'contains'
                // لذا، سنقوم بالبحث عن حقول معينة تبدأ بالنص
                // أو جلب عدد أكبر ثم الفلترة في الذاكرة
                // هنا، سنقوم بفلترة في الذاكرة بعد جلب الطلبات
            }

            const countSnapshot = await query.count().get();
            const totalOrders = countSnapshot.data().count;

            query = query.orderBy(sortField, sortOrder);
            query = query.limit(limit).offset(offset);

            const snapshot = await query.get();
            let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (search) {
                const normalizedSearch = normalizeArabic(search);
                orders = orders.filter(order =>
                    (order.userId && normalizeArabic(order.userId).includes(normalizedSearch)) ||
                    (order.customerName && normalizeArabic(order.customerName).includes(normalizedSearch)) ||
                    (order.customerEmail && normalizeArabic(order.customerEmail).includes(normalizedSearch))
                );
            }

            return { orders, totalOrders };
        } catch (error) {
            console.error("Error fetching all orders:", error);
            return { orders: [], totalOrders: 0 };
        }
    }

    async function getAllUsers({
        search = null,
        isAdmin = null,
        sortField = 'createdAt',
        sortOrder = 'desc',
        limit = 20,
        offset = 0
    } = {}) {
        try {
            let query = db.collection("users");

            if (isAdmin !== null) {
                query = query.where("isAdmin", "==", isAdmin);
            }

            // البحث النصي في المستخدمين
            if (search) {
                const normalizedSearch = normalizeArabic(search);
                // Firestore لا تدعم البحث النصي الكامل أو البحث بـ 'contains'
                // لذا، سنقوم بالبحث عن حقول معينة تبدأ بالنص
                // أو جلب عدد أكبر ثم الفلترة في الذاكرة
            }

            const countSnapshot = await query.count().get();
            const totalUsers = countSnapshot.data().count;

            query = query.orderBy(sortField, sortOrder);
            query = query.limit(limit).offset(offset);

            const snapshot = await query.get();
            let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (search) {
                const normalizedSearch = normalizeArabic(search);
                users = users.filter(user =>
                    (user.email && normalizeArabic(user.email).includes(normalizedSearch)) ||
                    (user.displayName && normalizeArabic(user.displayName).includes(normalizedSearch))
                );
            }

            return { users, totalUsers };
        } catch (error) {
            console.error("Error fetching all users:", error);
            return { users: [], totalUsers: 0 };
        }
    }

    async function getAdminStats() {
        try {
            const [productsSnap, ordersSnap, usersSnap, categoriesSnap] = await Promise.all([
                db.collection("products").where("isActive", "==", true).count().get(),
                db.collection("orders").count().get(),
                db.collection("users").count().get(),
                db.collection("categories").count().get()
            ]);

            const allOrdersSnapshot = await db.collection("orders").get();
            const totalRevenue = allOrdersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
            const pendingOrders = allOrdersSnapshot.docs.filter(doc => doc.data().status === "pending").length;
            const completedOrders = allOrdersSnapshot.docs.filter(doc => doc.data().status === "completed").length;

            return {
                totalProducts: productsSnap.data().count,
                totalOrders: ordersSnap.data().count,
                totalUsers: usersSnap.data().count,
                totalRevenue: totalRevenue,
                pendingOrders: pendingOrders,
                completedOrders: completedOrders,
                totalCategories: categoriesSnap.data().count
            };
        } catch (error) {
            console.error("Error fetching admin stats:", error);
            return { totalProducts: 0, totalOrders: 0, totalUsers: 0, totalRevenue: 0, pendingOrders: 0, completedOrders: 0, totalCategories: 0 };
        }
    }

    return {
        getStoreSettings, getCategories, getProducts, getProductById,
        getProductsByCategory, searchProducts, getUserData, getCart,
        getUserOrders, getAllOrders, getAllUsers, getAdminStats
    };
};
