const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const checkoutController = require('../controllers/checkoutController');
    const authMiddleware = require('../middleware/auth-enhanced')(db, admin);
    const { requireAuth } = authMiddleware;

    // صفحة الدفع (محمية)
    router.get('/', requireAuth, checkoutController.getCheckoutPage);

    // إنشاء طلب جديد
    router.post('/create-order', requireAuth, checkoutController.createOrder);

    // جلب طلب معين
    router.get('/order/:id', requireAuth, checkoutController.getOrder);

    // جلب طلبات المستخدم
    router.get('/my-orders', requireAuth, checkoutController.getUserOrders);

    // تتبع الطلب (لا يتطلب مصادقة)
    router.get('/track/:id', checkoutController.trackOrder);

    return router;
};