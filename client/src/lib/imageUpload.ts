import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/**
 * ضغط الصورة قبل الرفع لتقليل الحجم وتحسين الأداء
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('فشل ضغط الصورة'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('فشل تحميل الصورة للضغط'));
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
  });
}

/**
 * رفع صورة إلى Firebase Storage مع مهلة وإعادة محاولة تلقائية
 */
export async function uploadImageToStorage(
  file: File,
  path: string,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("حجم الملف يجب أن يكون أقل من 10 ميجابايت");
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("نوع الملف غير مدعوم. استخدم JPEG, PNG, WEBP, أو GIF");
  }

  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const filename = `${timestamp}_${safeFileName}`;
  const storageRef = ref(storage, `${path}/${filename}`);

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`انتهت المهلة بعد ${timeoutMs/1000} ثانية`)), timeoutMs);
      });

      const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
      const downloadUrl = await getDownloadURL((snapshot as any).ref);
      return downloadUrl;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries && 
          (error.message?.includes('timeout') || 
           error.message?.includes('network') ||
           error.code === 'storage/retry-limit-exceeded')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw new Error(`فشل رفع الصورة: ${error.message}`);
    }
  }

  throw lastError || new Error("فشل رفع الصورة بسبب غير معروف");
}

/**
 * رفع عدة صور مع ضغط اختياري
 */
export async function uploadMultipleImages(
  files: File[],
  path: string,
  compress = true
): Promise<string[]> {
  try {
    let filesToUpload = files;
    if (compress) {
      filesToUpload = await Promise.all(
        files.map((f) => compressImage(f))
      );
    }

    const urls: string[] = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const url = await uploadImageToStorage(filesToUpload[i], path);
      urls.push(url);
    }
    
    return urls;
  } catch (error) {
    console.error("Error uploading multiple images:", error);
    throw error;
  }
}

/**
 * حذف صورة من Firebase Storage
 */
export async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  try {
    if (!imageUrl) return;
    
    const urlParts = imageUrl.split("/o/")[1];
    if (!urlParts) return;
    
    const filePath = decodeURIComponent(urlParts.split("?")[0]);
    const storageRef = ref(storage, filePath);
    
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting image:", error);
  }
}