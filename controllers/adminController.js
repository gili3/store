module.exports = (dataService) => {
    const admin = require("firebase-admin");
    const db = admin.firestore();
    const storage = admin.storage();

    // ==================== STATS ====================

    const getStats = async (req, res) => {
        try {
            const stats = await dataService.getAdminStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error("Stats Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== PRODUCTS ====================

    const getAllProducts = async (req, res) => {
        try {
            const { search, category, minPrice, maxPrice, sort = 'newest', page = 1, limit = 20 } = req.query;
            
            let sortField = "createdAt";
            let sortOrder = "desc";

            switch (sort) {
                case "price-low":
                    sortField = "price";
                    sortOrder = "asc";
                    break;
                case "price-high":
                    sortField = "price";
                    sortOrder = "desc";
                    break;
                case "newest":
                default:
                    sortField = "createdAt";
                    sortOrder = "desc";
                    break;
            }

            const limitNum = parseInt(limit) || 20;
            const pageNum = parseInt(page) || 1;

            const { products, totalProducts } = await dataService.getProducts({
                category,
                search,
                minPrice,
                maxPrice,
                sortField,
                sortOrder,
                limit: limitNum,
                offset: (pageNum - 1) * limitNum
            });

            res.json({
                success: true,
                data: products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum),
                    totalItems: totalProducts,
                    itemsPerPage: limitNum
                }
            });
        } catch (error) {
            console.error("Get Products Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const getProductById = async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await db.collection("products").doc(id).get();
            
            if (!doc.exists) {
                return res.status(404).json({ success: false, error: "المنتج غير موجود" });
            }

            res.json({ success: true, data: { id: doc.id, ...doc.data() } });
        } catch (error) {
            console.error("Get Product Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const createProduct = async (req, res) => {
        try {
            const { name, description, price, category, stock, images, isFeatured, isActive } = req.body;

            if (!name || !price || !category) {
                return res.status(400).json({ success: false, error: "البيانات المطلوبة ناقصة" });
            }

            const newProduct = {
                name,
                description: description || "",
                price: parseFloat(price),
                category,
                stock: parseInt(stock) || 0,
                images: images || [],
                isFeatured: isFeatured || false,
                isActive: isActive !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection("products").add(newProduct);
            
            res.json({ 
                success: true, 
                message: "تم إنشاء المنتج بنجاح",
                data: { id: docRef.id, ...newProduct }
            });
        } catch (error) {
            console.error("Create Product Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateProduct = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (updateData.price) {
                updateData.price = parseFloat(updateData.price);
            }
            if (updateData.stock) {
                updateData.stock = parseInt(updateData.stock);
            }

            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection("products").doc(id).update(updateData);

            res.json({ success: true, message: "تم تحديث المنتج بنجاح" });
        } catch (error) {
            console.error("Update Product Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteProduct = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("products").doc(id).delete();
            res.json({ success: true, message: "تم حذف المنتج بنجاح" });
        } catch (error) {
            console.error("Delete Product Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== CATEGORIES ====================

    const getAllCategories = async (req, res) => {
        try {
            const snapshot = await db.collection("categories").get();
            const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            res.json({ success: true, data: categories });
        } catch (error) {
            console.error("Get Categories Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const createCategory = async (req, res) => {
        try {
            const { name, description, icon, isActive } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, error: "اسم الفئة مطلوب" });
            }

            const newCategory = {
                name,
                description: description || "",
                icon: icon || "📦",
                isActive: isActive !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection("categories").add(newCategory);
            
            res.json({ 
                success: true, 
                message: "تم إنشاء الفئة بنجاح",
                data: { id: docRef.id, ...newCategory }
            });
        } catch (error) {
            console.error("Create Category Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateCategory = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;
            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection("categories").doc(id).update(updateData);
            res.json({ success: true, message: "تم تحديث الفئة بنجاح" });
        } catch (error) {
            console.error("Update Category Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteCategory = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("categories").doc(id).delete();
            res.json({ success: true, message: "تم حذف الفئة بنجاح" });
        } catch (error) {
            console.error("Delete Category Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== ORDERS ====================

    const getAllOrders = async (req, res) => {
        try {
            const { status, search, sort = "newest", page = 1, limit = 20 } = req.query;

            let sortField = "createdAt";
            let sortOrder = "desc";

            switch (sort) {
                case "oldest":
                    sortField = "createdAt";
                    sortOrder = "asc";
                    break;
                case "total-asc":
                    sortField = "total";
                    sortOrder = "asc";
                    break;
                case "total-desc":
                    sortField = "total";
                    sortOrder = "desc";
                    break;
                case "newest":
                default:
                    sortField = "createdAt";
                    sortOrder = "desc";
                    break;
            }

            const limitNum = parseInt(limit) || 20;
            const pageNum = parseInt(page) || 1;

            const { orders, totalOrders } = await dataService.getAllOrders({
                status,
                search,
                sortField,
                sortOrder,
                limit: limitNum,
                offset: (pageNum - 1) * limitNum
            });

            res.json({
                success: true,
                data: orders,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalOrders / limitNum),
                    totalItems: totalOrders,
                    itemsPerPage: limitNum
                }
            });
        } catch (error) {
            console.error("Get Orders Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const getOrderById = async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await db.collection("orders").doc(id).get();
            
            if (!doc.exists) {
                return res.status(404).json({ success: false, error: "الطلب غير موجود" });
            }

            res.json({ success: true, data: { id: doc.id, ...doc.data() } });
        } catch (error) {
            console.error("Get Order Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateOrderStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, error: "حالة غير صحيحة" });
            }

            await db.collection("orders").doc(id).update({
                status: status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, message: "تم تحديث حالة الطلب بنجاح" });
        } catch (error) {
            console.error("Update Order Status Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteOrder = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("orders").doc(id).delete();
            res.json({ success: true, message: "تم حذف الطلب بنجاح" });
        } catch (error) {
            console.error("Delete Order Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== USERS ====================

    const getAllUsers = async (req, res) => {
        try {
            const { search, isAdmin, sort = "newest", page = 1, limit = 20 } = req.query;

            let sortField = "createdAt";
            let sortOrder = "desc";

            switch (sort) {
                case "oldest":
                    sortField = "createdAt";
                    sortOrder = "asc";
                    break;
                case "email-asc":
                    sortField = "email";
                    sortOrder = "asc";
                    break;
                case "email-desc":
                    sortField = "email";
                    sortOrder = "desc";
                    break;
                case "newest":
                default:
                    sortField = "createdAt";
                    sortOrder = "desc";
                    break;
            }

            const limitNum = parseInt(limit) || 20;
            const pageNum = parseInt(page) || 1;

            const { users, totalUsers } = await dataService.getAllUsers({
                search,
                isAdmin: isAdmin === "true" ? true : (isAdmin === "false" ? false : null),
                sortField,
                sortOrder,
                limit: limitNum,
                offset: (pageNum - 1) * limitNum
            });

            res.json({
                success: true,
                data: users,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalUsers / limitNum),
                    totalItems: totalUsers,
                    itemsPerPage: limitNum
                }
            });
        } catch (error) {
            console.error("Get Users Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const getUserById = async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await db.collection("users").doc(id).get();
            
            if (!doc.exists) {
                return res.status(404).json({ success: false, error: "المستخدم غير موجود" });
            }

            res.json({ success: true, data: { id: doc.id, ...doc.data() } });
        } catch (error) {
            console.error("Get User Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateUserRole = async (req, res) => {
        try {
            const { id } = req.params;
            const { isAdmin } = req.body;

            await db.collection("users").doc(id).update({ isAdmin: isAdmin || false });
            res.json({ success: true, message: "تم تحديث دور المستخدم بنجاح" });
        } catch (error) {
            console.error("Update User Role Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteUser = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("users").doc(id).delete();
            res.json({ success: true, message: "تم حذف المستخدم بنجاح" });
        } catch (error) {
            console.error("Delete User Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== MESSAGES ====================

    const getAllMessages = async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            
            const snapshot = await db.collection("messages").orderBy("createdAt", "desc").get();
            let messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // الترقيم
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 20;
            const startIndex = (pageNum - 1) * limitNum;
            const paginatedMessages = messages.slice(startIndex, startIndex + limitNum);

            res.json({
                success: true,
                data: paginatedMessages,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(messages.length / limitNum),
                    totalItems: messages.length
                }
            });
        } catch (error) {
            console.error("Get Messages Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteMessage = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("messages").doc(id).delete();
            res.json({ success: true, message: "تم حذف الرسالة بنجاح" });
        } catch (error) {
            console.error("Delete Message Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== COUPONS ====================

    const getAllCoupons = async (req, res) => {
        try {
            const snapshot = await db.collection("coupons").get();
            const coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json({ success: true, data: coupons });
        } catch (error) {
            console.error("Get Coupons Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const createCoupon = async (req, res) => {
        try {
            const { code, discountType, discountValue, expiryDate, minPurchase, isActive } = req.body;

            if (!code || !discountType || !discountValue) {
                return res.status(400).json({ success: false, error: "البيانات المطلوبة ناقصة" });
            }

            const newCoupon = {
                code,
                discountType,
                discountValue: parseFloat(discountValue),
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
                isActive: isActive !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection("coupons").add(newCoupon);
            res.json({ success: true, message: "تم إنشاء الكوبون بنجاح", data: { id: docRef.id, ...newCoupon } });
        } catch (error) {
            console.error("Create Coupon Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateCoupon = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (updateData.discountValue) updateData.discountValue = parseFloat(updateData.discountValue);
            if (updateData.minPurchase) updateData.minPurchase = parseFloat(updateData.minPurchase);
            if (updateData.expiryDate) updateData.expiryDate = new Date(updateData.expiryDate);

            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection("coupons").doc(id).update(updateData);
            res.json({ success: true, message: "تم تحديث الكوبون بنجاح" });
        } catch (error) {
            console.error("Update Coupon Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const deleteCoupon = async (req, res) => {
        try {
            const { id } = req.params;
            await db.collection("coupons").doc(id).delete();
            res.json({ success: true, message: "تم حذف الكوبون بنجاح" });
        } catch (error) {
            console.error("Delete Coupon Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ==================== SETTINGS ====================

    const getSettings = async (req, res) => {
        try {
            const settings = await dataService.getStoreSettings();
            res.json({ success: true, data: settings });
        } catch (error) {
            console.error("Get Settings Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    const updateSettings = async (req, res) => {
        try {
            const updateData = req.body;
            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            await db.collection("settings").doc("store").update(updateData);
            res.json({ success: true, message: "تم تحديث الإعدادات بنجاح" });
        } catch (error) {
            console.error("Update Settings Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    return {
        getStats,
        getAllProducts,
        getProductById,
        createProduct,
        updateProduct,
        deleteProduct,
        getAllCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        getAllOrders,
        getOrderById,
        updateOrderStatus,
        deleteOrder,
        getAllUsers,
        getUserById,
        updateUserRole,
        deleteUser,
        getAllMessages,
        deleteMessage,
        getAllCoupons,
        createCoupon,
        updateCoupon,
        deleteCoupon,
        getSettings,
        updateSettings
    };
};
