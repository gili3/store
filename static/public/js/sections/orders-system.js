// orders-system.js - إدارة طلبات المستخدم مع التحميل اللانهائي (نسخة محسنة - بدون رسالة نهاية)

let lastOrderDoc = null;
let hasMoreOrders = true;
const ORDERS_PER_PAGE = 5;
let isOrdersLoading = false;
let ordersObserver = null;

function resetOrdersState() {
    console.log('📦 Resetting orders state from orders-system');
    lastOrderDoc = null;
    hasMoreOrders = true;
    isOrdersLoading = false;
}

window.renderOrderStages = function(status) {
    const stages = [
        { key: 'pending', label: 'قيد الانتظار', icon: 'fa-clock' },
        { key: 'paid', label: 'تم الدفع', icon: 'fa-check-double' },
        { key: 'processing', label: 'جاري التجهيز', icon: 'fa-box-open' },
        { key: 'shipped', label: 'خرج للتوصيل', icon: 'fa-truck' },
        { key: 'delivered', label: 'تم التسليم', icon: 'fa-home' }
    ];

    const statusColors = {
        'pending': '#000000',
        'paid': '#27ae60',
        'processing': '#e67e22',
        'shipped': '#f1c40f',
        'delivered': '#3498db',
        'cancelled': '#e74c3c'
    };

    if (status === 'cancelled') {
        return `
            <div style="margin: 20px 0; padding: 15px; background: #fff5f5; border-radius: 10px; text-align: center; border-right: 4px solid #e74c3c;">
                <i class="fas fa-times-circle" style="color: #e74c3c; font-size: 20px; margin-left: 8px;"></i>
                <span style="color: #e74c3c; font-weight: 600;">تم إلغاء هذا الطلب</span>
            </div>
        `;
    }

    const activeIndex = stages.findIndex(s => s.key === status);
    if (activeIndex === -1) return '';

    return `
        <div style="margin: 20px 0; padding: 15px 5px; background: #f8f9fa; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; position: relative;">
                <div style="position: absolute; top: 18px; left: 15%; right: 15%; height: 2px; background: #e0e0e0; z-index: 1;">
                    <div style="
                        height: 100%; 
                        width: ${(activeIndex / (stages.length - 1)) * 100}%; 
                        background: #27ae60;
                        transition: width 0.5s ease;
                    "></div>
                </div>
                
                ${stages.map((stage, index) => {
                    const isActive = index <= activeIndex;
                    const isCurrent = index === activeIndex;
                    
                    return `
                        <div style="flex: 1; text-align: center; position: relative; z-index: 2;">
                            <div style="
                                width: 36px; 
                                height: 36px; 
                                background: ${isCurrent ? statusColors[status] : (isActive ? '#9e9e9e' : '#e0e0e0')}; 
                                border-radius: 50%; 
                                margin: 0 auto 8px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-size: 16px;
                                box-shadow: ${isCurrent ? `0 0 0 3px ${statusColors[status]}33` : 'none'};
                                transition: all 0.3s ease;
                            ">
                                <i class="fas ${stage.icon}"></i>
                            </div>
                            <div style="
                                font-size: 12px; 
                                font-weight: ${isActive ? '600' : '400'}; 
                                color: ${isCurrent ? statusColors[status] : (isActive ? '#666' : '#999')};
                                white-space: nowrap;
                            ">${stage.label}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

function setupOrdersInfiniteScroll() {
    const ordersList = document.getElementById('myOrdersList');
    if (!ordersList) return;

    const oldSentinel = document.getElementById('ordersScrollSentinel');
    if (oldSentinel) {
        oldSentinel.remove();
    }

    const sentinel = document.createElement('div');
    sentinel.id = 'ordersScrollSentinel';
    sentinel.style.height = '20px';
    sentinel.style.width = '100%';
    sentinel.style.marginTop = '10px';
    sentinel.style.marginBottom = '10px';
    sentinel.style.background = 'transparent';
    sentinel.style.pointerEvents = 'none';
    
    ordersList.parentNode?.appendChild(sentinel);

    if (ordersObserver) {
        ordersObserver.disconnect();
    }

    ordersObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && hasMoreOrders && !isOrdersLoading) {
                console.log('📦 [Observer] تحميل المزيد من الطلبات');
                loadMyOrders(true);
            }
        });
    }, {
        root: null,
        rootMargin: '300px',
        threshold: 0.01
    });

    ordersObserver.observe(sentinel);
    console.log('✅ Infinite scroll initialized for orders');
}

