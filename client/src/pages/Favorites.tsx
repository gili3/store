import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Heart, ShoppingCart, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatNumber } from "@/lib/formatters";

/* ── FavoriteProductItem — matches APK FavoriteProductItem exactly ── */
function FavoriteProductItem({ product, onAddToCart, onToggleFavorite }: {
  product: any; onAddToCart: () => void; onToggleFavorite: () => void;
}) {
  return (
    <Link href={`/product/${product.productId || product.id}`}>
      <a className="block group">
        <Card className="overflow-hidden border border-border bg-white shadow-sm hover:shadow-md transition-all rounded-2xl">
          {/* Image box with fav button overlay — matches APK Box layout */}
          <div className="relative">
            <img
              src={product.image || "https://via.placeholder.com/400"}
              alt={product.name}
              className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
              style={{ height: "180px" }}
            />
            {/* زر المفضلة — شفاف الخلفية، موحّد مع باقي البطاقات */}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
              className="absolute top-2 left-2 bg-transparent p-1 flex items-center justify-center"
              aria-label="المفضلة"
            >
              <Heart className="w-5 h-5 drop-shadow-md fill-red-500 text-red-500" />
            </button>
          </div>
          {/* Info column like APK Column(padding(12)) */}
          <CardContent className="p-3">
            <p className="font-bold text-foreground text-sm truncate mb-1">{product.name}</p>
            <p className="text-primary font-extrabold text-lg mb-2">{formatNumber(product.price)} ج.س</p>
            {/* Add to cart button — matches APK Button exactly */}
            <Button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(); }}
              className="w-full bg-foreground text-background hover:bg-foreground/90 font-bold text-xs rounded-lg h-8 gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> أضف للسلة
            </Button>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}

export default function Favorites() {
  const { data: favorites = [], isLoading } = trpc.firestore.getFavorites.useQuery();
  const utils = trpc.useUtils();

  const addToCart = trpc.firestore.addToCart.useMutation({
    onSuccess: () => { toast.success("تمت الإضافة إلى السلة 🛒"); utils.firestore.getCart.invalidate(); },
    onError: (err: any) => toast.error(err.message || "فشل في الإضافة"),
  });

  const toggleFav = trpc.firestore.toggleFavorite.useMutation({
    onSuccess: () => { toast.success("تمت الإزالة من المفضلة"); utils.firestore.getFavorites.invalidate(); },
  });

  if (isLoading) return <Layout><div className="flex justify-center py-40"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Georgia, serif" }}>المفضلة</h1>
          <div className="w-10 h-1 bg-primary rounded-full mt-2" />
        </div>

        {/* LazyVerticalGrid(columns=2) like APK */}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {favorites.map((product: any) => (
              <FavoriteProductItem
                key={product.productId || product.id}
                product={product}
                onAddToCart={() => addToCart.mutate({
                  productId: product.productId || product.id,
                  quantity: 1,
                  price: product.price,
                  name: product.name,
                  image: product.image || "",
                })}
                onToggleFavorite={() => toggleFav.mutate({ productId: product.productId || product.id })}
              />
            ))}
          </div>
        ) : (
          /* EmptyFavorites like APK */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-28 h-28 bg-red-50 rounded-full flex items-center justify-center mb-5">
              <Heart className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "Georgia, serif" }}>
              لا توجد منتجات مفضلة
            </h2>
            <p className="text-muted-foreground text-sm mb-7 max-w-xs">
              أضف المنتجات التي تعجبك إلى المفضلة لتجدها هنا بسهولة
            </p>
            <Link href="/products">
              <a>
                <Button className="bg-primary text-white hover:bg-primary/90 font-bold px-8 h-12 rounded-xl">
                  تسوق الآن
                </Button>
              </a>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
