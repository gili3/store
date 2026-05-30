/**
 * ============================================================
 * SEO-ENHANCED.JS - تحسينات محركات البحث المتقدمة
 * ============================================================
 * 
 * يحتوي على:
 * 1. Meta Tags الديناميكية
 * 2. Structured Data (Schema.org)
 * 3. Sitemap و Robots.txt
 * 4. Open Graph Tags
 * 5. Twitter Cards
 * 
 * ============================================================
 */

// ============================================================
// 1. Meta Tags الديناميكية
// ============================================================

/**
 * إنشاء Meta Tags للصفحة الرئيسية
 */
const generateHomePageMeta = (settings) => {
    return {
        title: `${settings.storeName} - متجرك الموثوق للتسوق الإلكتروني`,
        description: settings.storeDescription || `اكتشف أفضل المنتجات في ${settings.storeName}. تسوق آمن وسريع مع ضمان الجودة والأسعار المنافسة.`,
        keywords: `${settings.storeName}, متجر إلكتروني, تسوق أونلاين, منتجات أصلية, أسعار منخفضة`,
        canonical: 'https://yourstore.com/',
        ogTitle: `${settings.storeName} - متجرك الموثوق`,
        ogDescription: settings.storeDescription || 'اكتشف أفضل المنتجات معنا',
        ogImage: settings.logoUrl || 'https://yourstore.com/logo.png',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: `${settings.storeName}`,
        twitterDescription: settings.storeDescription || 'متجر إلكتروني موثوق',
        twitterImage: settings.logoUrl || 'https://yourstore.com/logo.png'
    };
};

/**
 * إنشاء Meta Tags لصفحة المنتجات
 */
const generateProductsPageMeta = (settings, categoryName = null) => {
    const title = categoryName 
        ? `${categoryName} - ${settings.storeName}`
        : `المنتجات - ${settings.storeName}`;
    
    const description = categoryName
        ? `تصفح جميع منتجات ${categoryName} في ${settings.storeName}. أفضل الأسعار والجودة المضمونة.`
        : `تصفح جميع منتجات ${settings.storeName}. اختر من آلاف المنتجات الأصلية بأفضل الأسعار.`;
    
    return {
        title,
        description,
        keywords: `${categoryName || 'منتجات'}, ${settings.storeName}, تسوق أونلاين`,
        canonical: categoryName 
            ? `https://yourstore.com/products?category=${categoryName}`
            : 'https://yourstore.com/products',
        ogTitle: title,
        ogDescription: description,
        ogImage: settings.logoUrl || 'https://yourstore.com/logo.png',
        ogType: 'website',
        twitterCard: 'summary_large_image'
    };
};

/**
 * إنشاء Meta Tags لصفحة المنتج الفردي
 */
const generateProductMeta = (product, settings) => {
    return {
        title: `${product.name} - ${settings.storeName}`,
        description: product.description?.substring(0, 160) || `اشترِ ${product.name} من ${settings.storeName}. السعر: ${product.price} ${settings.storeCurrency}`,
        keywords: `${product.name}, ${product.categoryName}, ${settings.storeName}, شراء أونلاين`,
        canonical: `https://yourstore.com/product/${product.id}`,
        ogTitle: product.name,
        ogDescription: product.description?.substring(0, 160) || `اشترِ ${product.name}`,
        ogImage: product.image || 'https://yourstore.com/placeholder.png',
        ogType: 'product',
        ogPrice: product.price,
        ogCurrency: settings.storeCurrency,
        twitterCard: 'product',
        twitterTitle: product.name,
        twitterDescription: product.description?.substring(0, 160),
        twitterImage: product.image
    };
};

// ============================================================
// 2. Structured Data (Schema.org)
// ============================================================

/**
 * إنشاء Schema.org للمتجر
 */
const generateStoreSchema = (settings) => {
    return {
        '@context': 'https://schema.org',
        '@type': 'OnlineStore',
        'name': settings.storeName,
        'description': settings.storeDescription,
        'url': 'https://yourstore.com',
        'logo': settings.logoUrl,
        'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'Customer Service',
            'telephone': settings.contactPhone,
            'email': settings.contactEmail
        },
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': settings.address,
            'addressCountry': 'SD'
        }
    };
};

/**
 * إنشاء Schema.org للمنتج
 */
const generateProductSchema = (product, settings) => {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': product.name,
        'description': product.description,
        'image': product.image,
        'brand': {
            '@type': 'Brand',
            'name': settings.storeName
        },
        'offers': {
            '@type': 'Offer',
            'url': `https://yourstore.com/product/${product.id}`,
            'priceCurrency': settings.storeCurrency,
            'price': product.price,
            'availability': product.stock > 0 ? 'InStock' : 'OutOfStock',
            'seller': {
                '@type': 'Organization',
                'name': settings.storeName
            }
        },
        'aggregateRating': product.rating ? {
            '@type': 'AggregateRating',
            'ratingValue': product.rating.value,
            'reviewCount': product.rating.count
        } : undefined
    };
};

/**
 * إنشاء Schema.org للطلب (Order)
 */
