/**
 * Asset Handler Middleware
 * يقوم بخدمة الأصول الثابتة (CSS, JS, Images) بطريقة محسّنة
 * مع إضافة رؤوس التخزين المؤقت والضغط
 */

const express = require('express');
const path = require('path');
const compression = require('compression');

module.exports = (app) => {
    // تفعيل الضغط لجميع الاستجابات
    app.use(compression());

    // خدمة الملفات الثابتة من مجلد static
    app.use("/public", express.static(path.join(__dirname, "../static/public"), {
        maxAge: '1d',
        etag: false,
        lastModified: true,
        setHeaders: (res, filePath) => {
            // إضافة رؤوس الأمان
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            
            // تحسين التخزين المؤقت حسب نوع الملف
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
                res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 يوم
            } else if (filePath.endsWith('.svg')) {
                res.setHeader('Cache-Control', 'public, max-age=86400'); // يوم واحد
            } else {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));

    // خدمة الأصول المشتركة (مجلد shared)
    app.use("/shared", express.static(path.join(__dirname, "../static/shared"), {
        maxAge: '1d',
        etag: false,
        lastModified: true,
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    // خدمة أصول لوحة التحكم
    app.use("/admin-assets", express.static(path.join(__dirname, "../static/admin"), {
        maxAge: '1d',
        etag: false,
        lastModified: true,
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    // خدمة ملف manifest.json
    app.use("/manifest.json", express.static(path.join(__dirname, "../static/manifest.json"), {
        maxAge: '1d',
        setHeaders: (res) => {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }));

    // خدمة الملفات الجذرية (robots.txt, sitemap.xml)
    app.use(express.static(path.join(__dirname, "../static"), {
        maxAge: '1d'
    }));

    console.log('✓ Asset handler middleware configured (Production Ready)');
};
