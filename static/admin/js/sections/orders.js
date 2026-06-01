/**
 * orders.js - قسم إدارة الطلبات (نسخة مصلحة)
 */

let allOrders = [];
let lastOrderDoc = null;
let hasMoreOrders = true;
let isLoadingOrders = false;
const ORDERS_PER_PAGE = 10;
let ordersObserver = null;

// ==================== تحميل الطلبات ====================

async function loadOrders(isNextPage = false) {
    if (!window.checkAdmin()) return;
    if (isLoadingOrders) return;
    
    const searchInput = document.getElementById('ordersSearchInput');
    const statusFilter = document.getElementById('ordersStatusFilter');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const filterStatus = statusFilter ? statusFilter.value : '';

    if (!isNextPage) {
        allOrders = [];
        lastOrderDoc = null;
        hasMoreOrders = true;
        const tbody = document.getElementById('ordersBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">جاري التحميل...</td></tr>';
    }

    if (!hasMoreOrders && isNextPage) return;

    isLoadingOrders = true;
    try {
        const { db, firebaseModules } = window;
        
        if (!db || !firebaseModules) {
            console.error('❌ Firebase not initialized');
            return;
        }

        let constraints = [firebaseModules.collection(db, 'orders')];
        
        if (filterStatus) constraints.push(firebaseModules.where('status', '==', filterStatus));
        
        if (searchTerm) {
            if (searchTerm.startsWith('NO:')) {
                constraints.push(firebaseModules.where('orderId', '==', searchTerm));
            } else if (!isNaN(searchTerm)) {
                constraints.push(firebaseModules.where('orderNumber', '==', Number(searchTerm)));
            } else {
                constraints.push(firebaseModules.where('userName', '>=', searchTerm));
                constraints.push(firebaseModules.where('userName', '<=', searchTerm + '\uf8ff'));
            }
        }

        constraints.push(firebaseModules.orderBy('createdAt', 'desc'));
        if (isNextPage && lastOrderDoc) constraints.push(firebaseModules.startAfter(lastOrderDoc));
        constraints.push(firebaseModules.limit(ORDERS_PER_PAGE));
        
        const q = firebaseModules.query(...constraints);
        const snapshot = await firebaseModules.getDocs(q);
        
        if (snapshot.empty) {
            hasMoreOrders = false;
            if (!isNextPage) displayOrders();
            return;
        }

        lastOrderDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMoreOrders = snapshot.docs.length === ORDERS_PER_PAGE;

        const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrders = isNextPage ? [...allOrders, ...newOrders] : newOrders;
        window.allOrders = allOrders;
        
        displayOrders(isNextPage);
        if (!isNextPage) setupOrdersInfiniteScroll();
        
        console.log(`✅ تم تحميل ${newOrders.length} طلب`);
    } catch (error) {
        console.error('❌ Load Orders Error:', error);
        if (window.adminUtils) window.adminUtils.showToast('فشل تحميل الطلبات', 'error');
        if (typeof ErrorHandler !== 'undefined') ErrorHandler.handle(error, 'loadOrders');
    } finally {
        isLoadingOrders = false;
    }
}

function displayOrders(append = false) {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;
    
    if (allOrders.length === 0 && !append) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">لا توجد طلبات</td></tr>';
        return;
    }

    const html = allOrders.map(order => `
        <tr class="compact-row" onclick="window.viewOrder('${order.id}')" style="cursor: pointer;">
            <td data-label="رقم الطلب">#${adminUtils.escapeHTML(String(order.orderId || order.orderNumber))}</td>
            <td data-label="العميل">${adminUtils.escapeHTML(order.userName || '---')}</td>
            <td data-label="الهاتف">${adminUtils.escapeHTML(order.phone || '---')}</td>
            <td data-label="الإجمالي">${order.total || 0} SDG</td>
            <td data-label="الحالة">
                <span class="badge badge-${adminUtils.getStatusColor(order.status)}">
                    ${adminUtils.getStatusText(order.status)}
                </span>
            </td>
            <td data-label="التاريخ">${adminUtils.formatDate(order.createdAt)}</td>
            <td data-label="الإجراءات" onclick="event.stopPropagation()">
                <div class="action-buttons-compact">
                    <button class="btn btn-sm btn-primary" onclick="window.editOrderStatus('${order.id}')" title="تحديث الحالة">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="window.printInvoice('${order.id}')" title="طباعة">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (append) {
        tbody.insertAdjacentHTML('beforeend', html);
    } else {
        tbody.innerHTML = html;
    }
}

window.viewOrder = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const itemsHtml = (order.items || []).map(item => `
        <tr>
            <td>${adminUtils.escapeHTML(item.name || '---')}</td>
            <td>${item.quantity}</td>
            <td>${item.price} SDG</td>
            <td>${item.quantity * item.price} SDG</td>
        </tr>
    `).join('');
    
    const content = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p><strong>رقم الطلب:</strong> #${adminUtils.escapeHTML(String(order.orderId || order.orderNumber))}</p>
            <p><strong>العميل:</strong> ${adminUtils.escapeHTML(order.userName || '---')}</p>
            <p><strong>الهاتف:</strong> ${adminUtils.escapeHTML(order.phone || '---')}</p>
            <p><strong>العنوان:</strong> ${adminUtils.escapeHTML(order.address || '---')}</p>
            <p><strong>التاريخ:</strong> ${adminUtils.formatDate(order.createdAt)}</p>
            <p><strong>الحالة:</strong> <span class="badge badge-${adminUtils.getStatusColor(order.status)}">${adminUtils.getStatusText(order.status)}</span></p>
            ${order.receiptUrl ? `<p><strong>إيصال الدفع:</strong> <a href="${order.receiptUrl}" target="_blank" class="btn btn-sm btn-info">عرض الإيصال</a></p>` : ''}
        </div>
        <h4>المنتجات:</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 8px; text-align: right;">المنتج</th>
                    <th style="padding: 8px;">الكمية</th>
                    <th style="padding: 8px;">السعر</th>
                    <th style="padding: 8px;">المجموع</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
                <tr style="font-weight: bold; background: #f5f5f5;">
                    <td colspan="3" style="padding: 8px; text-align: left;">الإجمالي:</td>
                    <td style="padding: 8px;">${order.total || 0} SDG</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    ModalManager.open({
        id: 'viewOrderModal',
        title: `تفاصيل الطلب #${adminUtils.escapeHTML(String(order.orderId || order.orderNumber))}`,
        content: content,
        size: 'large',
        buttons: [
            { text: 'تحديث الحالة', class: 'btn-primary', onClick: () => {
                ModalManager.close('viewOrderModal');
                window.editOrderStatus(orderId);
            }},
            { text: 'طباعة', class: 'btn-success', onClick: () => {
                window.printInvoice(orderId);
            }},
            { text: 'إغلاق', class: 'btn-secondary', onClick: () => ModalManager.close('viewOrderModal') }
        ]
    });
};

