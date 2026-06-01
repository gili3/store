// checkout-system.js - نظام الدفع والإيصالات
// تم التحديث ليتوافق مع API الخلفية ويضمن سلامة البيانات

const FileValidator = {
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024,
    validateImageFile: function(file) {
        if (!file) return { valid: false, error: 'لم يتم اختيار ملف' };
        if (!this.allowedImageTypes.includes(file.type.toLowerCase())) return { valid: false, error: 'نوع الملف غير مدعوم' };
        if (file.size > this.maxFileSize) return { valid: false, error: 'حجم الملف كبير جداً (الحد الأقصى 5MB)' };
        return { valid: true };
    }
};

// دالة تعقيم آمنة
function safeSanitize(str) {
    if (!str) return '';
    if (window.SecurityCore && typeof window.SecurityCore.sanitizeHTML === 'function') {
        return window.SecurityCore.sanitizeHTML(String(str));
    }
    return String(str)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '');
}

let checkoutReceiptFile = null;

window.previewCheckoutReceipt = function(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const validation = FileValidator.validateImageFile(file);
    if (!validation.valid) {
        if (window.showToast) window.showToast(validation.error, 'error');
        input.value = '';
        return;
    }
    checkoutReceiptFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('checkoutReceiptImg');
        if (previewImg) previewImg.src = e.target.result;
        const placeholder = document.getElementById('checkoutUploadPlaceholder');
        const preview = document.getElementById('checkoutReceiptPreview');
        const label = document.getElementById('receiptUploadLabel');
        if (placeholder) placeholder.style.display = 'none';
        if (preview) preview.style.display = 'block';
        if (label) label.style.display = 'none';
        updateCheckoutSummary();
    };
    reader.readAsDataURL(file);
};

window.removeCheckoutReceipt = function() {
    checkoutReceiptFile = null;
    const receiptInput = document.getElementById('checkoutReceipt');
    if (receiptInput) receiptInput.value = '';
    const placeholder = document.getElementById('checkoutUploadPlaceholder');
    const preview = document.getElementById('checkoutReceiptPreview');
    const label = document.getElementById('receiptUploadLabel');
    if (placeholder) placeholder.style.display = 'block';
    if (preview) preview.style.display = 'none';
    if (label) label.style.display = 'block';
    updateCheckoutSummary();
};

// ======================== تحديث ملخص الدفع ========================
window.updateCheckoutSummary = async function() {
    const checkoutItems = document.getElementById("checkoutItems");
    if (!checkoutItems) return;
    
    const itemsToDisplay = window.directPurchaseItem ? [window.directPurchaseItem] : (window.AppState ? window.AppState.cart : []);
    
    try {
        // استخدام API Client لحساب التكلفة بدقة من السيرفر
        const calculation = await window.apiClient.calculateOrder(itemsToDisplay.map(item => ({ id: item.id, quantity: item.quantity })));
        
        const subtotal = calculation.subtotal;
        const shippingCost = calculation.shippingCost;
        const total = calculation.total;
        const currency = window.AppState?.settings?.storeCurrency || 'SDG';

        // عرض المنتجات
        checkoutItems.innerHTML = itemsToDisplay.map(item => `
            <div class="checkout-item">
                <img src="${safeSanitize(item.image)}" class="checkout-item-img" alt="${safeSanitize(item.name)}" onerror="this.src='/public/images/logo.png'">
                <div class="checkout-item-info">
                    <span class="checkout-item-name">${safeSanitize(item.name)}</span>
                    <span class="checkout-item-price">${formatNumber(item.price)} ${currency}</span>
                </div>
                <div class="checkout-item-qty-controls">
                    <button class="checkout-item-qty-btn" onclick="updateCheckoutItemQty('${safeSanitize(item.id)}', -1)" type="button">-</button>
                    <span class="checkout-item-qty-val">${item.quantity}</span>
                    <button class="checkout-item-qty-btn" onclick="updateCheckoutItemQty('${safeSanitize(item.id)}', 1)" type="button">+</button>
                </div>
            </div>
        `).join("");
        
        const subtotalEl = document.getElementById('checkoutSubtotal');
        const shippingEl = document.getElementById('checkoutShipping');
        const totalEl = document.getElementById('checkoutTotal');
        
        if (subtotalEl) subtotalEl.textContent = formatNumber(subtotal) + ' ' + currency;
        if (shippingEl) shippingEl.textContent = shippingCost === 0 ? 'مجاني' : formatNumber(shippingCost) + ' ' + currency;
        if (totalEl) totalEl.textContent = formatNumber(total) + ' ' + currency;
        
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.disabled = itemsToDisplay.length === 0 || !checkoutReceiptFile;
        }

        // تحديث بيانات البنك من الإعدادات في AppState
        const settings = window.AppState?.settings || {};
        const bankNameEl = document.getElementById('checkoutBankName');
        const bankAccountEl = document.getElementById('checkoutBankAccount');
        const bankAccountNameEl = document.getElementById('checkoutBankAccountName');
        
        if (bankNameEl) bankNameEl.textContent = settings.bankName || 'لم يتم تعيين';
        if (bankAccountEl) bankAccountEl.textContent = settings.bankAccount || 'لم يتم تعيين';
        if (bankAccountNameEl) bankAccountNameEl.textContent = settings.bankAccountName || settings.storeName || 'لم يتم تعيين';

    } catch (error) {
        console.error('❌ خطأ في تحديث الملخص:', error);
    }
};

