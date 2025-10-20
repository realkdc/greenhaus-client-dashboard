import {
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const adminEnv = process.env.NEXT_PUBLIC_ALLOWED_ADMINS ?? "";
export const ADMIN_EMAILS = adminEnv
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

export function requireAuth(): Promise<User> {
  return new Promise<User>((resolve, reject) => {
    if (!auth) {
      reject(
        new Error(
          "Firebase Auth is not configured. Check NEXT_PUBLIC_FIREBASE_* variables."
        )
      );
      return;
    }

    let unsubscribe: Unsubscribe | null = null;

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (unsubscribe) {
          unsubscribe();
        }

        if (user) {
          resolve(user);
        } else {
          reject(new Error("User is not authenticated."));
        }
      },
      (error) => {
        if (unsubscribe) {
          unsubscribe();
        }
        reject(error);
      }
    );
  });
}