const generateOrderSchema = (order, settings) => {
    return {
        '@context': 'https://schema.org',
        '@type': 'Order',
        'orderNumber': order.orderId,
        'orderDate': order.createdAt,
        'orderStatus': `https://schema.org/${order.status === 'delivered' ? 'OrderDelivered' : 'OrderProcessing'}`,
        'priceCurrency': settings.storeCurrency,
        'price': order.total,
        'merchant': {
            '@type': 'Organization',
            'name': settings.storeName
        },
        'itemsOrdered': order.items.map(item => ({
            '@type': 'OrderItem',
            'orderItemStatus': 'OrderItemShipped',
            'orderedItem': {
                '@type': 'Product',
                'name': item.name,
                'sku': item.id
            },
            'orderQuantity': item.quantity,
            'unitPriceSpecification': {
                '@type': 'PriceSpecification',
                'priceCurrency': settings.storeCurrency,
                'price': item.price
            }
        }))
    };
};

// ============================================================
// 3. Sitemap Generator
// ============================================================

/**
 * توليد Sitemap XML
 */
const generateSitemap = (products, categories, baseUrl = 'https://yourstore.com') => {
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // الصفحة الرئيسية
    sitemap += `
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    `;
    
    // صفحة المنتجات
    sitemap += `
    <url>
        <loc>${baseUrl}/products</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>
    `;
    
    // صفحات الفئات
    categories.forEach(category => {
        sitemap += `
    <url>
        <loc>${baseUrl}/products?category=${category.id}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
        `;
    });
    
    // صفحات المنتجات الفردية
    products.forEach(product => {
        sitemap += `
    <url>
        <loc>${baseUrl}/product/${product.id}</loc>
        <lastmod>${product.updatedAt || new Date().toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>
        `;
    });
    
    sitemap += '</urlset>';
    
    return sitemap;
};

// ============================================================
// 4. Robots.txt Generator
// ============================================================

/**
 * توليد Robots.txt
 */
const generateRobotsTxt = () => {
    return `User-agent: *
Allow: /
Allow: /products
Allow: /product/
Allow: /static/
Disallow: /admin
Disallow: /api/
Disallow: /private/
Disallow: /*.json$

Sitemap: https://yourstore.com/sitemap.xml

# Google Bot
User-agent: Googlebot
Allow: /

# Bing Bot
User-agent: Bingbot
Allow: /

# Crawl delay
Crawl-delay: 1`;
};

// ============================================================
// 5. Open Graph و Twitter Cards
// ============================================================

/**
 * إنشاء Open Graph Tags
 */
const generateOpenGraphTags = (meta) => {
    return `
    <meta property="og:title" content="${meta.ogTitle}" />
    <meta property="og:description" content="${meta.ogDescription}" />
    <meta property="og:image" content="${meta.ogImage}" />
    <meta property="og:type" content="${meta.ogType}" />
    <meta property="og:url" content="${meta.canonical}" />
    ${meta.ogPrice ? `<meta property="product:price:amount" content="${meta.ogPrice}" />` : ''}
    ${meta.ogCurrency ? `<meta property="product:price:currency" content="${meta.ogCurrency}" />` : ''}
    `;
};

/**
 * إنشاء Twitter Cards Tags
 */
const generateTwitterCardTags = (meta) => {
    return `
    <meta name="twitter:card" content="${meta.twitterCard}" />
    <meta name="twitter:title" content="${meta.twitterTitle}" />
    <meta name="twitter:description" content="${meta.twitterDescription}" />
    <meta name="twitter:image" content="${meta.twitterImage}" />
    `;
};

// ============================================================
// 6. SEO Middleware
// ============================================================

/**
 * Middleware لإضافة Meta Tags تلقائياً
 */
const seoMiddleware = (metaTags) => {
    return (req, res, next) => {
        res.locals.meta = metaTags;
        res.locals.openGraphTags = generateOpenGraphTags(metaTags);
        res.locals.twitterCardTags = generateTwitterCardTags(metaTags);
        next();
    };
};

// ============================================================
// 7. Canonical URLs
// ============================================================

/**
 * إنشاء Canonical URL لتجنب Duplicate Content
 */
const generateCanonicalURL = (path, baseUrl = 'https://yourstore.com') => {
    // إزالة المعاملات غير المهمة
    const cleanPath = path.split('?')[0];
    return `${baseUrl}${cleanPath}`;
};

// ============================================================
// 8. JSON-LD Structured Data
// ============================================================

/**
 * إنشاء JSON-LD Script Tag
 */
const generateJSONLD = (schema) => {
    return `
    <script type="application/ld+json">
    ${JSON.stringify(schema, null, 2)}
    </script>
    `;
};

// ============================================================
// Export
// ============================================================

module.exports = {
    // Meta Tags
    generateHomePageMeta,
    generateProductsPageMeta,
    generateProductMeta,
    
    // Structured Data
    generateStoreSchema,
    generateProductSchema,
    generateOrderSchema,
    
    // Sitemap & Robots
    generateSitemap,
    generateRobotsTxt,
    
    // Open Graph & Twitter
    generateOpenGraphTags,
    generateTwitterCardTags,
    
    // Middleware
    seoMiddleware,
    
    // Canonical URLs
    generateCanonicalURL,
    
    // JSON-LD
    generateJSONLD
};
