// client/src/pages/Products.tsx
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Loader2, Sparkles, Heart, Share2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/formatters";
import { toast } from "sonner";
import { searchProducts, isAlgoliaConfigured, type AlgoliaProductHit } from "@/lib/algolia";

/** يحوّل نتيجة Algolia إلى نفس شكل المنتج المستخدم بباقي الصفحة/ProductCard */
function hitToProduct(hit: AlgoliaProductHit) {
  return {
    id: hit.objectID,
    name: hit.name,
    description: hit.description,
    price: hit.price,
    originalPrice: hit.originalPrice,
    categoryId: hit.categoryId,
    brandId: hit.brandId,
    isFeatured: hit.isFeatured,
    isOnSale: hit.isOnSale,
    isBestSeller: hit.isBestSeller,
    stock: hit.stock,
    images: hit.imageUrl ? [hit.imageUrl] : [],
  };
}

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // قراءة معاملات URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter");
    if (filter) setFilterType(filter);
    const cat = params.get("category");
    if (cat) setSelectedCategory(cat);
    const q = params.get("q");
    if (q) setSearchQuery(q);
  }, []);

  // جلب البيانات
  const { data: categories = [] } = trpc.firestore.getCategories.useQuery();
  const { data: brands = [] } = trpc.firestore.getBrands.useQuery();
  
  // جلب المنتجات حسب الفلتر
  const { data: allProducts = [], isLoading: isProductsLoading } = trpc.firestore.getProducts.useQuery({
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    brandId: filterType === 'brands' && selectedBrand !== "all" ? selectedBrand : undefined,
    isFeatured: filterType === 'featured' ? true : undefined,
    onSale: filterType === 'onSale' ? true : undefined,
  });

  // جلب المنتجات الجديدة
  const { data: newProducts = [], isLoading: isNewLoading } = trpc.firestore.getNewProducts.useQuery(
    { limit: 50 },
    { enabled: filterType === 'new' }
  );

  // جلب الأكثر مبيعاً
  const { data: bestSellers = [], isLoading: isBestLoading } = trpc.firestore.getBestSellers.useQuery(
    { limit: 50 },
    { enabled: filterType === 'bestSeller' }
  );

  // ─────────────────────────────────────────────────────────────────────
  // 🔎 البحث عبر Algolia (بدل الفلترة المحلية القديمة بـ includes())
  // ─────────────────────────────────────────────────────────────────────
  // يعمل فقط عندما توجد كلمة بحث فعلية ومتغيرات بيئة Algolia مضبوطة على
  // الواجهة (VITE_ALGOLIA_APP_ID / VITE_ALGOLIA_SEARCH_KEY). إن لم تكن
  // مضبوطة (بيئة تطوير محلية مثلاً)، يعود السلوك تلقائياً لفلترة الاسم/الوصف
  // القديمة أدناه — الموقع لا يتعطل بغياب Algolia.
  const trimmedQuery = searchQuery.trim();
  const useAlgoliaSearch = isAlgoliaConfigured && trimmedQuery.length > 0;

  const { data: searchHits = [], isLoading: isSearchLoading } = useQuery({
    queryKey: [
      "algolia-search",
      trimmedQuery,
      selectedCategory,
      filterType === 'brands' ? selectedBrand : null,
      filterType === 'featured',
      filterType === 'onSale',
    ],
    queryFn: () =>
      searchProducts({
        query: trimmedQuery,
        categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
        brandId: filterType === 'brands' && selectedBrand !== "all" ? selectedBrand : undefined,
        isFeatured: filterType === 'featured' ? true : undefined,
        onSale: filterType === 'onSale' ? true : undefined,
        hitsPerPage: 60,
      }),
    enabled: useAlgoliaSearch,
    staleTime: 30_000,
  });

  // اختيار البيانات المناسبة
  let products: any[] = [];
  let isLoading = false;

  if (useAlgoliaSearch) {
    products = searchHits.map(hitToProduct);
    isLoading = isSearchLoading;
  } else {
    switch (filterType) {
      case 'new':
        products = newProducts;
        isLoading = isNewLoading;
        break;
      case 'bestSeller':
        products = bestSellers;
        isLoading = isBestLoading;
        break;
      default:
        products = allProducts;
        isLoading = isProductsLoading;
        break;
    }

    // ✅ يُستخدم فقط عندما تكون Algolia غير مضبوطة (fallback) — نفس المنطق
    // القديم بالضبط، محتفَظ به عمداً حتى لا يفقد الموقع البحث كلياً في بيئة
    // بلا متغيرات Algolia.
    if (trimmedQuery && !isAlgoliaConfigured) {
      const q = trimmedQuery.toLowerCase();
      products = products.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
  }

  // ✅ لا تُعرض المنتجات التي نفدت كميتها (طبقة حماية إضافية، السيرفر/Algolia يصفّيها أصلاً)
  products = products.filter((p: any) => (p.stock ?? 0) > 0);

  const { data: favorites = [] } = trpc.firestore.getFavorites.useQuery();
  const utils = trpc.useUtils();

  const addToCart = trpc.firestore.addToCart.useMutation({
    onSuccess: () => {
      toast.success("تمت الإضافة إلى السلة 🛒");
      utils.firestore.getCart.invalidate();
    },
    onError: (err) => toast.error(err.message || "فشل في الإضافة للسلة"),
  });

  const toggleFavorite = trpc.firestore.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.favorited ? "✨ تمت الإضافة للمفضلة" : "🗑️ تمت الإزالة من المفضلة");
      utils.firestore.getFavorites.invalidate();
    },
    onError: (err) => toast.error(err.message || "حدث خطأ"),
  });

  const isFavorite = (productId: string) => {
    return favorites.some((f: any) => f.productId === productId);
  };

  const handleShare = (productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    navigator.clipboard?.writeText(url).then(() => {
      toast.success("تم نسخ رابط المنتج");
    }).catch(() => {
      toast.success(`رابط المنتج: ${url}`);
    });
  };

  return (
    <Layout>
      <ErrorBoundary>
        <div className="container py-4">
          {/* Filter Bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 border-b border-border space-y-3">
            {/* Two dropdowns side by side like APK */}
            <div className="flex gap-2">
              {/* Category Dropdown */}
              <div className="flex-1 relative">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full bg-card border-border rounded-lg h-10 text-sm">
                    <SelectValue placeholder="كل الفئات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفئات</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Dropdown */}
              <div className="flex-1 relative">
                <Select value={filterType} onValueChange={(val) => { setFilterType(val); if (val !== "brands") setSelectedBrand("all"); }}>
                  <SelectTrigger className="w-full bg-card border-border rounded-lg h-10 text-sm">
                    <SelectValue placeholder="تصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المنتجات</SelectItem>
                    <SelectItem value="new">المنتجات الجديدة</SelectItem>
                    <SelectItem value="bestSeller">الأكثر مبيعاً</SelectItem>
                    <SelectItem value="featured">المنتجات المميزة</SelectItem>
                    <SelectItem value="onSale">العروض والخصومات</SelectItem>
                    <SelectItem value="brands">العلامات التجارية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Brand dropdown — conditional like APK */}
            {filterType === "brands" && (
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-full bg-card border-border rounded-lg h-10 text-sm">
                  <SelectValue placeholder="اختر علامة تجارية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الماركات</SelectItem>
                  {brands.map((brand: any) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-32">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 mt-6">
              {products.map((product: any) => {
                const discount = product.originalPrice && product.originalPrice > product.price
                  ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                  : 0;
                const isFav = isFavorite(product.id);

                return (
                  <Link key={product.id} href={`/product/${product.id}`}>
                    <a className="group block">
                      <Card className="overflow-hidden border border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 rounded-xl">
                        {/* Image — square 1:1 like APK */}
                        <div className="relative w-full aspect-square overflow-hidden bg-secondary/20">
                          <img
                            src={product.images?.[0] || "https://via.placeholder.com/400x400"}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {discount > 0 && (
                            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                              -{discount}%
                            </div>
                          )}
                          {product.isFeatured && !discount && (
                            <div className="absolute top-2 right-2 bg-primary text-white px-2 py-0.5 rounded text-xs font-bold">
                              مميز
                            </div>
                          )}
                        </div>

                        {/* Info — compact like APK */}
                        <div className="p-3">
                          <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1 mb-1">
                            {product.name}
                          </h3>
                          {/* Price */}
                          <div className="flex items-baseline gap-1.5 mb-3">
                            <span className="text-base font-extrabold text-primary">
                              {formatNumber(product.price)} ج.س
                            </span>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatNumber(product.originalPrice)}
                              </span>
                            )}
                          </div>
                          {/* Add to Cart + Fav like APK */}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="flex-1 bg-primary text-white hover:bg-primary/90 font-semibold text-xs rounded-lg h-8"
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                addToCart.mutate({ productId: product.id, quantity: 1, price: product.price, name: product.name, image: product.images?.[0] || "" });
                              }}
                              disabled={addToCart.isPending}
                            >
                              <Sparkles className="w-3 h-3 ml-1" /> إضافة للسلة
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="px-2 border-border hover:bg-accent/5 rounded-lg h-8"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite.mutate({ productId: product.id }); }}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-red-500 text-red-500" : "text-foreground"}`} />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </a>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="mb-6">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-foreground mb-2">لم نجد أي منتجات</h3>
                <p className="text-muted-foreground text-lg">
                  حاول تغيير الفلاتر أو العودة للصفحة الرئيسية
                </p>
              </div>
              <Link href="/">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                  العودة للرئيسية
                </Button>
              </Link>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </Layout>
  );
}