window.editOrderStatus = async function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const statuses = { 
        'pending': 'قيد الانتظار', 
        'paid': 'تم الدفع',
        'processing': 'جاري التجهيز', 
        'shipped': 'تم الشحن', 
        'delivered': 'تم التوصيل', 
        'cancelled': 'ملغي' 
    };
    
    const options = Object.entries(statuses).map(([k, v]) => 
        `<option value="${k}" ${order.status === k ? 'selected' : ''}>${v}</option>`
    ).join('');

    ModalManager.open({
        id: 'statusModal',
        title: 'تحديث حالة الطلب',
        content: `
            <div class="form-group">
                <label>الحالة الجديدة:</label>
                <select id="newOrderStatus" class="form-control">${options}</select>
            </div>
        `,
        buttons: [
            { 
                text: 'حفظ', 
                class: 'btn-primary', 
                onClick: async () => {
                    const newStatus = document.getElementById('newOrderStatus').value;
                    if (newStatus === order.status) { 
                        ModalManager.close('statusModal'); 
                        return; 
                    }

                    try {
                        // استخدام API Client لتحديث الحالة عبر السيرفر لضمان استخدام Transactions
                        const response = await window.apiClient.updateOrderStatus(orderId, newStatus);
                        
                        if (response.success) {
                            window.adminUtils.showToast('✅ تم تحديث الحالة بنجاح', 'success');
                            order.status = newStatus;
                            displayOrders(false);
                            ModalManager.close('statusModal');
                        } else {
                            throw new Error(response.error || 'فشل تحديث الحالة');
                        }
                        
                    } catch (error) {
                        console.error('❌ خطأ في تحديث الحالة:', error);
                        window.adminUtils.showToast(error.message || 'فشل تحديث الحالة', 'error');
                    }
                }
            },
            { text: 'إلغاء', class: 'btn-secondary', onClick: () => ModalManager.close('statusModal') }
        ]
    });
};

// وظائف التمرير اللانهائي
function setupOrdersInfiniteScroll() {
    const tableContainer = document.querySelector('.admin-table-container');
    if (!tableContainer) return;
    
    tableContainer.onscroll = function() {
        if (tableContainer.scrollTop + tableContainer.clientHeight >= tableContainer.scrollHeight - 100) {
            if (hasMoreOrders && !isLoadingOrders) {
                loadOrders(true);
            }
        }
    };
}