window.updateCheckoutItemQty = function(productId, change) {
    if (window.directPurchaseItem && window.directPurchaseItem.id === productId) {
        const newQty = (window.directPurchaseItem.quantity || 1) + change;
        if (newQty >= 1) window.directPurchaseItem.quantity = newQty;
    } else if (window.AppState) {
        window.AppState.updateCartItemQuantity(productId, change);
    }
    updateCheckoutSummary();
};

// ======================== إرسال الطلب ========================
window.submitCheckoutOrder = async function() {
    const phone = safeSanitize(document.getElementById('checkoutPhone')?.value.trim());
    const address = safeSanitize(document.getElementById('checkoutAddress')?.value.trim());
    const notes = safeSanitize(document.getElementById('checkoutNotes')?.value.trim());

    if (!phone || !address) {
        if (window.showToast) window.showToast('يرجى إكمال البيانات المطلوبة', 'warning');
        return;
    }

    if (!checkoutReceiptFile) {
        if (window.showToast) window.showToast('يرجى رفع صورة الإيصال', 'warning');
        return;
    }

    const itemsToOrder = window.directPurchaseItem ? [window.directPurchaseItem] : (window.AppState ? window.AppState.cart : []);
    if (itemsToOrder.length === 0) return;

    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الطلب...';
    }

    try {
        // 1. حساب التكلفة النهائية من السيرفر قبل الإرسال
        const calculation = await window.apiClient.calculateOrder(itemsToOrder.map(item => ({ id: item.id, quantity: item.quantity })));

        const orderData = {
            userId: window.AppState?.user?.uid || 'guest_' + Date.now(),
            userName: window.AppState?.user?.displayName || 'عميل',
            items: itemsToOrder.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image
            })),
            subtotal: calculation.subtotal,
            shippingCost: calculation.shippingCost,
            total: calculation.total,
            phone,
            address,
            notes,
            paymentMethod: 'bank_transfer'
        };

        // 2. إنشاء الطلب أولاً في قاعدة البيانات (السيرفر يحسب الأسعار ويتحقق من المخزون)
        const response = await window.apiClient.createOrder(orderData);
        
        if (response.success) {
            const orderId = response.orderId;
            
            // 3. رفع ملف الإيصال إلى التخزين (لا يزال يتم من الكلاينت، ولكن التحديث للسيرفر)
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الإيصال...';
            
            const receiptUrl = await uploadCheckoutReceipt(checkoutReceiptFile, orderId);
            
            // 4. تحديث الطلب برابط الإيصال عبر السيرفر حصراً (لا يتم تحديث Firestore من الكلاينت مباشرة)
            await window.apiClient.uploadReceipt(orderId, receiptUrl);

            if (window.showToast) window.showToast('تم إرسال الطلب بنجاح!', 'success');
            if (window.AppState) window.AppState.clearCart();
            window.directPurchaseItem = null;
            
            setTimeout(() => {
                if (window.showSection) window.showSection('my-orders');
                window.removeCheckoutReceipt();
            }, 1500);
        }

    } catch (error) {
        console.error('Order Error:', error);
        if (window.showToast) window.showToast(error.message || 'حدث خطأ في إرسال الطلب', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> تأكيد الطلب';
        }
    }
};

// دالة رفع الإيصال المحسنة
async function uploadCheckoutReceipt(file, orderId) {
    const storage = window.storage;
    const modules = window.firebaseModules;
    
    if (!storage || !modules) throw new Error('خدمة التخزين غير متاحة');

    const fileExt = file.name.split('.').pop();
    const fileName = `receipts/${orderId}_${Date.now()}.${fileExt}`;
    const storageRef = modules.ref(storage, fileName);
    
    await modules.uploadBytes(storageRef, file);
    return await modules.getDownloadURL(storageRef);
}
