import { adminDb } from "./firebase-admin";
import { ENV } from './_core/env';

export type User = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: 'user' | 'admin';
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export async function upsertUser(user: Partial<User> & { openId: string }): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const userRef = adminDb.collection("users").doc(user.openId);
    const doc = await userRef.get();
    
    const now = new Date();
    const data: any = {
      openId: user.openId,
      updatedAt: now,
    };

    if (user.name !== undefined) data.name = user.name;
    if (user.email !== undefined) data.email = user.email;
    if (user.loginMethod !== undefined) data.loginMethod = user.loginMethod;
    if (user.phone !== undefined) data.phone = user.phone;
    if (user.lastSignedIn !== undefined) data.lastSignedIn = user.lastSignedIn;
    else data.lastSignedIn = now;

    if (user.role !== undefined) {
      data.role = user.role;
    } else if (!doc.exists) {
      // تحديد دور المستخدم: إذا كان openId يطابق OWNER_OPEN_ID، فهو مالك (admin)
      data.role = user.openId === ENV.ownerOpenId ? 'admin' : 'user';
    }

    if (!doc.exists) {
      data.createdAt = now;
      await userRef.set(data);
    } else {
      await userRef.update(data);
    }
  } catch (error) {
    console.error("[Firestore] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  try {
    const doc = await adminDb.collection("users").doc(openId).get();
    if (!doc.exists) return undefined;
    
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : new Date(data?.createdAt),
      updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data?.updatedAt),
      lastSignedIn: data?.lastSignedIn?.toDate ? data.lastSignedIn.toDate() : new Date(data?.lastSignedIn),
    } as User;
  } catch (error) {
    console.error("[Firestore] Failed to get user:", error);
    return undefined;
  }
}
