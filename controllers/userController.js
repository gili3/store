const admin = require("firebase-admin");
const db = admin.firestore();

// ==================== GET USER PROFILE ====================

exports.getUserProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const userDoc = await db.collection('users').doc(req.user.uid).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: "المستخدم غير موجود" });
        }

        const userData = userDoc.data();

        res.json({
            success: true,
            data: {
                id: userDoc.id,
                email: userData.email,
                displayName: userData.displayName || "",
                photoURL: userData.photoURL || "",
                phone: userData.phone || "",
                address: userData.address || "",
                city: userData.city || "",
                country: userData.country || "",
                createdAt: userData.createdAt,
                lastLogin: userData.lastLogin
            }
        });
    } catch (error) {
        console.error("Get User Profile Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== UPDATE USER PROFILE ====================

exports.updateUserProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { displayName, phone, address, city, country, photoURL } = req.body;

        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (displayName) updateData.displayName = displayName;
        if (phone) updateData.phone = phone;
        if (address) updateData.address = address;
        if (city) updateData.city = city;
        if (country) updateData.country = country;
        if (photoURL) updateData.photoURL = photoURL;

        await db.collection('users').doc(req.user.uid).update(updateData);

        res.json({
            success: true,
            message: "تم تحديث الملف الشخصي بنجاح"
        });
    } catch (error) {
        console.error("Update User Profile Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET USER ADDRESSES ====================

exports.getUserAddresses = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const addressesSnapshot = await db.collection('users')
            .doc(req.user.uid)
            .collection('addresses')
            .get();

        const addresses = addressesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: addresses
        });
    } catch (error) {
        console.error("Get User Addresses Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== ADD USER ADDRESS ====================

exports.addUserAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { label, street, city, state, zipCode, country, phone, isDefault } = req.body;

        if (!street || !city || !country) {
            return res.status(400).json({ success: false, error: "البيانات المطلوبة ناقصة" });
        }

        const addressData = {
            label: label || "العنوان الرئيسي",
            street,
            city,
            state: state || "",
            zipCode: zipCode || "",
            country,
            phone: phone || "",
            isDefault: isDefault || false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('users')
            .doc(req.user.uid)
            .collection('addresses')
            .add(addressData);

        res.json({
            success: true,
            message: "تم إضافة العنوان بنجاح",
            data: {
                id: docRef.id,
                ...addressData
            }
        });
    } catch (error) {
        console.error("Add User Address Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== UPDATE USER ADDRESS ====================

exports.updateUserAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { addressId } = req.params;
        const updateData = req.body;
        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('users')
            .doc(req.user.uid)
            .collection('addresses')
            .doc(addressId)
            .update(updateData);

        res.json({
            success: true,
            message: "تم تحديث العنوان بنجاح"
        });
    } catch (error) {
        console.error("Update User Address Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== DELETE USER ADDRESS ====================

exports.deleteUserAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { addressId } = req.params;

        await db.collection('users')
            .doc(req.user.uid)
            .collection('addresses')
            .doc(addressId)
            .delete();

        res.json({
            success: true,
            message: "تم حذف العنوان بنجاح"
        });
    } catch (error) {
        console.error("Delete User Address Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET USER WISHLIST ====================

exports.getUserWishlist = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const wishlistDoc = await db.collection('wishlists').doc(req.user.uid).get();
        
        if (!wishlistDoc.exists) {
            return res.json({ success: true, data: [] });
        }

        const wishlistItems = wishlistDoc.data().items || [];

        // جلب بيانات المنتجات
        const productIds = wishlistItems.map(item => item.id);
        const products = [];

        for (let i = 0; i < productIds.length; i += 30) {
            const chunk = productIds.slice(i, i + 30);
            const snapshot = await db.collection('products')
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();

            snapshot.docs.forEach(doc => {
                if (doc.data().isActive) {
                    products.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            });
        }

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error("Get User Wishlist Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== ADD TO WISHLIST ====================

exports.addToWishlist = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, error: "معرف المنتج مطلوب" });
        }

        // التحقق من وجود المنتج
        const productDoc = await db.collection('products').doc(productId).get();
        if (!productDoc.exists) {
            return res.status(404).json({ success: false, error: "المنتج غير موجود" });
        }

        // إضافة إلى قائمة المفضلة
        const wishlistRef = db.collection('wishlists').doc(req.user.uid);
        const wishlistDoc = await wishlistRef.get();

        if (wishlistDoc.exists) {
            const items = wishlistDoc.data().items || [];
            if (!items.find(item => item.id === productId)) {
                await wishlistRef.update({
                    items: admin.firestore.FieldValue.arrayUnion({ id: productId, addedAt: admin.firestore.FieldValue.serverTimestamp() })
                });
            }
        } else {
            await wishlistRef.set({
                items: [{ id: productId, addedAt: admin.firestore.FieldValue.serverTimestamp() }]
            });
        }

        res.json({
            success: true,
            message: "تم إضافة المنتج إلى قائمة المفضلة"
        });
    } catch (error) {
        console.error("Add To Wishlist Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== REMOVE FROM WISHLIST ====================

exports.removeFromWishlist = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, error: "معرف المنتج مطلوب" });
        }

        const wishlistRef = db.collection('wishlists').doc(req.user.uid);
        const wishlistDoc = await wishlistRef.get();

        if (wishlistDoc.exists) {
            const items = wishlistDoc.data().items || [];
            const filteredItems = items.filter(item => item.id !== productId);
            
            await wishlistRef.update({
                items: filteredItems
            });
        }

        res.json({
            success: true,
            message: "تم إزالة المنتج من قائمة المفضلة"
        });
    } catch (error) {
        console.error("Remove From Wishlist Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== CHANGE PASSWORD ====================

exports.changePassword = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "يجب تسجيل الدخول أولاً" });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: "البيانات المطلوبة ناقصة" });
        }

        // تحديث كلمة المرور عبر Firebase Auth
        try {
            await admin.auth().updateUser(req.user.uid, {
                password: newPassword
            });

            res.json({
                success: true,
                message: "تم تحديث كلمة المرور بنجاح"
            });
        } catch (authError) {
            res.status(400).json({ success: false, error: "فشل تحديث كلمة المرور" });
        }
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
