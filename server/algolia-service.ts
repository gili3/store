import { algoliasearch } from "algoliasearch";
import { ENV } from "./_core/env";
import { adminDb } from "./firebase-admin";

// ═══════════════════════════════════════════════════════════════════════════
//  Algolia — فهرسة المنتجات (Write-through من Firestore)
// ═══════════════════════════════════════════════════════════════════════════
//  • هذا الملف هو المكان الوحيد في السيرفر الذي يستخدم مفتاح الـ Admin
//    (ALGOLIA_ADMIN_API_KEY) — مفتاح كامل الصلاحيات (كتابة/حذف/إدارة فهارس)
//    ولا يجب أبداً تمريره للواجهة الأمامية. الواجهة تستخدم مفتاح Search-Only
//    منفصل تماماً (انظر client/src/lib/algolia.ts).
//  • إن لم تكن متغيرات البيئة معرَّفة (تطوير محلي بلا Algolia مثلاً)، كل
//    الدوال هنا تتحول إلى no-op بصمت مع تحذير مرة واحدة فقط — حتى لا يتعطل
//    إنشاء/تعديل المنتجات في بيئات لا تحتاج البحث فعلياً.
// ═══════════════════════════════════════════════════════════════════════════

const isConfigured = Boolean(ENV.algoliaAppId && ENV.algoliaAdminApiKey);

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "[Algolia] ALGOLIA_APP_ID / ALGOLIA_ADMIN_API_KEY غير معرَّفين — " +
      "لن تتم مزامنة المنتجات مع Algolia (البحث سيبقى يعمل عبر tRPC العادي فقط)."
  );
}

const client = isConfigured
  ? algoliasearch(ENV.algoliaAppId, ENV.algoliaAdminApiKey)
  : null;

const INDEX_NAME = ENV.algoliaProductsIndex;

export type AlgoliaProductRecord = {
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
  isActive: boolean;
  stock: number;
  imageUrl?: string;
  createdAtTimestamp: number;
};

/**
 * يجلب اسم الفئة/العلامة التجارية لإثراء سجل الفهرسة (يُستخدم للعرض والبحث
 * النصي بالاسم، وليس فقط بالمعرّف). فشل هذا الجلب لا يجب أن يمنع الفهرسة —
 * يُكتفى بترك الاسم فارغاً والاعتماد على الـ id كـ facet.
 */
async function resolveNames(categoryId?: string, brandId?: string) {
  const [categoryDoc, brandDoc] = await Promise.all([
    categoryId ? adminDb.collection("categories").doc(categoryId).get() : null,
    brandId ? adminDb.collection("brands").doc(brandId).get() : null,
  ]);
  return {
    categoryName: categoryDoc?.exists ? (categoryDoc.data()?.name as string) : undefined,
    brandName: brandDoc?.exists ? (brandDoc.data()?.name as string) : undefined,
  };
}

/**
 * يزامن منتجاً واحداً (إنشاء أو تحديث) مع فهرس Algolia. يُستدعى من
 * createProduct/updateProduct في firestore-router.ts بعد نجاح كتابة Firestore.
 * لا يرمي خطأ للمستدعي عند الفشل (مزامنة الفهرس ثانوية بالنسبة لنجاح العملية
 * الأساسية على Firestore) — يُسجَّل الخطأ فقط في السجلات (logs).
 */
export async function syncProductToIndex(productId: string, product: Record<string, any>): Promise<void> {
  if (!client) return warnNotConfigured();

  try {
    const { categoryName, brandName } = await resolveNames(product.categoryId, product.brandId);

    const record: AlgoliaProductRecord = {
      objectID: productId,
      name: product.name ?? "",
      description: product.description ?? "",
      price: product.price ?? 0,
      originalPrice: product.originalPrice,
      categoryId: product.categoryId ?? "",
      categoryName,
      brandId: product.brandId,
      brandName,
      isFeatured: Boolean(product.isFeatured),
      isOnSale: Boolean(product.isOnSale),
      isBestSeller: Boolean(product.isBestSeller),
      // ✅ نفهرس فقط المنتجات المتاحة فعلياً للبيع (نفس منطق الفلترة المطبَّق
      // حالياً في كل استعلامات getProducts/getNewProducts/getBestSellers) —
      // بهذا يتم الاستبعاد وقت الفهرسة بدل الاستبعاد المتأخر بعد جلب النتائج،
      // فلا تُهدر نتائج صفحة كاملة بسبب منتج نافد المخزون أو غير مُفعَّل.
      isActive: Boolean(product.isActive) && (product.stock ?? 0) > 0,
      stock: product.stock ?? 0,
      imageUrl: Array.isArray(product.images) ? product.images[0] : undefined,
      createdAtTimestamp: product.createdAt?.toMillis
        ? product.createdAt.toMillis()
        : Date.now(),
    };

    await client.saveObject({ indexName: INDEX_NAME, body: record });
  } catch (error) {
    console.error(`[Algolia] فشل مزامنة المنتج ${productId}:`, error);
  }
}

/** يحذف منتجاً من فهرس Algolia. يُستدعى من deleteProduct. */
export async function removeProductFromIndex(productId: string): Promise<void> {
  if (!client) return warnNotConfigured();

  try {
    await client.deleteObject({ indexName: INDEX_NAME, objectID: productId });
  } catch (error) {
    console.error(`[Algolia] فشل حذف المنتج ${productId} من الفهرس:`, error);
  }
}

/**
 * يعيد قراءة المخزون الحالي لمجموعة منتجات من Firestore ويزامنها مع Algolia.
 * يُستخدم بعد أي عملية تُغيّر المخزون خارج createProduct/updateProduct نفسها
 * (حجز المخزون عند إنشاء طلب، أو إعادته عند إلغاء طلب) — تلك العمليات تتم
 * داخل Firestore transactions، ولا يجوز إجراء نداءات شبكة خارجية (Algolia)
 * داخل transaction نشطة، لذا تُستدعى هذه الدالة *بعد* نجاح الـtransaction،
 * بشكل "fire-and-forget" لا يوقف استجابة الطلب للمستخدم عند فشلها.
 */
export async function resyncProductsStock(productIds: string[]): Promise<void> {
  if (!client || productIds.length === 0) return;

  const uniqueIds = [...new Set(productIds)];
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const doc = await adminDb.collection("products").doc(id).get();
        if (doc.exists) await syncProductToIndex(id, doc.data()!);
      } catch (error) {
        console.error(`[Algolia] فشل إعادة مزامنة مخزون المنتج ${id}:`, error);
      }
    })
  );
}

/**
 * يضبط إعدادات الفهرس (searchable attributes + facets) برمجياً — يمكن
 * استدعاؤها مرة واحدة يدوياً (عبر سكربت scripts/backfill-algolia.ts) بدل
 * ضبطها يدوياً من لوحة Algolia، حتى تبقى موثّقة بالكود.
 */
export async function configureIndexSettings(): Promise<void> {
  if (!client) return warnNotConfigured();

  await client.setSettings({
    indexName: INDEX_NAME,
    indexSettings: {
      searchableAttributes: [
        "name",
        "description",
        "categoryName",
        "brandName",
      ],
      attributesForFaceting: [
        "filterOnly(categoryId)",
        "filterOnly(brandId)",
        "filterOnly(isActive)",
        "isOnSale",
        "isFeatured",
        "isBestSeller",
      ],
      customRanking: ["desc(createdAtTimestamp)"],
      queryLanguages: ["ar", "en"],
      removeStopWords: false,
      ignorePlurals: true,
    },
  });
}
