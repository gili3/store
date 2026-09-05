/**
 * سكيلتون تحميل لبطاقة المنتج، بنفس أبعاد ProductCard الموحّدة
 * (صورة 1:1 + صف زر "إضافة للسلة" الكامل وزر المفضلة) وبنفس تأثير
 * الشيمر (shimmer) المستخدم في تطبيق الأندرويد لتوحيد حالة التحميل
 * بين المنصتين.
 */
export default function ProductCardSkeleton() {
  return (
    <div className="product-card-container h-full">
      <div className="product-image-wrapper skeleton-shimmer" />
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="skeleton-shimmer h-3.5 w-4/5 rounded-md" />
        <div className="skeleton-shimmer h-4 w-1/3 rounded-md" />
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <div className="skeleton-shimmer h-8 flex-1 rounded-lg" />
          <div className="skeleton-shimmer h-8 w-8 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({
  count = 6,
  className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
