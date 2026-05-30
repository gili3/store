const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const admin = require('firebase-admin');

const storage = admin.storage();
const db = admin.firestore();

/**
 * إعدادات multer لقبول الملفات
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
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
 * @param {Buffer} buffer - محتوى الصورة
 * @param {string} format - صيغة الإخراج (webp, jpeg, png)
 * @param {Object} options - خيارات المعالجة
 */
async function processImage(buffer, format = 'webp', options = {}) {
    const {
        width = 800,
        height = 800,
        quality = 80,
        fit = 'inside'
    } = options;

    try {
        let processor = sharp(buffer);

        // تغيير حجم الصورة
        processor = processor.resize(width, height, {
            fit: fit,
            withoutEnlargement: true,
            position: 'center'
        });

        // تحويل إلى الصيغة المطلوبة
        if (format === 'webp') {
            processor = processor.webp({ quality });
        } else if (format === 'jpeg') {
            processor = processor.jpeg({ quality, progressive: true });
        } else if (format === 'png') {
            processor = processor.png({ compressionLevel: 9 });
        }

        return await processor.toBuffer();
    } catch (error) {
        console.error('❌ خطأ في معالجة الصورة:', error);
        throw new Error('فشل في معالجة الصورة');
    }
}

/**
 * رفع صورة المنتج ومعالجتها
 * POST /api/images/upload-product
 * Body: multipart/form-data
 *   - file: ملف الصورة
 *   - productId: معرف المنتج (اختياري)
 */
router.post('/upload-product', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم اختيار ملف' });
        }

        const { productId } = req.body;
        const timestamp = Date.now();
        const fileName = `product-${productId || 'temp'}-${timestamp}`;

        // معالجة الصورة الأساسية (WebP)
        const webpBuffer = await processImage(req.file.buffer, 'webp', {
            width: 800,
            height: 800,
            quality: 85
        });

        // معالجة صورة مصغرة (thumbnail)
        const thumbnailBuffer = await processImage(req.file.buffer, 'webp', {
            width: 300,
            height: 300,
            quality: 80
        });

        // رفع الصور إلى Firebase Storage
        const bucket = storage.bucket();
        const mainImagePath = `products/${fileName}.webp`;
        const thumbnailPath = `products/thumbnails/${fileName}-thumb.webp`;

        const mainImageFile = bucket.file(mainImagePath);
        const thumbnailFile = bucket.file(thumbnailPath);

        // رفع الصورة الأساسية
        await mainImageFile.save(webpBuffer, {
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
        });

        // رفع الصورة المصغرة
        await thumbnailFile.save(thumbnailBuffer, {
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
        });

        // الحصول على روابط التحميل العام
        const [mainUrl] = await mainImageFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // سنة واحدة
        });

        const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        });

        // إرجاع معلومات الصور
        res.json({
            success: true,
            image: {
                url: mainUrl,
                path: mainImagePath,
                size: webpBuffer.length,
                format: 'webp'
            },
            thumbnail: {
                url: thumbnailUrl,
                path: thumbnailPath,
                size: thumbnailBuffer.length,
                format: 'webp'
            },
            originalSize: req.file.size,
            compressionRatio: ((1 - webpBuffer.length / req.file.size) * 100).toFixed(2) + '%'
        });

    } catch (error) {
        console.error('❌ خطأ في رفع الصورة:', error);
        res.status(500).json({
            error: error.message || 'فشل في رفع الصورة'
        });
    }
});

/**
 * رفع صورة الإعدادات (مثل شعار المتجر)
 * POST /api/images/upload-settings
 * Body: multipart/form-data
 *   - file: ملف الصورة
 *   - type: نوع الصورة (logo, banner, etc)
 */
router.post('/upload-settings', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم اختيار ملف' });
        }

        const { type = 'logo' } = req.body;
        const timestamp = Date.now();
        const fileName = `${type}-${timestamp}`;

        // معالجة الصورة
        const processedBuffer = await processImage(req.file.buffer, 'webp', {
            width: type === 'logo' ? 200 : 1200,
            height: type === 'logo' ? 200 : 400,
            quality: 85
        });

        // رفع الصورة إلى Firebase Storage
        const bucket = storage.bucket();
        const imagePath = `settings/${fileName}.webp`;
        const imageFile = bucket.file(imagePath);

        await imageFile.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
        });

        // الحصول على رابط التحميل العام
        const [imageUrl] = await imageFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            image: {
                url: imageUrl,
                path: imagePath,
                size: processedBuffer.length,
                format: 'webp',
                type: type
            },
            originalSize: req.file.size,
            compressionRatio: ((1 - processedBuffer.length / req.file.size) * 100).toFixed(2) + '%'
        });

    } catch (error) {
        console.error('❌ خطأ في رفع صورة الإعدادات:', error);
        res.status(500).json({
            error: error.message || 'فشل في رفع الصورة'
        });
    }
});

/**
 * معالجة صورة موجودة في Firebase Storage
 * POST /api/images/process
 * Body: JSON
 *   - imagePath: مسار الصورة في Firebase Storage
 *   - width: العرض المطلوب (اختياري)
 *   - height: الارتفاع المطلوب (اختياري)
 *   - quality: جودة الصورة (اختياري)
 */
router.post('/process', async (req, res) => {
    try {
        const { imagePath, width = 800, height = 800, quality = 85 } = req.body;

        if (!imagePath) {
            return res.status(400).json({ error: 'يجب تحديد مسار الصورة' });
        }

        // تحميل الصورة من Firebase Storage
        const bucket = storage.bucket();
        const file = bucket.file(imagePath);
        const [buffer] = await file.download();

        // معالجة الصورة
        const processedBuffer = await processImage(buffer, 'webp', {
            width: parseInt(width),
            height: parseInt(height),
            quality: parseInt(quality)
        });

        // حفظ الصورة المعالجة
        const processedPath = imagePath.replace(/\.[^.]+$/, `-processed-${Date.now()}.webp`);
        const processedFile = bucket.file(processedPath);

        await processedFile.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
        });

        // الحصول على رابط التحميل العام
        const [imageUrl] = await processedFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            image: {
                url: imageUrl,
                path: processedPath,
                size: processedBuffer.length,
                format: 'webp'
            },
            originalSize: buffer.length,
            compressionRatio: ((1 - processedBuffer.length / buffer.length) * 100).toFixed(2) + '%'
        });

    } catch (error) {
        console.error('❌ خطأ في معالجة الصورة:', error);
        res.status(500).json({
            error: error.message || 'فشل في معالجة الصورة'
        });
    }
});

/**
 * حذف صورة من Firebase Storage
 * DELETE /api/images/:imagePath
 */
router.delete('/:imagePath', async (req, res) => {
    try {
        const { imagePath } = req.params;

        if (!imagePath) {
            return res.status(400).json({ error: 'يجب تحديد مسار الصورة' });
        }

        // فك ترميز المسار
        const decodedPath = decodeURIComponent(imagePath);

        // حذف الصورة من Firebase Storage
        const bucket = storage.bucket();
        const file = bucket.file(decodedPath);

        await file.delete();

        res.json({
            success: true,
            message: 'تم حذف الصورة بنجاح'
        });

    } catch (error) {
        console.error('❌ خطأ في حذف الصورة:', error);
        res.status(500).json({
            error: error.message || 'فشل في حذف الصورة'
        });
    }
});

module.exports = router;
