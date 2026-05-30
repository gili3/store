const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * جلب جميع الفئات النشطة
 * GET /api/categories
 */
router.get('/', async (req, res) => {
    try {
        const snapshot = await db.collection('categories')
            .where('isActive', '==', true)
            .orderBy('order', 'asc')
            .get();

        const categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * جلب فئة واحدة
 * GET /api/categories/:categoryId
 */
router.get('/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const doc = await db.collection('categories').doc(categoryId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'الفئة غير موجودة' });
        }

        res.json({
            id: doc.id,
            ...doc.data()
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
