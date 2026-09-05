import { Link } from "wouter";
import { Heart, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatPrice } from "@/lib/formatters";

/**
 * بطاقة المنتج الموحدة بين الموقع والتطبيق — مطابقة لـ ProductCard.kt (Android):
 * - صورة المنتج 1:1 بزوايا rounded-xl (12px)، شارة خصم/مميز فوقها (top-2 right-2)
 * - أيقونة مفضلة شفافة الخلفية أعلى يسار الصورة (top-2 left-2)
 * - الاسم عريض سطر واحد، ثم السعر (والسعر قبل الخصم إن وجد)
 * - زر "إضافة للسلة" بعرض كامل أسفل البطاقة (accent)
 */

export interface ProductCardProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  images?: string[];
  image?: string;
  stock?: number;
}

interface ProductCardProps {
  product: ProductCardProduct;
  isFavorite?: boolean;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop";

export default function ProductCard({ product, isFavorite = false }: ProductCardProps) {
  const utils = trpc.useUtils();

  const toggleFavorite = trpc.firestore.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.favorited ? "✨ تمت الإضافة للمفضلة" : "🗑️ تمت الإزالة من المفضلة");
      utils.firestore.getFavorites.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "فشل في تحديث المفضلة");
    },
  });

  const addToCart = trpc.firestore.addToCart.useMutation({
    onSuccess: () => {
      toast.success("تمت الإضافة إلى السلة");
      utils.firestore.getCart.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "فشل في الإضافة إلى السلة");
    },
  });

  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) * 100
        )
      : 0;

  const imageSrc = product.images?.[0] || product.image || FALLBACK_IMAGE;
  const outOfStock = product.stock !== undefined && product.stock <= 0;

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate({ productId: product.id });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      toast.error("المنتج غير متوفر حالياً");
      return;
    }
    addToCart.mutate({
      productId: product.id,
      quantity: 1,
      price: product.price,
      name: product.name,
      image: imageSrc,
    });
  };

  return (
    <Link href={`/product/${product.id}`}>
      <a className="group block h-full">
        <div className="product-card-container h-full">
          {/* صورة المنتج 1:1 — شارة خصم/مميز يمين، وأيقونة مفضلة شفافة يسار الصورة */}
          <div className="product-image-wrapper">
            <img
              src={imageSrc}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />

            {discount > 0 && (
              <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-0.5 rounded-md text-xs font-bold">
                -{discount}%
              </div>
            )}

            {/* أيقونة المفضلة — شفافة الخلفية، أعلى يسار البطاقة */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label="إضافة للمفضلة"
              className="absolute top-2 left-2 bg-transparent p-1 flex items-center justify-center"
            >
              <Heart
                className={`w-5 h-5 drop-shadow-md ${
                  isFavorite ? "fill-destructive text-destructive" : "fill-white/30 text-white"
                }`}
              />
            </button>
          </div>

          {/* معلومات المنتج — p-3، اسم عريض سطر واحد، ثم السعر، ثم زر الإضافة للسلة */}
          <div className="flex flex-col flex-1 p-3">
            <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1 mb-1">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="price-tag text-base">{formatPrice(product.price)}</span>
              {discount > 0 && (
                <span className="old-price ml-0">{formatPrice(product.originalPrice!)}</span>
              )}
            </div>

            {/* زر إضافة للسلة — بعرض كامل، مطابق لـ ProductCard.kt */}
            <div className="flex items-center gap-1.5 mt-auto">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock}
                aria-label="إضافة إلى السلة"
                className="w-full h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1 text-xs font-semibold disabled:opacity-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                إضافة للسلة
              </button>
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
