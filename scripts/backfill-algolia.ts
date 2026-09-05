/**
 * سكربت لمرة واحدة: يفهرس كل المنتجات الموجودة حالياً في Firestore إلى
 * Algolia، ويضبط إعدادات الفهرس (searchable attributes + facets).
 *
 * يُستخدم فقط عند أول تفعيل لـAlgolia في هذا المشروع (أو بعد أي تغيير جذري
 * في بنية الفهرس). المزامنة اليومية العادية تتم تلقائياً من
 * createProduct/updateProduct/deleteProduct في server/firestore-router.ts —
 * هذا السكربت لا يُستدعى من أي مسار في التطبيق نفسه.
 *
 * التشغيل:
 *   ALGOLIA_APP_ID=... ALGOLIA_ADMIN_API_KEY=... FIREBASE_SERVICE_ACCOUNT='...' \
 *     npx tsx scripts/backfill-algolia.ts
 */
import { adminDb } from "../server/firebase-admin";
import { syncProductToIndex, configureIndexSettings } from "../server/algolia-service";
import { ENV } from "../server/_core/env";

async function main() {
  if (!ENV.algoliaAppId || !ENV.algoliaAdminApiKey) {
    console.error(
      "❌ ALGOLIA_APP_ID / ALGOLIA_ADMIN_API_KEY غير معرَّفين في متغيرات البيئة. أوقفت التنفيذ."
    );
    process.exit(1);
  }

  console.log("⚙️  ضبط إعدادات الفهرس (searchable attributes + facets)...");
  await configureIndexSettings();

  console.log("📦 جلب كل المنتجات من Firestore...");
  const snapshot = await adminDb.collection("products").get();
  console.log(`   وُجد ${snapshot.size} منتج.`);

  let synced = 0;
  for (const doc of snapshot.docs) {
    await syncProductToIndex(doc.id, doc.data());
    synced += 1;
    if (synced % 25 === 0) console.log(`   ...تمت مزامنة ${synced}/${snapshot.size}`);
  }

  console.log(`✅ تمت فهرسة ${synced} منتج بنجاح إلى فهرس "${ENV.algoliaProductsIndex}".`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ فشل السكربت:", error);
  process.exit(1);
});
