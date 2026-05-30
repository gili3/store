const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * جلب إعدادات المتجر
 * GET /api/settings
 */
router.get('/', async (req, res) => {
    try {
        const doc = await db.collection('settings').doc('store').get();
        
        if (!doc.exists) {
            return res.json({
                storeName: 'Eleven Store',
                storeCurrency: 'SDG',
                theme: {
                    primaryColor: '#c9a24d',
                    secondaryColor: '#a88b3d'
                }
            });
        }

        res.json(doc.data());
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: error.message });
    }
});

const { requireAdmin } = require('../middleware/auth');

/**
 * تحديث إعدادات المتجر (للأدمن فقط)
 * PATCH /api/settings
 */
router.patch('/', requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        
        // منع تحديث الحقول الحساسة إذا وجدت مستقبلاً أو تصفية المدخلات
        const allowedUpdates = ['storeName', 'storeCurrency', 'theme', 'shippingCost', 'freeShippingLimit', 'contactEmail', 'contactPhone', 'address', 'logoUrl'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
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

module.exports = router;
