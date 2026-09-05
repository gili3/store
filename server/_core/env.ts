const isProduction = process.env.NODE_ENV === "production";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "default-app-id",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // ─────────────────────────────────────────────────────────────────────
  // Algolia — مفتاح الـ Admin هنا فقط (سيرفر)، ولا يصل أبداً للمتصفح.
  // الواجهة تستخدم مفتاح Search-Only منفصل عبر VITE_ALGOLIA_SEARCH_KEY.
  // ─────────────────────────────────────────────────────────────────────
  algoliaAppId: process.env.ALGOLIA_APP_ID ?? "",
  algoliaAdminApiKey: process.env.ALGOLIA_ADMIN_API_KEY ?? "",
  algoliaProductsIndex: process.env.ALGOLIA_PRODUCTS_INDEX ?? "products",
};
