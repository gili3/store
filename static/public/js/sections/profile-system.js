// profile-system.js - إدارة الملف الشخصي والمستخدم (نسخة محسنة)

function updateUserProfile() {
    const user = getCurrentUser();
    
    console.log('🔄 updateUserProfile - user:', user ? user.uid : 'لا يوجد');
    
    if (!user) {
        showGuestProfile();
        return;
    }
    
    const userName = user.displayName || user.name || 'مستخدم';
    const userEmail = user.email || 'غير متوفر';
    const userPhone = user.phone || 'غير مضاف';
    const userAddress = user.address || 'غير مضاف';
    
    const elements = [
        { id: 'profileName', text: userName },
        { id: 'mobileUserName', text: userName },
        { id: 'profileEmail', text: userEmail },
        { id: 'mobileUserEmail', text: userEmail },
        { id: 'detailName', text: userName },
        { id: 'detailPhone', text: userPhone },
        { id: 'detailAddress', text: userAddress }
    ];
    
    elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) {
            element.textContent = el.text;
        }
    });
    
    if (user.photoURL) {
        const images = document.querySelectorAll('#profileImage, #mobileUserImage');
        images.forEach(img => {
            if (img) img.src = user.photoURL;
        });
    }
    
    // ✅ تفعيل زر التعديل للمستخدم المسجل
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.textContent = 'تعديل الملف الشخصي';
        editBtn.style.background = '';
        editBtn.style.cursor = 'pointer';
        editBtn.disabled = false;
        editBtn.onclick = function() {
            editProfile();
        };
    }
    
    if (typeof updateProfileStats === 'function') updateProfileStats();
}

/**
 * عرض الملف الشخصي للزائر - رسالة بسيطة فقط
 */
function showGuestProfile() {
    const profileImage = document.getElementById('profileImage');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const detailName = document.getElementById('detailName');
    const detailPhone = document.getElementById('detailPhone');
    const detailAddress = document.getElementById('detailAddress');
    const editBtn = document.getElementById('editProfileBtn');
    
    if (profileImage) profileImage.src = '/public/images/user-placeholder.png';
    if (profileName) profileName.textContent = 'زائر';
    if (profileEmail) profileEmail.textContent = 'لم تقم بتسجيل الدخول';
    if (detailName) detailName.textContent = '---';
    if (detailPhone) detailPhone.textContent = '---';
    if (detailAddress) detailAddress.textContent = '---';
    
    if (editBtn) {
        editBtn.textContent = 'تسجيل الدخول لتعديل الملف الشخصي';
        editBtn.style.background = '#95a5a6';
        editBtn.style.cursor = 'pointer';
        editBtn.disabled = false;
        editBtn.onclick = function() {
            if (typeof showToast === 'function') {
                showToast('يرجى تسجيل الدخول أولاً', 'warning');
            }
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        };
    }
}

// ✅ الدالة المحسنة getCurrentUser
function getCurrentUser() {
    // 1. التحقق من AppState أولاً (المصدر الموثوق)
    if (window.AppState && window.AppState.user) {
        if (!window.AppState.isGuest && window.AppState.user.uid) {
            console.log('✅ getCurrentUser: من AppState', window.AppState.user.uid);
            return window.AppState.user;
        }
    }
    
    // 2. التحقق من auth.currentUser (مصدر Firebase المباشر)
    if (window.auth && window.auth.currentUser) {
        const firebaseUser = window.auth.currentUser;
        console.log('✅ getCurrentUser: من auth.currentUser', firebaseUser.uid);
        
        // مزامنة مع AppState إذا لزم الأمر
        if (window.AppState && (!window.AppState.user || window.AppState.isGuest)) {
            window.AppState.setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                phone: firebaseUser.phone || '',
                address: firebaseUser.address || ''
            }, false);
        }
        return firebaseUser;
    }
    
    // 3. التحقق من firebaseModules (حل احتياطي)
    if (window.firebaseModules && window.firebaseModules.getAuth) {
        const auth = window.firebaseModules.getAuth();
        if (auth && auth.currentUser) {
            const firebaseUser = auth.currentUser;
            console.log('✅ getCurrentUser: من firebaseModules', firebaseUser.uid);
            return firebaseUser;
        }
    }
    
    console.log('⚠️ getCurrentUser: لا يوجد مستخدم مسجل');
    return null;
}