function getCurrentUser() {
    if (window.AppState && window.AppState.user && !window.AppState.isGuest) {
        return window.AppState.user;
    }
    
    if (window.auth && window.auth.currentUser) {
        return window.auth.currentUser;
    }
    
    if (window.firebaseModules && window.firebaseModules.getAuth) {
        const firebaseUser = window.firebaseModules.getAuth().currentUser;
        if (firebaseUser) {
            return firebaseUser;
        }
    }
    
    return null;
}

async function loadMyOrders(isNextPage = false) {
    console.log('📦 Loading orders, next page:', isNextPage);
    
    const ordersList = document.getElementById('myOrdersList');
    const emptyMessage = document.getElementById('emptyOrdersMessage');
    
    if (!ordersList) {
        console.error('❌ ordersList element not found');
        return;
    }
    
    const user = getCurrentUser();
                 
    if (!user) {
        console.log('👤 No user logged in - showing simple login required message');
        ordersList.innerHTML = `
            <div style="text-align: center; padding: 60px 30px; background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                <div style="font-size: 70px; margin-bottom: 20px; opacity: 0.8;">
                    🔒
                </div>
                <h3 style="color: var(--primary-color, #2c3e50); margin-bottom: 12px; font-size: 20px;">
                    يجب تسجيل الدخول لعرض الطلبات
                </h3>
                <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
                    يرجى تسجيل الدخول للاطلاع على طلباتك السابقة ومتابعة حالتها
                </p>
            </div>
        `;
        if (emptyMessage) emptyMessage.style.display = 'none';
        return;
    }

    if (isOrdersLoading) {
        console.log('⏳ Already loading orders');
        return;
    }
    
    if (isNextPage && !hasMoreOrders) {
        console.log('📭 No more orders to load');
        return;
    }

    isOrdersLoading = true;
    
    if (!isNextPage) {
        ordersList.innerHTML = `
            <div style="text-align:center; padding:40px; background: white; border-radius: 15px;">
                <div class="modern-loader" style="margin: 0 auto; width: 40px; height: 40px;"></div>
                <p style="margin-top:15px; color:#888;">جاري تحميل طلباتك...</p>
            </div>
        `;
        lastOrderDoc = null;
        hasMoreOrders = true;
        if (window.allOrdersArray) window.allOrdersArray = [];
        
        const oldSentinel = document.getElementById('ordersScrollSentinel');
        if (oldSentinel) oldSentinel.remove();
    }

    if (isNextPage) {
        const loader = document.getElementById('ordersLoader');
        if (loader) loader.style.display = 'block';
    }

    try {
        const db = window.firebaseDb || window.db;
        if (!db || !window.firebaseModules) {
            throw new Error('Firebase not initialized');
        }

        const ordersRef = window.firebaseModules.collection(db, "orders");
        let constraints = [];
        
        const userId = user.uid || user.id;
        if (!userId) {
            throw new Error('User ID not found');
        }
        
        constraints.push(window.firebaseModules.where("userId", "==", userId));
        constraints.push(window.firebaseModules.orderBy("createdAt", "desc"));

        if (isNextPage && lastOrderDoc) {
            constraints.push(window.firebaseModules.startAfter(lastOrderDoc));
        }
        
        constraints.push(window.firebaseModules.limit(ORDERS_PER_PAGE));

        const q = window.firebaseModules.query(ordersRef, ...constraints);
        const querySnapshot = await window.firebaseModules.getDocs(q);

        console.log(`📦 Found ${querySnapshot.size} orders`);

        if (querySnapshot.empty) {
            hasMoreOrders = false;
            if (!isNextPage) {
                ordersList.innerHTML = '';
                if (emptyMessage) emptyMessage.style.display = 'block';
            }
            
            const loader = document.getElementById('ordersLoader');
            if (loader) loader.style.display = 'none';
            
            isOrdersLoading = false;
            return;
        }

        if (emptyMessage) emptyMessage.style.display = 'none';

        lastOrderDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        hasMoreOrders = querySnapshot.docs.length === ORDERS_PER_PAGE;

        const newOrders = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
            };
        });
        
        if (!window.allOrdersArray) window.allOrdersArray = [];
        window.allOrdersArray = [...window.allOrdersArray, ...newOrders];
        
        renderOrdersList(newOrders, isNextPage);
        
        if (!isNextPage) {
            setTimeout(() => {
                setupOrdersInfiniteScroll();
            }, 100);
        }

    } catch (error) {
        console.error('❌ Error loading orders:', error);
        if (!isNextPage) {
            ordersList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 15px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 20px;"></i>
                    <h3>حدث خطأ أثناء تحميل الطلبات</h3>
                    <p style="color: #666; margin: 10px 0;">يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى</p>
                    <button onclick="loadMyOrders(false)" class="btn-primary" style="margin-top:15px; background:#e74c3c; border:none; padding:10px 30px; border-radius:8px; color:white; cursor:pointer;">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    } finally {
        isOrdersLoading = false;
        
        const loader = document.getElementById('ordersLoader');
        if (loader) loader.style.display = 'none';
    }
}

