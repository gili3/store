const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const authMiddleware = require('../middleware/auth-enhanced')(db, admin);
    const { requireAdmin } = authMiddleware;

    /**
     * جلب إعدادات المتجر
     */
    router.get('/', async (req, res) => {
        try {
            const settings = await dataService.getStoreSettings();
            if (Object.keys(settings).length === 0) {
                return res.json({
                    storeName: 'Eleven Store',
                    storeCurrency: 'SDG',
                    theme: { primaryColor: '#c9a24d', secondaryColor: '#a88b3d' }
                });
            }
            res.json(settings);
        } catch (error) {
            console.error('Error fetching settings:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * تحديث إعدادات المتجر
     */
    router.patch('/', requireAdmin, async (req, res) => {
        try {
            const updates = req.body;
            const allowedUpdates = ['storeName', 'storeCurrency', 'theme', 'shippingCost', 'freeShippingLimit', 'contactEmail', 'contactPhone', 'address', 'logoUrl'];
            const filteredUpdates = {};
            
            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) filteredUpdates[key] = updates[key];
            });

            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({ error: 'لا توجد حقول صالحة للتحديث' });
            }

            await db.collection('settings').doc('store').update(filteredUpdates);
            res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' });
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};