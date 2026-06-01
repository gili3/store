const express = require('express');

module.exports = (dataService) => {
    const router = express.Router();

    /**
     * جلب جميع الفئات النشطة
     */
    router.get('/', async (req, res) => {
        try {
            const categories = await dataService.getCategories();
            const activeCategories = categories.filter(c => c.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
            res.json({ categories: activeCategories });
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * جلب فئة واحدة
     */
    router.get('/:categoryId', async (req, res) => {
        try {
            const { categoryId } = req.params;
            const categories = await dataService.getCategories();
            const category = categories.find(c => c.id === categoryId);

            if (!category) {
                return res.status(404).json({ error: 'الفئة غير موجودة' });
            }

            res.json(category);
        } catch (error) {
            console.error('Error fetching category:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
