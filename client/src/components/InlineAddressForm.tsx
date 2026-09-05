import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface InlineAddressFormProps {
  addresses: any[];
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string) => void;
  onAddressAdded?: () => void;
  isLoading?: boolean;
}

export default function InlineAddressForm({
  addresses,
  selectedAddressId,
  onAddressSelect,
  onAddressAdded,
  isLoading = false
}: InlineAddressFormProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: "",
    phone: "",
    city: "",
    address: "",
    isDefault: false
  });

  const utils = trpc.useUtils();
  const addAddress = trpc.firestore.addAddress.useMutation({
    onSuccess: (data) => {
      toast.success("تمت إضافة العنوان بنجاح");
      setShowDialog(false);
      setNewAddress({
        fullName: "",
        phone: "",
        city: "",
        address: "",
        isDefault: false
      });
      utils.firestore.getAddresses.invalidate();
      if (data.id) {
        onAddressSelect(data.id);
      }
      onAddressAdded?.();
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء إضافة العنوان");
    }
  });

  const handleAddAddress = () => {
    if (!newAddress.fullName || !newAddress.phone || !newAddress.city || !newAddress.address) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    addAddress.mutate(newAddress);
  };

  const handleAddressChange = (field: string, value: string | boolean) => {
    setNewAddress(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">عناوين الشحن الخاصة بك</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDialog(true)}
          disabled={isLoading}
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة عنوان جديد
        </Button>
      </div>

      {addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((addr: any) => (
            <label
              key={addr.id}
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedAddressId === addr.id
                  ? "border-primary bg-accent/5"
                  : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="address"
                checked={selectedAddressId === addr.id}
                onChange={() => onAddressSelect(addr.id)}
                className="w-4 h-4 accent-primary"
              />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-foreground">{addr.fullName}</p>
                  {addr.isDefault && (
                    <span className="text-[10px] bg-accent/10 text-primary px-2 py-0.5 rounded">
                      افتراضي
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {addr.city}، {addr.address}
                </p>
                <p className="text-sm text-muted-foreground">{addr.phone}</p>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground mb-4">لا يوجد لديك عناوين مسجلة حالياً</p>
          <Button
            variant="outline"
            onClick={() => setShowDialog(true)}
            disabled={isLoading}
          >
            إضافة عنوان الآن
          </Button>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة عنوان توصيل جديد</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                الاسم الكامل
              </label>
              <Input
                placeholder="أدخل اسمك الكامل"
                value={newAddress.fullName}
                onChange={(e) => handleAddressChange("fullName", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                رقم الهاتف
              </label>
              <Input
                placeholder="أدخل رقم الهاتف"
                value={newAddress.phone}
                onChange={(e) => handleAddressChange("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                المدينة
              </label>
              <Input
                placeholder="أدخل المدينة"
                value={newAddress.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                العنوان التفصيلي
              </label>
              <Input
                placeholder="أدخل العنوان (الشارع، الحي، إلخ)"
                value={newAddress.address}
                onChange={(e) => handleAddressChange("address", e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={newAddress.isDefault}
                onCheckedChange={(checked) =>
                  handleAddressChange("isDefault", checked as boolean)
                }
              />
              <label htmlFor="isDefault" className="text-sm text-muted-foreground cursor-pointer">
                اجعل هذا العنوان الافتراضي
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={addAddress.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAddAddress}
              disabled={addAddress.isPending}
            >
              {addAddress.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                "إضافة العنوان"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