async function updateProfileStats() {
    const favoritesCount = window.AppState?.favorites?.length || 0;
    
    const favoritesCountElement = document.getElementById('favoritesCount');
    if (favoritesCountElement) {
        favoritesCountElement.textContent = favoritesCount;
    }
    
    let ordersCount = 0;
    let totalSpent = 0;
    
    const userId = getCurrentUser()?.uid;
    const db = window.db;
    
    if (db && userId) {
        try {
            const ordersRef = window.firebaseModules.collection(db, "orders");
            const q = window.firebaseModules.query(ordersRef, window.firebaseModules.where("userId", "==", userId));
            const querySnapshot = await window.firebaseModules.getDocs(q);
            
            querySnapshot.forEach((doc) => {
                const order = doc.data();
                ordersCount++;
                if (order.status === 'delivered') {
                    totalSpent += parseFloat(order.total || 0);
                }
            });
        } catch (error) {
            console.error('خطأ في تحميل إحصائيات المستخدم من Firebase:', error);
        }
    }
    
    const ordersCountElement = document.getElementById('ordersCount');
    const totalSpentElement = document.getElementById('totalSpent');
    
    if (ordersCountElement) ordersCountElement.textContent = ordersCount;
    if (totalSpentElement) totalSpentElement.textContent = (typeof window.formatNumber === 'function' ? window.formatNumber(totalSpent) : totalSpent) + ' ' + (window.AppState?.settings?.storeCurrency || 'SDG');
}

async function editProfile() {
    const user = getCurrentUser();
    
    if (!user) {
        if (typeof showToast === 'function') {
            showToast('يجب تسجيل الدخول أولاً لتعديل الملف الشخصي', 'warning');
        }
        return;
    }
    
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    const addressInput = document.getElementById('editAddress');
    
    if (nameInput) nameInput.value = user.displayName || user.name || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (addressInput) addressInput.value = user.address || '';
    
    modal.classList.add('active');
}

async function saveProfileChanges() {
    const user = getCurrentUser();
    
    if (!user) {
        if (typeof showToast === 'function') {
            showToast('يجب تسجيل الدخول أولاً لحفظ التغييرات', 'warning');
        }
        return;
    }
    
    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    const addressInput = document.getElementById('editAddress');
    
    if (!nameInput || !phoneInput || !addressInput) {
        if (typeof showToast === 'function') showToast('حدث خطأ في الوصول للحقول', 'error');
        return;
    }
    
    const name = window.safeHTML ? window.safeHTML(nameInput.value.trim()) : nameInput.value.trim();
    const phone = phoneInput.value.trim().replace(/[^0-9+\-\s]/g, '');
    const address = window.safeHTML ? window.safeHTML(addressInput.value.trim()) : addressInput.value.trim();
    
    if (!name) {
        if (typeof showToast === 'function') showToast('يرجى إدخال الاسم', 'warning');
        return;
    }
    
    if (typeof showLoadingSpinner === 'function') showLoadingSpinner('جاري حفظ التغييرات...');
    
    try {
        const auth = window.auth;
        const db = window.db;
        
        if (auth && auth.currentUser) {
            await window.firebaseModules.updateProfile(auth.currentUser, {
                displayName: name
            });
        }
        
        const userRef = window.firebaseModules.doc(db, "users", user.uid);
        await window.firebaseModules.updateDoc(userRef, {
            displayName: name,
            phone: phone,
            address: address,
            updatedAt: window.firebaseModules.serverTimestamp()
        });
        
        // تحديث AppState
        if (window.AppState && window.AppState.setUser) {
            window.AppState.setUser({
                ...window.AppState.user,
                displayName: name,
                phone: phone,
                address: address
            }, false);
        }
        
        if (typeof updateUserProfile === 'function') updateUserProfile();
        
        const modal = document.getElementById('editProfileModal');
        if (modal) modal.classList.remove('active');
        
        if (typeof showToast === 'function') showToast('تم تحديث الملف الشخصي بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تحديث الملف الشخصي:', error);
        if (typeof showToast === 'function') showToast('حدث خطأ أثناء التحديث', 'error');
    } finally {
        if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
    }
}

// التصدير
window.updateUserProfile = updateUserProfile;
window.updateProfileStats = updateProfileStats;
window.editProfile = editProfile;
window.saveProfileChanges = saveProfileChanges;
window.showGuestProfile = showGuestProfile;

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ profile-system.js loaded');
    const profileSection = document.getElementById('profile');
    if (profileSection && profileSection.classList.contains('active')) {
        setTimeout(() => updateUserProfile(), 100);
    }
});

console.log('✅ profile-system.js loaded successfully');