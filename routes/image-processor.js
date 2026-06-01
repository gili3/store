const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const admin = require('firebase-admin');

module.exports = (dataService) => {
    const router = express.Router();
    const storage = admin.storage();

    /**
     * إعدادات multer لقبول الملفات
     */
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
        fileFilter: (req, file, cb) => {
            const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('نوع الملف غير مدعوم. استخدم JPEG أو PNG أو GIF أو WebP'));
            }
        }
    });

    /**
     * معالجة الصورة وتحويلها إلى WebP
     */
    async function processImage(buffer, format = 'webp', options = {}) {
        const { width = 800, height = 800, quality = 80, fit = 'inside' } = options;
        try {
            let processor = sharp(buffer);
            processor = processor.resize(width, height, { fit: fit, withoutEnlargement: true, position: 'center' });
            if (format === 'webp') processor = processor.webp({ quality });
            else if (format === 'jpeg') processor = processor.jpeg({ quality, progressive: true });
            else if (format === 'png') processor = processor.png({ compressionLevel: 9 });
            return await processor.toBuffer();
        } catch (error) {
            console.error('❌ خطأ في معالجة الصورة:', error);
            throw new Error('فشل في معالجة الصورة');
        }
    }

    /**
     * رفع صورة المنتج ومعالجتها
     */
    router.post('/upload-product', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });
            const { productId } = req.body;
            const timestamp = Date.now();
            const fileName = `product-${productId || 'temp'}-${timestamp}`;

            const webpBuffer = await processImage(req.file.buffer, 'webp', { width: 800, height: 800, quality: 85 });
            const thumbnailBuffer = await processImage(req.file.buffer, 'webp', { width: 300, height: 300, quality: 80 });

            const bucket = storage.bucket();
            const mainImagePath = `products/${fileName}.webp`;
            const thumbnailPath = `products/thumbnails/${fileName}-thumb.webp`;
            const mainImageFile = bucket.file(mainImagePath);
            const thumbnailFile = bucket.file(thumbnailPath);

            await mainImageFile.save(webpBuffer, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });
            await thumbnailFile.save(thumbnailBuffer, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });

            const [mainUrl] = await mainImageFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 365 * 24 * 60 * 60 * 1000 });
            const [thumbnailUrl] = await thumbnailFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 365 * 24 * 60 * 60 * 1000 });

            res.json({
                success: true,
                image: { url: mainUrl, path: mainImagePath, size: webpBuffer.length, format: 'webp' },
                thumbnail: { url: thumbnailUrl, path: thumbnailPath, size: thumbnailBuffer.length, format: 'webp' },
                originalSize: req.file.size,
                compressionRatio: ((1 - webpBuffer.length / req.file.size) * 100).toFixed(2) + '%'
            });
        } catch (error) {
            console.error('❌ خطأ في رفع الصورة:', error);
            res.status(500).json({ error: error.message || 'فشل في رفع الصورة' });
        }
    });

    /**
     * رفع صورة الإعدادات
     */
    router.post('/upload-settings', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });
            const { type = 'logo' } = req.body;
            const timestamp = Date.now();
            const fileName = `${type}-${timestamp}`;

            const processedBuffer = await processImage(req.file.buffer, 'webp', { width: type === 'logo' ? 200 : 1200, height: type === 'logo' ? 200 : 400, quality: 85 });
            const bucket = storage.bucket();
            const imagePath = `settings/${fileName}.webp`;
            const imageFile = bucket.file(imagePath);

            await imageFile.save(processedBuffer, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });
            const [imageUrl] = await imageFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 365 * 24 * 60 * 60 * 1000 });

            res.json({
                success: true,
                image: { url: imageUrl, path: imagePath, size: processedBuffer.length, format: 'webp', type: type },
                originalSize: req.file.size,
                compressionRatio: ((1 - processedBuffer.length / req.file.size) * 100).toFixed(2) + '%'
            });
        } catch (error) {
            console.error('❌ خطأ في رفع صورة الإعدادات:', error);
            res.status(500).json({ error: error.message || 'فشل في رفع الصورة' });
        }
    });

    /**
     * معالجة صورة موجودة
     */
    router.post('/process', async (req, res) => {
        try {
            const { imagePath, width = 800, height = 800, quality = 85 } = req.body;
            if (!imagePath) return res.status(400).json({ error: 'يجب تحديد مسار الصورة' });

            const bucket = storage.bucket();
            const file = bucket.file(imagePath);
            const [buffer] = await file.download();

            const processedBuffer = await processImage(buffer, 'webp', { width: parseInt(width), height: parseInt(height), quality: parseInt(quality) });
            const processedPath = imagePath.replace(/\.[^.]+$/, `-processed-${Date.now()}.webp`);
            const processedFile = bucket.file(processedPath);

            await processedFile.save(processedBuffer, { metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });
            const [imageUrl] = await processedFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 365 * 24 * 60 * 60 * 1000 });

            res.json({
                success: true,
                image: { url: imageUrl, path: processedPath, size: processedBuffer.length, format: 'webp' },
                originalSize: buffer.length,
                compressionRatio: ((1 - processedBuffer.length / buffer.length) * 100).toFixed(2) + '%'
            });
        } catch (error) {
            console.error('❌ خطأ في معالجة الصورة:', error);
            res.status(500).json({ error: error.message || 'فشل في معالجة الصورة' });
        }
    });

    /**
     * حذف صورة
     */
    router.delete('/:imagePath', async (req, res) => {
        try {
            const { imagePath } = req.params;
            if (!imagePath) return res.status(400).json({ error: 'يجب تحديد مسار الصورة' });
            const decodedPath = decodeURIComponent(imagePath);
            const bucket = storage.bucket();
            const file = bucket.file(decodedPath);
            await file.delete();
            res.json({ success: true, message: 'تم حذف الصورة بنجاح' });
        } catch (error) {
            console.error('❌ خطأ في حذف الصورة:', error);
            res.status(500).json({ error: error.message || 'فشل في حذف الصورة' });
        }
    });

    return router;
};
