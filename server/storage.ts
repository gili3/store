import { adminStorage } from "./firebase-admin";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bucket = adminStorage.bucket();
  const file = bucket.file(key);
  
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  
  await file.save(buffer, {
    metadata: { contentType },
    public: true
  });

  return { key, url: file.publicUrl() };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const bucket = adminStorage.bucket();
  const file = bucket.file(key);
  return { key, url: file.publicUrl() };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const bucket = adminStorage.bucket();
  const file = bucket.file(key);
  
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 3600 * 1000
  });

  return url;
}

/**
 * حذف ملف من التخزين
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  const bucket = adminStorage.bucket();
  const file = bucket.file(key);
  
  try {
    await file.delete();
  } catch (error: any) {
    if (error.code === 404) {
      console.warn(`⚠️ الملف غير موجود: ${key}`);
      return;
    }
    throw error;
  }
}