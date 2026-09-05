import { algoliasearch } from "algoliasearch";

/**
 * ELEVEN STORE — عميل بحث Algolia (Search-Only) للواجهة الأمامية.
 *
 * ⚠️ أمان: المفتاح هنا يجب أن يكون Search-Only API Key حصراً (من لوحة
 * Algolia → API Keys). هذا المفتاح آمن بالتصميم للنشر العلني في كود
 * الواجهة (لا يملك صلاحية كتابة/حذف) — تماماً كمفاتيح Firebase العامة
 * المستخدمة أصلاً في lib/firebase.ts. **لا تضع مفتاح الـAdmin هنا أبداً** —
 * ذاك يبقى حصراً على السيرفر (انظر server/algolia-service.ts).
 */

const APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID as string | undefined;
const SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY as string | undefined;
export const ALGOLIA_PRODUCTS_INDEX =
  (import.meta.env.VITE_ALGOLIA_PRODUCTS_INDEX as string | undefined) || "products";

export const isAlgoliaConfigured = Boolean(APP_ID && SEARCH_KEY);

// ✅ لا نفشل بصوت عالٍ (fail-fast) هنا كما في firebase.ts — البحث ميزة
// إضافية وليست أساسية لتشغيل المتجر: إن غابت متغيرات البيئة، تتحول Products.tsx
// تلقائياً إلى نمط "الفلترة القديمة" (انظر التعليق في Products.tsx) بدل تعطّل
// الموقع بالكامل.
export const algoliaClient = isAlgoliaConfigured
  ? algoliasearch(APP_ID!, SEARCH_KEY!)
  : null;

export type AlgoliaProductHit = {
  objectID: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  categoryId: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  isFeatured: boolean;
  isOnSale: boolean;
  isBestSeller: boolean;
  stock: number;
  imageUrl?: string;
};

export type SearchProductsParams = {
  query: string;
  categoryId?: string;
  brandId?: string;
  onSale?: boolean;
  isFeatured?: boolean;
  hitsPerPage?: number;
};

/**
 * يبحث عن منتجات عبر Algolia مباشرة من الواجهة (مفتاح Search-Only). يُستخدم
 * فقط عندما يكتب المستخدم نصاً فعلياً في حقل البحث — التصفح العادي بلا بحث
 * يبقى يمر عبر trpc.firestore.getProducts كما هو.
 *
 * ملاحظة: لا حاجة لتصفية stock/isActive يدوياً هنا — تُستبعد المنتجات غير
 * المتاحة أصلاً وقت الفهرسة (انظر syncProductToIndex في السيرفر).
 */
export async function searchProducts(params: SearchProductsParams): Promise<AlgoliaProductHit[]> {
  if (!algoliaClient) return [];

  const filters: string[] = ["isActive:true"];
  if (params.categoryId) filters.push(`categoryId:${params.categoryId}`);
  if (params.brandId) filters.push(`brandId:${params.brandId}`);
  if (params.onSale) filters.push("isOnSale:true");
  if (params.isFeatured) filters.push("isFeatured:true");

  // ⚠️ توقيع client.search() هنا مطابق لتوثيق algoliasearch v5 وقت كتابة هذا
  // الكود ({ requests: [...] } → { results: [...] }). لم يتسنَّ تشغيل
  // `npm install` فعلياً في بيئة التطوير الحالية (بلا اتصال شبكة) للتحقق ضد
  // النسخة المثبَّتة فعلياً — يُنصح بتجربة استدعاء بحث واحد يدوياً بعد
  // `pnpm install` والتأكد من مطابقة التوقيع لنسخة "algoliasearch" الفعلية
  // بـpackage.json قبل الاعتماد على هذا الكود بالإنتاج.
  const { results } = await algoliaClient.search({
    requests: [
      {
        indexName: ALGOLIA_PRODUCTS_INDEX,
        query: params.query,
        filters: filters.join(" AND "),
        hitsPerPage: params.hitsPerPage ?? 24,
      },
    ],
  });

  const firstResult = results[0];
  return "hits" in firstResult ? (firstResult.hits as unknown as AlgoliaProductHit[]) : [];
}
