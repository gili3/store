const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const userController = require('../controllers/userController');
    const authMiddleware = require('../middleware/auth-enhanced')(db, admin);
    const { requireAuth } = authMiddleware;

    // تطبيق middleware المصادقة على جميع المسارات
    router.use(requireAuth);

    // ==================== PROFILE ====================
    router.get('/profile', userController.getUserProfile);
    router.put('/profile', userController.updateUserProfile);

    // ==================== ADDRESSES ====================
    router.get('/addresses', userController.getUserAddresses);
    router.post('/addresses', userController.addUserAddress);
    router.put('/addresses/:addressId', userController.updateUserAddress);
    router.delete('/addresses/:addressId', userController.deleteUserAddress);

    // ==================== WISHLIST ====================
    router.get('/wishlist', userController.getUserWishlist);
    router.post('/wishlist', userController.addToWishlist);
    router.delete('/wishlist', userController.removeFromWishlist);

    // ==================== SECURITY ====================
    router.post('/change-password', userController.changePassword);

    return router;
};