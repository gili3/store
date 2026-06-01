const express = require("express");
const NodeCache = require("node-cache");

module.exports = (dataService) => {
    const router = express.Router();
    // إعداد Cache لمدة 10 دقائق للمنتجات العامة
    const productCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

    /**
     * تطبيع النصوص العربية للبحث
     */
    const normalizeArabic = (text) => {
        if (!text) return "";
        return text
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .toLowerCase()
            .trim();
    };

    /**
     * جلب جميع المنتجات النشطة مع البحث والتصفية والترتيب والترقيم
     */
    router.get("/", async (req, res) => {
        try {
            const { search, category, minPrice, maxPrice, sort = "newest", page = 1, limit = 12 } = req.query;

            let sortField = "createdAt";
            let sortOrder = "desc";

            switch (sort) {
                case "price-low":
                    sortField = "price";
                    sortOrder = "asc";
                    break;
                case "price-high":
                    sortField = "price";
                    sortOrder = "desc";
                    break;
                case "newest":
                default:
                    sortField = "createdAt";
                    sortOrder = "desc";
                    break;
            }

            const limitNum = parseInt(limit) || 12;
            const pageNum = parseInt(page) || 1;
            const offset = (pageNum - 1) * limitNum;

            const { products, totalProducts } = await dataService.getProducts({
                category,
                search,
                minPrice,
                maxPrice,
                sortField,
                sortOrder,
                limit: limitNum,
                offset: offset
            });

            res.json({
                success: true,
                data: products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum),
                    totalProducts: totalProducts,
                    productsPerPage: limitNum,
                    hasNextPage: pageNum < Math.ceil(totalProducts / limitNum),
                    hasPrevPage: pageNum > 1
                }
            });
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * جلب منتج واحد بواسطة ID
     */
    router.get("/product/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const cacheKey = `product_${id}`;
            let product = productCache.get(cacheKey);

            if (!product) {
                product = await dataService.getProductById(id);
                if (product) {
                    productCache.set(cacheKey, product);
                }
            }

            if (!product || !product.isActive) {
                return res.status(404).json({ success: false, error: "المنتج غير موجود" });
            }

            res.json({ success: true, data: product });
        } catch (error) {
            console.error("Error fetching product by ID:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * جلب المنتجات المميزة
     */
    router.get("/featured/list", async (req, res) => {
        try {
            const cacheKey = "featured_products";
            let featuredProducts = productCache.get(cacheKey);

            if (!featuredProducts) {
                // يمكن إضافة حقل isFeatured في Firestore واستخدامه مباشرة
                const snapshot = await db.collection("products").where("isFeatured", "==", true).where("isActive", "==", true).limit(8).get();
                featuredProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                productCache.set(cacheKey, featuredProducts);
            }
            res.json({ success: true, data: featuredProducts });
        } catch (error) {
            console.error("Error fetching featured products:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * بحث متقدم عن المنتجات (لا يزال يعتمد على الفلترة في الذاكرة للبحث النصي المعقد)
     */
    router.get("/search/advanced", async (req, res) => {
        try {
            const { query: searchQuery, category, minPrice, maxPrice, sort = "newest", page = 1, limit = 12 } = req.query;

            let sortField = "createdAt";
            let sortOrder = "desc";

            switch (sort) {
                case "price-low":
                    sortField = "price";
                    sortOrder = "asc";
                    break;
                case "price-high":
                    sortField = "price";
                    sortOrder = "desc";
                    break;
                case "newest":
                default:
                    sortField = "createdAt";
                    sortOrder = "desc";
                    break;
            }

            const limitNum = parseInt(limit) || 12;
            const pageNum = parseInt(page) || 1;
            const offset = (pageNum - 1) * limitNum;

            const { products, totalProducts } = await dataService.getProducts({
                category,
                search: searchQuery ? normalizeArabic(searchQuery) : null,
                minPrice,
                maxPrice,
                sortField,
                sortOrder,
                limit: limitNum,
                offset: offset
            });

            res.json({
                success: true,
                data: products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum),
                    totalProducts: totalProducts,
                    productsPerPage: limitNum,
                    hasNextPage: pageNum < Math.ceil(totalProducts / limitNum),
                    hasPrevPage: pageNum > 1
                }
            });
        } catch (error) {
            console.error("Error in advanced product search:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * مسح الكاش (للاستخدام الإداري أو عند تحديث المنتجات)
     */
    router.post("/cache/clear", (req, res) => {
        try {
            productCache.flushAll();
            res.json({ success: true, message: "تم مسح كاش المنتجات بنجاح" });
        } catch (error) {
            console.error("Error clearing product cache:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
