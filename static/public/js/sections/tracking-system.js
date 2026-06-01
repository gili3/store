/**
 * tracking-system.js - نظام تتبع الطلبات
 */

window.trackOrder = async function() {
    const orderIdInput = document.getElementById('orderIdInput');
    const trackingResult = document.getElementById('trackingResult');
    const orderSummaryDetails = document.getElementById('orderSummaryDetails');
    
    if (!orderIdInput || !orderIdInput.value.trim()) {
        if (typeof showToast === 'function') showToast('يرجى إدخال رقم الطلب', 'warning');
        return;
    }

    const orderId = orderIdInput.value.trim().toUpperCase();
    console.log(`🔍 تتبع الطلب: ${orderId}`);

    try {
        const db = window.firebaseDb || window.db;
        const modules = window.firebaseModules;
        
        if (!db || !modules) {
            throw new Error('Firebase not initialized');
        }

        // البحث عن الطلب برقم الطلب (orderId) أو المعرف التلقائي (docId)
        const ordersRef = modules.collection(db, "orders");
        let q = modules.query(ordersRef, modules.where("orderId", "==", orderId));
        let querySnapshot = await modules.getDocs(q);

        // إذا لم يتم العثور عليه، نحاول البحث بالمعرف التلقائي (أول 8 أحرف)
        if (querySnapshot.empty && orderId.length >= 8) {
             // ملاحظة: البحث بالمعرف التلقائي الكامل هو الأفضل
             const docRef = modules.doc(db, "orders", orderId.toLowerCase());
             const docSnap = await modules.getDoc(docRef);
             if (docSnap.exists()) {
                 displayTrackingInfo(docSnap.data(), docSnap.id);
                 return;
             }
        }

        if (querySnapshot.empty) {
            if (typeof showToast === 'function') showToast('لم يتم العثور على طلب بهذا الرقم', 'error');
            trackingResult.style.display = 'none';
            return;
        }

        const orderDoc = querySnapshot.docs[0];
        displayTrackingInfo(orderDoc.data(), orderDoc.id);

    } catch (error) {
        console.error('❌ خطأ في تتبع الطلب:', error);
        if (typeof showToast === 'function') showToast('حدث خطأ أثناء البحث عن الطلب', 'error');
    }
};

function displayTrackingInfo(orderData, docId) {
    const trackingResult = document.getElementById('trackingResult');
    const orderSummaryDetails = document.getElementById('orderSummaryDetails');
    
    if (!trackingResult || !orderSummaryDetails) return;

    trackingResult.style.display = 'block';
    
    // تحديث شريط الحالة
    const status = orderData.status || 'pending';
    const steps = document.querySelectorAll('.status-step');
    
    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(status === 'paid' ? 'processing' : status);

    steps.forEach((step, index) => {
        const stepStatus = step.getAttribute('data-status');
        step.classList.remove('active', 'completed');
        
        if (index < currentIndex) {
            step.classList.add('completed');
        } else if (index === currentIndex) {
            step.classList.add('active');
        }
    });

    // تنسيق التاريخ
    let dateStr = 'غير محدد';
    if (orderData.createdAt) {
        const date = orderData.createdAt.toDate ? orderData.createdAt.toDate() : new Date(orderData.createdAt);
        dateStr = date.toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';

    // عرض ملخص الطلب
    orderSummaryDetails.innerHTML = `
        <div class="tracking-card" style="background: #f9f9f9; padding: 20px; border-radius: 15px; border-right: 5px solid var(--primary-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <strong>رقم الطلب:</strong>
                <span>${orderData.orderId || docId.substring(0, 8).toUpperCase()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>تاريخ الطلب:</span>
                <span>${dateStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>حالة الطلب:</span>
                <span class="status-badge ${status}">${getStatusText(status)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 1.1em; color: var(--primary-color);">
                <span>إجمالي المبلغ:</span>
                <span>${orderData.total} ${currency}</span>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                <p><strong>العنوان:</strong> ${orderData.address || 'غير محدد'}</p>
            </div>
        </div>
    `;
    
    // التمرير للنتيجة
    trackingResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getStatusText(status) {
    const map = {
        'pending': 'قيد الانتظار',
        'paid': 'تم الدفع',
        'processing': 'قيد التجهيز',
        'shipped': 'تم الشحن',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return map[status] || status;
}
