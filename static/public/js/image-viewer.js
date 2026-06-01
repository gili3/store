// image-viewer.js - نظام معاينة الصور المحسّن
// ======================== معاينة الصور ========================

// إنشاء modal لمعاينة الصور
function createImageViewerModal() {
    const existingModal = document.getElementById('imageViewerModal');
    if (existingModal) return;
    
    const modal = document.createElement('div');
    modal.id = 'imageViewerModal';
    modal.className = 'image-viewer-modal';
    modal.innerHTML = `
        <div class="image-viewer-container">
            <button class="close-viewer" onclick="closeImageViewer()">
                <i class="fas fa-times"></i>
            </button>
            <div class="image-viewer-content">
                <img id="viewerImage" src="" alt="معاينة الصورة">
                <div class="image-viewer-info">
                    <p id="viewerImageName"></p>
                </div>
            </div>
            <button class="prev-image" onclick="previousImage()">
                <i class="fas fa-chevron-right"></i>
            </button>
            <button class="next-image" onclick="nextImage()">
                <i class="fas fa-chevron-left"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    console.log('✅ تم إنشاء نافذة معاينة الصور');
}

// فتح معاينة الصورة
function openImageViewer(imageUrl, productName = '') {
    createImageViewerModal();
    
    const modal = document.getElementById('imageViewerModal');
    const img = document.getElementById('viewerImage');
    const nameEl = document.getElementById('viewerImageName');
    
    if (modal && img) {
        img.src = imageUrl;
        img.onerror = () => {
            img.src = '/public/images/logo.png';
        };
        
        if (nameEl) {
            nameEl.textContent = productName || 'معاينة الصورة';
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        console.log('🖼️ فتح معاينة الصورة:', productName);
    }
}

// إغلاق معاينة الصورة
function closeImageViewer() {
    const modal = document.getElementById('imageViewerModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// الصورة التالية (للتطبيقات المستقبلية)
function nextImage() {
    console.log('➡️ الصورة التالية');
    // يمكن إضافة منطق للتنقل بين صور المنتج
}

// الصورة السابقة (للتطبيقات المستقبلية)
function previousImage() {
    console.log('⬅️ الصورة السابقة');
    // يمكن إضافة منطق للتنقل بين صور المنتج
}

// إضافة مستمع للضغط على الصور
function setupImageViewers() {
    console.log('⚙️ تهيئة معاينات الصور...');
    
    // إضافة مستمع للصور في بطاقات المنتجات
    document.addEventListener('click', function(e) {
        const productImage = e.target.closest('.product-image img');
        if (productImage) {
            const productCard = productImage.closest('.product-card');
            const productName = productCard?.querySelector('.product-info h3')?.textContent || '';
            openImageViewer(productImage.src, productName);
        }
    });
    
    // إغلاق المعاينة عند الضغط خارجها
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('imageViewerModal');
        if (modal && e.target === modal) {
            closeImageViewer();
        }
    });
    
    // إغلاق المعاينة عند الضغط على Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeImageViewer();
        }
    });
    
    console.log('✅ تم تهيئة معاينات الصور');
}

// تصدير الدوال للنافذة العالمية
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.nextImage = nextImage;
window.previousImage = previousImage;
window.setupImageViewers = setupImageViewers;

// تهيئة معاينات الصور عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    setupImageViewers();
});