function renderOrdersList(ordersToRender, append = false) {
    const ordersList = document.getElementById('myOrdersList');
    if (!ordersList) return;

    console.log(`📦 Rendering ${ordersToRender.length} orders, append: ${append}`);

    const statusColors = {
        'pending': '#000000',
        'paid': '#27ae60',
        'processing': '#e67e22',
        'shipped': '#f1c40f',
        'delivered': '#3498db',
        'cancelled': '#e74c3c'
    };

    const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
    
    const formatNumber = window.formatNumber || function(num) {
        return num.toLocaleString('ar-EG');
    };
    
    const ordersHTML = ordersToRender.map(order => {
        const safeOrderId = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.orderId || order.id.substring(0, 8)) : 
            (order.orderId || order.id.substring(0, 8)));
            
        const safeAddress = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.address || 'غير محدد') : 
            (order.address || 'غير محدد'));
            
        const safePhone = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.phone || '') : 
            (order.phone || ''));
            
        const safeUserName = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.userName || '') : 
            (order.userName || ''));

        let dateStr = 'تاريخ غير محدد';
        try {
            if (order.createdAt) {
                dateStr = order.createdAt.toLocaleDateString('ar-EG', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
        } catch (e) {
            console.warn('Date formatting error:', e);
        }
        
        const statusMap = {
            'pending': { text: 'قيد الانتظار', icon: 'fa-clock' },
            'paid': { text: 'تم الدفع', icon: 'fa-check-double' },
            'processing': { text: 'جاري التجهيز', icon: 'fa-box-open' },
            'shipped': { text: 'خرج للتوصيل', icon: 'fa-truck' },
            'delivered': { text: 'تم التسليم', icon: 'fa-home' },
            'cancelled': { text: 'ملغي', icon: 'fa-times-circle' }
        };
        
        const status = statusMap[order.status] || statusMap['pending'];
        const isCancelled = order.status === 'cancelled';

        return `
            <div class="order-card ${isCancelled ? 'cancelled-order' : ''}" style="background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eee;">
                <div class="order-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 1px solid #f5f5f5; padding-bottom: 10px;">
                    <div>
                        <div style="font-weight: 700; color: var(--primary-color); font-size: 16px;">
                            <i class="fas fa-receipt" style="margin-left: 5px;"></i>
                            طلب #${safeOrderId}
                        </div>
                        <div style="font-size: 12px; color: #888; margin-top: 4px;">
                            <i class="far fa-calendar-alt"></i> ${dateStr}
                        </div>
                    </div>
                    <span class="order-status-badge" style="padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${isCancelled ? '#fee' : '#fff3e0'}; color: ${statusColors[order.status] || '#f39c12'}; border: 1px solid ${statusColors[order.status]}40;">
                        <i class="fas ${status.icon}"></i> ${status.text}
                    </span>
                </div>

                ${window.renderOrderStages(order.status)}

                <div class="order-body" style="margin-bottom: 15px;">
                    <div style="font-size: 14px; color: #555; margin-bottom: 10px;">
                        ${safeAddress ? `
                        <div style="margin-bottom: 5px;">
                            <strong><i class="fas fa-map-marker-alt" style="color: #e74c3c;"></i> العنوان:</strong> 
                            ${safeAddress}
                        </div>
                        ` : ''}
                        ${safePhone ? `
                        <div style="margin-bottom: 5px;">
                            <strong><i class="fas fa-phone" style="color: #27ae60;"></i> الهاتف:</strong> 
                            ${safePhone}
                        </div>
                        ` : ''}
                        <div style="margin-bottom: 5px;">
                            <strong><i class="fas fa-box" style="color: #3498db;"></i> المنتجات:</strong> 
                            ${(order.items || []).length} منتجات
                        </div>
                    </div>
                    
                    <div class="order-items-mini" style="background: #f9f9f9; border-radius: 10px; padding: 10px;">
                        ${(order.items || []).slice(0, 3).map(item => {
                            const safeItemName = (window.SecurityCore?.sanitizeHTML ? 
                                window.SecurityCore.sanitizeHTML(item.name) : 
                                item.name);
                            return `
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #eee;">
                                <span>${safeItemName} × ${item.quantity}</span>
                                <span style="font-weight:600;">${formatNumber(item.price * item.quantity)} ${currency}</span>
                            </div>
                        `}).join('')}
                        ${(order.items || []).length > 3 ? `
                            <div style="font-size: 12px; color: #888; text-align: center; margin-top: 5px;">
                                + ${(order.items || []).length - 3} منتجات أخرى
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="order-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f5f5f5; padding-top: 15px; gap: 10px;">
                    <div style="font-weight: 800; font-size: 18px; color: var(--secondary-color);">
                        ${formatNumber(order.total || 0)} ${currency}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="viewOrderReceipt('${order.id}')" class="btn-receipt" style="padding: 8px 16px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #555;">
                            <i class="fas fa-file-invoice"></i> عرض الفاتورة
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (append) {
        const oldLoader = document.getElementById('ordersLoader');
        if (oldLoader) oldLoader.remove();
        
        ordersList.insertAdjacentHTML('beforeend', ordersHTML);
    } else {
        ordersList.innerHTML = ordersHTML;
    }

    // ❌ تم إزالة رسالة "لقد وصلت إلى نهاية طلباتك" تماماً
    
    if (hasMoreOrders) {
        const oldLoader = document.getElementById('ordersLoader');
        if (oldLoader) oldLoader.remove();
        
        const loaderHTML = `
            <div id="ordersLoader" style="text-align: center; padding: 20px; color: #888;">
                <div class="modern-loader" style="width: 24px; height: 24px; border-width: 2px; display: inline-block; vertical-align: middle; margin-left: 10px;"></div>
                جاري تحميل المزيد...
            </div>
        `;
        ordersList.insertAdjacentHTML('beforeend', loaderHTML);
    }
}

async function viewOrderReceipt(orderId) {
    try {
        const db = window.firebaseDb || window.db;
        if (!db) {
            alert('خطأ في الاتصال بقاعدة البيانات');
            return;
        }

        const orderDoc = await window.firebaseModules.getDoc(
            window.firebaseModules.doc(db, 'orders', orderId)
        );

        if (!orderDoc.exists()) {
            alert('الطلب غير موجود');
            return;
        }

        const order = { id: orderDoc.id, ...orderDoc.data() };
        const currency = (window.AppState && window.AppState.settings && window.AppState.settings.storeCurrency) || 'SDG';
        const formatNumber = window.formatNumber || function(num) {
            return num.toLocaleString('ar-EG');
        };

        let dateStr = 'غير محدد';
        try {
            if (order.createdAt) {
                const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                dateStr = date.toLocaleDateString('ar-EG', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
        } catch (e) {
            console.warn('Date formatting error:', e);
        }

        const statusMap = {
            'pending': 'قيد الانتظار',
            'paid': 'تم الدفع',
            'processing': 'جاري التجهيز',
            'shipped': 'خرج للتوصيل',
            'delivered': 'تم التسليم',
            'cancelled': 'ملغي'
        };

        const safeOrderId = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.orderId || order.id.substring(0, 8)) : 
            (order.orderId || order.id.substring(0, 8)));
            
        const safeUserName = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.userName || 'غير محدد') : 
            (order.userName || 'غير محدد'));
            
        const safeUserEmail = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.userEmail || '') : 
            (order.userEmail || ''));
            
        const safePhone = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.phone || '') : 
            (order.phone || ''));
            
        const safeAddress = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.address || '') : 
            (order.address || ''));
            
        const safeNotes = (window.SecurityCore?.sanitizeHTML ? 
            window.SecurityCore.sanitizeHTML(order.notes || '') : 
            (order.notes || ''));

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'receiptModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div class="modal-content" style="background: white; border-radius: 20px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
                <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 15px; left: 15px; background: #e74c3c; color: white; border: none; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; font-size: 18px; z-index: 1;">&times;</button>
                
                <div id="receiptContent" style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid var(--secondary-color); padding-bottom: 20px;">
                        <h1 style="font-size: 28px; color: var(--primary-color); margin-bottom: 10px;">
                            <i class="fas fa-receipt"></i> فاتورة شراء
                        </h1>
                        <div style="font-size: 16px; color: #666;">${(window.AppState && window.AppState.settings && window.AppState.settings.storeName) || 'Eleven Store'}</div>
                        <div style="font-size: 14px; color: #888; margin-top: 5px;">${dateStr}</div>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 5px;">رقم الطلب</div>
                                <div style="font-weight: 700; color: var(--primary-color);">#${safeOrderId}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 5px;">الحالة</div>
                                <div style="font-weight: 700; color: var(--secondary-color);">${statusMap[order.status] || 'غير محدد'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; color: var(--primary-color); margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            <i class="fas fa-user"></i> معلومات العميل
                        </h3>
                        <div style="font-size: 14px; line-height: 1.8;">
                            <div><strong>الاسم:</strong> ${safeUserName}</div>
                            ${safeUserEmail ? `<div><strong>البريد :</strong> ${safeUserEmail}</div>` : ''}
                            ${safePhone ? `<div><strong>الهاتف :</strong> ${safePhone}</div>` : ''}
                            ${safeAddress ? `<div><strong>العنوان :</strong> ${safeAddress}</div>` : ''}
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; color: var(--primary-color); margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            <i class="fas fa-box"></i> المنتجات
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">المنتج</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">الكمية</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">السعر</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">المجموع</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(order.items || []).map(item => {
                                    const safeItemName = (window.SecurityCore?.sanitizeHTML ? 
                                        window.SecurityCore.sanitizeHTML(item.name) : 
                                        item.name);
                                    return `
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 12px;">${safeItemName}</td>
                                        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
                                        <td style="padding: 12px; text-align: left;">${formatNumber(item.price)} ${currency}</td>
                                        <td style="padding: 12px; text-align: left; font-weight: 600;">${formatNumber(item.price * item.quantity)} ${currency}</td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                            <span>اجمالي الطلبية :</span>
                            <span>${formatNumber(order.subtotal || (order.total - (order.shippingCost || 0)))} ${currency}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #ddd; font-size: 14px;">
                            <span>التوصيل :</span>
                            <span>${formatNumber(order.shippingCost || 0)} ${currency}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 800; color: var(--secondary-color);">
                            <span>الإجمالي :</span>
                            <span>${formatNumber(order.total || 0)} ${currency}</span>
                        </div>
                    </div>

                    <div style="text-align: center; padding: 15px; background: #fff3e0; border-radius: 8px; margin-bottom: 20px;">
    <div style="font-size: 14px; color: #666;">
        <i class="fas fa-university"></i> طريقة الدفع : تحويل بنكك (بنك الخرطوم)
    </div>
</div>

                    ${safeNotes ? `
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-size: 12px; color: #888; margin-bottom: 5px;">ملاحظات:</div>
                        <div style="font-size: 14px;">${safeNotes}</div>
                    </div>
                    ` : ''}

                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #888; font-size: 12px;">
                        <p>شكراً لتسوقك معنا في ${(window.AppState && window.AppState.settings && window.AppState.settings.storeName) || 'Eleven Store'}</p>
                        <p style="margin-top: 5px;">للاستفسارات: ${window.storeEmail || 'yxr249@gmail.com'}</p>
                    </div>
                </div>

                <div style="padding: 20px 30px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="window.print()" style="padding: 12px 24px; background: #f8f9fa; color: #555; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-print"></i> طباعة
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Error viewing receipt:', error);
        alert('حدث خطأ أثناء عرض الفاتورة');
    }
}

function showOrdersSection() {
    console.log('📦 Showing orders section');
    resetOrdersState();
    loadMyOrders(false);
}

function checkAndLoadOrders() {
    console.log('📦 Checking if orders section is active...');
    const ordersSection = document.getElementById('my-orders');
    if (ordersSection && ordersSection.classList.contains('active')) {
        console.log('📦 Orders section is active, loading orders...');
        showOrdersSection();
    }
}

async function trackOrder() {
    const orderIdInput = document.getElementById('orderIdInput');
    const trackingResult = document.getElementById('trackingResult');
    
    if (!orderIdInput || !trackingResult) return;
    
    const orderId = orderIdInput.value.trim();
    
    if (!orderId) {
        if (typeof showToast === 'function') showToast('يرجى إدخال رقم الطلب', 'warning');
        return;
    }
    
    trackingResult.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div class="modern-loader" style="margin: 0 auto; width: 30px; height: 30px;"></div>
            <p style="margin-top:10px; color:#888;">جاري البحث عن الطلب...</p>
        </div>
    `;
    trackingResult.style.display = 'block';
    
    try {
        const db = window.firebaseDb || window.db;
        if (!db || !window.firebaseModules) throw new Error('Firebase not initialized');
        
        const orderDoc = await window.firebaseModules.getDoc(window.firebaseModules.doc(db, "orders", orderId));
        
        if (!orderDoc.exists()) {
            trackingResult.innerHTML = `
                <div style="text-align:center; padding:20px; background:#fff5f5; border-radius:10px; border:1px solid #feb2b2;">
                    <i class="fas fa-search fa-2x" style="color:#e53e3e; margin-bottom:10px;"></i>
                    <p style="color:#c53030; font-weight:600;">عذراً، لم يتم العثور على طلب بهذا الرقم</p>
                    <p style="font-size:12px; color:#718096; margin-top:5px;">تأكد من كتابة الرقم بشكل صحيح</p>
                </div>
            `;
            return;
        }
        
        const orderData = orderDoc.data();
        const status = orderData.status || 'pending';
        
        trackingResult.innerHTML = `
            <div style="background:white; border-radius:15px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.05); border:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                    <span style="font-weight:700; color:var(--primary-color);">طلب #${orderId.substring(0, 8)}...</span>
                    <span style="font-size:12px; color:#888;">${orderData.createdAt?.toDate ? orderData.createdAt.toDate().toLocaleDateString('ar-SA') : ''}</span>
                </div>
                
                ${window.renderOrderStages(status)}
                
                <div style="margin-top:15px; padding:15px; background:#f9f9f9; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="color:#666;">إجمالي الطلب:</span>
                        <span style="font-weight:700; color:var(--secondary-color);">${orderData.total} ${orderData.currency || 'SDG'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#666;">عدد المنتجات:</span>
                        <span style="font-weight:700;">${orderData.items?.length || 0}</span>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error tracking order:', error);
        trackingResult.innerHTML = `
            <div style="text-align:center; padding:20px; background:#fff5f5; border-radius:10px;">
                <p style="color:#e53e3e;">حدث خطأ أثناء البحث عن الطلب. يرجى المحاولة لاحقاً.</p>
            </div>
        `;
    }
}

// تصدير الدوال
window.resetOrdersState = resetOrdersState;
window.loadMyOrders = loadMyOrders;
window.setupOrdersInfiniteScroll = setupOrdersInfiniteScroll;
window.renderOrdersList = renderOrdersList;
window.viewOrderReceipt = viewOrderReceipt;
window.showOrdersSection = showOrdersSection;
window.checkAndLoadOrders = checkAndLoadOrders;
window.renderOrderStages = window.renderOrderStages;
window.getCurrentUser = getCurrentUser;
window.trackOrder = trackOrder;

document.addEventListener('sectionChanged', function(e) {
    if (e.detail && e.detail.section === 'my-orders') {
        console.log('📦 Section changed to my-orders via event');
        showOrdersSection();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ orders-system.js loaded');
    setTimeout(checkAndLoadOrders, 1000);
});

if (window.firebaseModules && window.firebaseModules.onAuthStateChanged) {
    const auth = window.auth || 
                 (window.firebaseModules.getAuth ? window.firebaseModules.getAuth() : null) ||
                 (window.firebaseModules.auth ? window.firebaseModules.auth() : null);
                 
    if (auth) {
        window.firebaseModules.onAuthStateChanged(auth, function(user) {
            console.log('📦 Auth state changed in orders-system');
            setTimeout(checkAndLoadOrders, 500);
        });
    }
}

console.log('✅ orders-system.js loaded successfully');